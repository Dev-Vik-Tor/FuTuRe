import { useState } from 'react';
import axios from 'axios';
import { isValidStellarAddress } from './utils/validateStellarAddress';
import { validateAmount, formatAmount } from './utils/validateAmount';
import { getFriendlyError } from './utils/errorMessages';

function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message, retry? }

  const setError = (error, retry) => setStatus({ type: 'error', message: getFriendlyError(error), retry });
  const setSuccess = (message) => setStatus({ type: 'success', message });

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
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Stellar Remittance Platform</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={createAccount}>Create Account</button>
        {account && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#f0f0f0' }}>
            <p><strong>Public Key:</strong> {account.publicKey}</p>
            <p><strong>Secret Key:</strong> {account.secretKey}</p>
          </div>
        )}
      </div>

      {account && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <button onClick={checkBalance}>Check Balance</button>
            {balance && (
              <div style={{ marginTop: '10px' }}>
                {balance.balances.map((b, i) => (
                  <p key={i}>{b.asset}: {b.balance}</p>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>Send Payment</h3>
            <div style={{ position: 'relative', marginBottom: '4px' }}>
              <input
                type="text"
                placeholder="Recipient Public Key"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  boxSizing: 'border-box',
                  border: `2px solid ${recipientTouched ? (recipientValid ? '#22c55e' : '#ef4444') : '#ccc'}`,
                  borderRadius: '4px',
                  outline: 'none',
                }}
              />
              {recipientTouched && (
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                  {recipientValid ? '✅' : '❌'}
                </span>
              )}
            </div>
            {recipientTouched && !recipientValid && (
              <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 10px' }}>
                Invalid Stellar address format (must start with G and be 56 characters)
              </p>
            )}
            <div style={{ position: 'relative', marginBottom: '4px' }}>
              <input
                type="text"
                placeholder="Amount (XLM)"
                value={amount}
                onChange={(e) => setAmount(formatAmount(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  boxSizing: 'border-box',
                  border: `2px solid ${amountTouched ? (amountValid ? '#22c55e' : '#ef4444') : '#ccc'}`,
                  borderRadius: '4px',
                  outline: 'none',
                }}
              />
              {amountTouched && (
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                  {amountValid ? '✅' : '❌'}
                </span>
              )}
            </div>
            {amountTouched && amountError && (
              <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 10px' }}>{amountError}</p>
            )}
            <button onClick={sendPayment} disabled={!recipientValid || !amountValid}>Send</button>
          </div>
        </>
      )}

      {status && (
        <div style={{
          padding: '10px 14px',
          marginTop: '20px',
          borderRadius: '4px',
          background: status.type === 'error' ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${status.type === 'error' ? '#fca5a5' : '#86efac'}`,
          color: status.type === 'error' ? '#b91c1c' : '#15803d',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
        }}>
          <span>{status.type === 'error' ? '⚠️' : '✅'}</span>
          <span style={{ flex: 1 }}>{status.message}</span>
          {status.retry && (
            <button
              onClick={status.retry}
              style={{ marginLeft: '8px', fontSize: '12px', cursor: 'pointer' }}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
