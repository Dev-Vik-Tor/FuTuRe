import * as StellarSDK from '@stellar/stellar-sdk';
import { eventMonitor } from '../eventSourcing/index.js';
import logger from '../config/logger.js';
import prisma from '../db/client.js';
import { getIssuer } from '../config/assets.js';
import { getConfig } from '../config/env.js';

let horizonServerUrl;
let horizonServer;

function getHorizonServer() {
  const { horizonUrl } = getConfig().stellar;
  if (!horizonServer || horizonUrl !== horizonServerUrl) {
    horizonServerUrl = horizonUrl;
    horizonServer = new StellarSDK.Horizon.Server(horizonUrl);
  }
  return horizonServer;
}

function isTestnet() {
  return getConfig().stellar.network === 'testnet';
}

export async function createAccount() {
  const pair = StellarSDK.Keypair.random();
  const publicKey = pair.publicKey();
  logger.info('stellar.createAccount', { publicKey });
  
  if (isTestnet()) {
    await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    logger.debug('stellar.friendbotFunded', { publicKey });
    await eventMonitor.publishEvent(publicKey, {
      type: 'AccountFunded',
      data: { publicKey },
      version: 1
    });
  }

  await eventMonitor.publishEvent(publicKey, {
    type: 'AccountCreated',
    data: { publicKey, secretKey: pair.secret() },
    version: 1
  });

  await prisma.user.upsert({
    where: { publicKey },
    update: {},
    create: { publicKey },
  }).catch(err => logger.warn('db.user.upsert.failed', { error: err.message }));
  
  return {
    publicKey,
    secretKey: pair.secret()
  };
}

export async function getBalance(publicKey) {
  logger.debug('stellar.getBalance', { publicKey });
  const account = await getHorizonServer().loadAccount(publicKey);
  const balances = account.balances.map(b => ({
    asset: b.asset_type === 'native' ? 'XLM' : `${b.asset_code}:${b.asset_issuer}`,
    balance: b.balance
  }));

  logger.info('stellar.balanceFetched', { publicKey, balances });
  await eventMonitor.publishEvent(publicKey, {
    type: 'BalanceChecked',
    data: { balances },
    version: 1
  });

  return { publicKey, balances };
}

export async function sendPayment(sourceSecret, destination, amount, assetCode = 'XLM') {
  const { assetIssuer } = getConfig().stellar;
  const sourceKeypair = StellarSDK.Keypair.fromSecret(sourceSecret);
  const sourcePublicKey = sourceKeypair.publicKey();
  logger.info('stellar.sendPayment.start', { source: sourcePublicKey, destination, amount, assetCode });

  const sourceAccount = await getHorizonServer().loadAccount(sourcePublicKey);
  
  if (assetCode !== 'XLM' && !assetIssuer) {
    throw new Error('ASSET_ISSUER is required for non-XLM payments');
  }

  const asset = assetCode === 'XLM' 
    ? StellarSDK.Asset.native() 
    : new StellarSDK.Asset(assetCode, getIssuer(assetCode));
  
  const transaction = new StellarSDK.TransactionBuilder(sourceAccount, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: isTestnet() 
      ? StellarSDK.Networks.TESTNET 
      : StellarSDK.Networks.PUBLIC
  })
    .addOperation(StellarSDK.Operation.payment({
      destination,
      asset,
      amount: amount.toString()
    }))
    .setTimeout(30)
    .build();
  
  transaction.sign(sourceKeypair);

  let result;
  try {
    result = await getHorizonServer().submitTransaction(transaction);
  } catch (err) {
    logger.error('stellar.sendPayment.failed', { source: sourcePublicKey, destination, amount, assetCode, error: err.message });
    throw err;
  }

  logger.info('stellar.sendPayment.success', {
    source: sourcePublicKey,
    destination,
    amount,
    assetCode,
    hash: result.hash,
    ledger: result.ledger,
  });

  await eventMonitor.publishEvent(sourcePublicKey, {
    type: 'PaymentSent',
    data: { destination, amount, hash: result.hash },
    version: 1
  });

  // Persist transaction — ensure both users exist first
  await prisma.$transaction(async (tx) => {
    const [sender, recipient] = await Promise.all([
      tx.user.upsert({ where: { publicKey: sourcePublicKey }, update: {}, create: { publicKey: sourcePublicKey } }),
      tx.user.upsert({ where: { publicKey: destination },    update: {}, create: { publicKey: destination } }),
    ]);
    await tx.transaction.create({
      data: {
        hash: result.hash,
        assetCode: assetCode || 'XLM',
        amount,
        ledger: result.ledger ?? null,
        successful: result.successful,
        senderId: sender.id,
        recipientId: recipient.id,
      },
    });
  }).catch(err => logger.warn('db.transaction.save.failed', { error: err.message }));
  
  return {
    hash: result.hash,
    ledger: result.ledger,
    success: result.successful
  };
}

export async function createTrustline(sourceSecret, assetCode) {
  const issuer = getIssuer(assetCode);
  if (!issuer) throw new Error(`Unknown asset or missing issuer for ${assetCode}`);

  const sourceKeypair = StellarSDK.Keypair.fromSecret(sourceSecret);
  const sourcePublicKey = sourceKeypair.publicKey();
  logger.info('stellar.createTrustline', { publicKey: sourcePublicKey, assetCode });

  const sourceAccount = await getHorizonServer().loadAccount(sourcePublicKey);
  const asset = new StellarSDK.Asset(assetCode, issuer);

  const transaction = new StellarSDK.TransactionBuilder(sourceAccount, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: isTestnet() ? StellarSDK.Networks.TESTNET : StellarSDK.Networks.PUBLIC,
  })
    .addOperation(StellarSDK.Operation.changeTrust({ asset }))
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);

  let result;
  try {
    result = await getHorizonServer().submitTransaction(transaction);
  } catch (err) {
    logger.error('stellar.createTrustline.failed', { publicKey: sourcePublicKey, assetCode, error: err.message });
    throw err;
  }

  logger.info('stellar.createTrustline.success', { publicKey: sourcePublicKey, assetCode, hash: result.hash });

  await eventMonitor.publishEvent(sourcePublicKey, {
    type: 'TrustlineCreated',
    data: { assetCode, issuer, hash: result.hash },
    version: 1,
  });

  return { hash: result.hash, assetCode, issuer };
}

export async function getTransactionHistory(publicKey, { limit = 10, cursor } = {}) {
  let call = getHorizonServer().transactions().forAccount(publicKey).limit(limit).order('desc');
  if (cursor) call = call.cursor(cursor);
  const result = await call.call();
  return {
    publicKey,
    transactions: result.records.map(tx => ({
      id: tx.id,
      hash: tx.hash,
      createdAt: tx.created_at,
      successful: tx.successful,
      ledger: tx.ledger_attr,
      pagingToken: tx.paging_token,
    })),
    nextCursor: result.records.at(-1)?.paging_token ?? null,
  };
}

export async function getExchangeRate(from, to) {
  if (from === to) return 1.0;
  try {
    const fromAsset = from === 'XLM' ? StellarSDK.Asset.native() : new StellarSDK.Asset(from, getIssuer(from));
    const toAsset   = to   === 'XLM' ? StellarSDK.Asset.native() : new StellarSDK.Asset(to,   getIssuer(to));
    const orderbook = await server.orderbook(fromAsset, toAsset).call();
    const bestAsk = orderbook.asks?.[0]?.price;
    return bestAsk ? parseFloat(bestAsk) : null;
  } catch (err) {
    logger.warn('stellar.getExchangeRate.failed', { from, to, error: err.message });
    return null;
  }
}

export async function getNetworkStatus() {
  const { horizonUrl } = getConfig().stellar;
  try {
    const root = await getHorizonServer().root();
    const status = {
      network: isTestnet() ? 'testnet' : 'mainnet',
      horizonUrl,
      online: true,
      horizonVersion: root.horizon_version,
      networkPassphrase: root.network_passphrase,
      currentProtocolVersion: root.current_protocol_version,
    };
    logger.debug('stellar.networkStatus', status);
    return status;
  } catch (err) {
    logger.warn('stellar.networkStatus.offline', { error: err.message });
    return {
      network: isTestnet() ? 'testnet' : 'mainnet',
      horizonUrl,
      online: false,
    };
  }
}
