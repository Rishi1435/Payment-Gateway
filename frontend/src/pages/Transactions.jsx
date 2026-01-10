import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function Transactions() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:8000/api/v1/payments', {
      headers: {
        'X-Api-Key': 'key_test_abc123',
        'X-Api-Secret': 'secret_test_xyz789'
      }
    })
    .then(res => setTransactions(res.data))
    .catch(err => console.error(err));
  }, []);

  return (
    <div className="container">
      <Link to="/dashboard" style={{ color: '#635bff', textDecoration: 'none' }}>← Back to Dashboard</Link>
      <h1 style={{ marginTop: '20px' }}>Transactions</h1>
      
      <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
        <table data-test-id="transactions-table">
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Order ID</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} data-test-id="transaction-row" data-payment-id={t.id}>
                <td data-test-id="payment-id" style={{fontFamily:'monospace'}}>{t.id}</td>
                <td data-test-id="order-id" style={{fontFamily:'monospace'}}>{t.order_id}</td>
                <td data-test-id="amount">₹{(t.amount / 100).toFixed(2)}</td>
                <td data-test-id="method">{t.method}</td>
                <td>
                  <span 
                    data-test-id="status"
                    className={`status-badge status-${t.status}`}
                  >
                    {t.status}
                  </span>
                </td>
                <td data-test-id="created-at">
                  {new Date(t.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan="6" style={{textAlign:'center'}}>No transactions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Transactions;