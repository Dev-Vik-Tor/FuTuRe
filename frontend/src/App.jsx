import { useState } from 'react';
import axios from 'axios';
import { isValidStellarAddress } from './utils/validateStellarAddress';
import { validateAmount, formatAmount } from './utils/validateAmount';
import { getFriendlyError } from './utils/errorMessages';
import { useWebSocket } from './hooks/useWebSocket';

const STATUS_COLORS = { connected: '#22c55e', disconnected: '#ef4444', reconnecting: '#f59e0b' };

function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message, retry? }
  const [notifications, setNotifications] = useState([]);

  const setError = (error, retry) => setStatus({ type: 'error', message: getFriendlyError(error), retry });
  const setSuccess = (message) => setStatus({ type: 'success', message });

  const addNotification = (msg) => {
    const note = {
      id: Date.now(),
      text: msg.direction === 'received'
        ? `📥 Received ${msg.amount} ${msg.assetCode} — tx: ${msg.hash?.slice(0, 8)}…`
        : `📤 Sent ${msg.amount} ${msg.assetCode} — tx: ${msg.hash?.slice(0, 8)}…`
    };
    setNotifications((prev) => [note, ...prev].slice(0, 5));
  };

  const handleWsMessage = (msg) => {
    if (msg.type === 'transaction') {
      addNotification(msg);
      if (msg.balance) setBalance((prev) => prev ? { ...prev, balances: msg.balance } : null);
    }
  };

  const wsStatus = useWebSocket(account?.publicKey ?? null, handleWsMessage);

  const createAccount = async () => {
    try {
      const { data } = await axios.post('/api/stellar/account/create');
      setAccount(data);
      setSuccess('Account created! Save your secret key securely.');
    } catch (error) {
      setError(error, createAccount);
    }
  };

  const checkBalance = async () => {
    if (!account) return;
    try {
      const { data } = await axios.get(`/api/stellar/account/${account.publicKey}`);
      setBalance(data);
    } catch (error) {
      setError(error, checkBalance);
    }
  };

  const recipientValid = isValidStellarAddress(recipient);
  const recipientTouched = recipient.length > 0;

  const xlmBalance = balance?.balances?.find(b => b.asset === 'XLM')?.balance ?? null;
  const amountTouched = amount.length > 0;
  const amountError = validateAmount(amount, xlmBalance !== null ? parseFloat(xlmBalance) : null);
  const amountValid = amountTouched && !amountError;

  const sendPayment = async () => {
    if (!account || !recipientValid || !amountValid) return;
    try {
      const { data } = await axios.post('/api/stellar/payment/send', {
        sourceSecret: account.secretKey,
        destination: recipient,
        amount,
        assetCode: 'XLM'
      });
      setSuccess(`Payment sent! Hash: ${data.hash}`);
      checkBalance();
    } catch (error) {
      setError(error, sendPayment);
    }
  };

  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Stellar Remittance Platform</h1>
        <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[wsStatus], display: 'inline-block' }} />
          {wsStatus}
        </span>
      </div>

      <div className="section">
        <button onClick={createAccount}>Create Account</button>
        {account && (
          <div className="account-info">
            <p><strong>Public Key:</strong> {account.publicKey}</p>
            <p><strong>Secret Key:</strong> {account.secretKey}</p>
          </div>
        )}
      </div>

      {account && (
        <>
          <div className="section">
            <button onClick={checkBalance}>Check Balance</button>
            {balance && (
              <div style={{ marginTop: '10px' }}>
                {balance.balances.map((b, i) => (
                  <p key={i}>{b.asset}: {b.balance}</p>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <h3>Send Payment</h3>
            <div className="input-wrap">
              <input
                type="text"
                placeholder="Recipient Public Key"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                style={{ border: `2px solid ${recipientTouched ? (recipientValid ? '#22c55e' : '#ef4444') : '#ccc'}` }}
              />
              {recipientTouched && <span className="input-icon">{recipientValid ? '✅' : '❌'}</span>}
            </div>
            {recipientTouched && !recipientValid && (
              <p className="field-error">Invalid Stellar address format (must start with G and be 56 characters)</p>
            )}
            <div className="input-wrap">
              <input
                type="text"
                placeholder="Amount (XLM)"
                value={amount}
                onChange={(e) => setAmount(formatAmount(e.target.value))}
                style={{ border: `2px solid ${amountTouched ? (amountValid ? '#22c55e' : '#ef4444') : '#ccc'}` }}
              />
              {amountTouched && <span className="input-icon">{amountValid ? '✅' : '❌'}</span>}
            </div>
            {amountTouched && amountError && <p className="field-error">{amountError}</p>}
            <button onClick={sendPayment} disabled={!recipientValid || !amountValid}>Send</button>
          </div>

          {notifications.length > 0 && (
            <div className="section">
              <h3>Live Notifications</h3>
              {notifications.map((n) => (
                <div key={n.id} className="status-banner success" style={{ marginBottom: 6 }}>
                  <span>{n.text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {status && (
        <div className={`status-banner ${status.type}`}>
          <span>{status.type === 'error' ? '⚠️' : '✅'}</span>
          <span className="msg">{status.message}</span>
          {status.retry && <button onClick={status.retry}>Retry</button>}
        </div>
      )}
    </div>
  );
}

export default App;
