import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function Dashboard() {
  const [merchant, setMerchant] = useState(null);
  const [amount, setAmount] = useState('500'); 
  const [generatedLink, setGeneratedLink] = useState('');
  const [loading, setLoading] = useState(false);
  
  // New state for real-time stats
  const [stats, setStats] = useState({ count: 0, volume: 0, successRate: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Merchant Details
        const merchantRes = await axios.get('http://localhost:8000/api/v1/test/merchant');
        setMerchant(merchantRes.data);

        // 2. Fetch Payments for Stats
        // Note: You must have added the GET /api/v1/payments route to your backend for this to work
        const paymentsRes = await axios.get('http://localhost:8000/api/v1/payments', {
          headers: {
            'X-Api-Key': merchantRes.data.api_key,
            'X-Api-Secret': 'secret_test_xyz789'
          }
        });

        const payments = paymentsRes.data;
        const successPayments = payments.filter(p => p.status === 'success');
        
        // Calculate dynamic stats
        setStats({
          count: payments.length,
          volume: successPayments.reduce((sum, p) => sum + p.amount, 0),
          successRate: payments.length ? Math.round((successPayments.length / payments.length) * 100) : 0
        });

      } catch (err) { 
        console.error("Dashboard Data Error:", err); 
      }
    };
    fetchData();
  }, []);

  const createOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/api/v1/orders', 
        {
          amount: parseFloat(amount) * 100, 
          currency: "INR",
          receipt: `receipt_${Date.now()}`
        },
        {
          headers: {
            'X-Api-Key': merchant.api_key,
            'X-Api-Secret': 'secret_test_xyz789'
          }
        }
      );

      const orderId = res.data.id;
      const checkoutUrl = `http://localhost:3001/checkout?order_id=${orderId}`;
      setGeneratedLink(checkoutUrl);
    } catch (err) {
      alert("Failed to create order. Check console.");
      console.error(err);
    }
    setLoading(false);
  };

  if (!merchant) return <div className="container">Loading dashboard...</div>;

  return (
    <div className="container" data-test-id="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Overview</h1>
        <Link to="/dashboard/transactions" style={{ color: '#635bff', textDecoration: 'none', fontWeight: 'bold' }}>
          View Transactions →
        </Link>
      </div>

      {/* API Credentials Card */}
      <div className="card" data-test-id="api-credentials">
        <h3>API Credentials</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', color: '#8898aa', fontSize: '12px', marginBottom: '5px' }}>PUBLIC KEY</label>
          <code data-test-id="api-key" style={{ background: '#f6f9fc', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', display: 'block' }}>
            {merchant.api_key}
          </code>
        </div>
        <div>
          <label style={{ display: 'block', color: '#8898aa', fontSize: '12px', marginBottom: '5px' }}>SECRET KEY</label>
          <code data-test-id="api-secret" style={{ background: '#f6f9fc', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', display: 'block' }}>
            secret_test_xyz789
          </code>
        </div>
      </div>

      {/* Payment Terminal */}
      <div className="card" style={{ borderLeft: '4px solid #635bff' }}>
        <h3>⚡ Payment Terminal</h3>
        <p style={{ color: '#525f7f', marginBottom: '20px' }}>
          Create a test payment link instantly to simulate the customer checkout flow.
        </p>
        
        {!generatedLink ? (
          <form onSubmit={createOrder} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Amount (INR)</label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid #e6ebf1', borderRadius: '6px' }}
              />
            </div>
            <button type="submit" disabled={loading} style={{ width: 'auto', background: '#0a2540' }}>
              {loading ? 'Creating...' : 'Create Payment Link'}
            </button>
          </form>
        ) : (
          <div style={{ background: '#f6f9fc', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ color: '#00d924', fontWeight: 'bold', marginBottom: '10px' }}>✓ Order Created Successfully</div>
            <div style={{ marginBottom: '15px', wordBreak: 'break-all', fontFamily: 'monospace', color: '#525f7f' }}>
              {generatedLink}
            </div>
            <a 
              href={generatedLink} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'inline-block', background: '#635bff', color: 'white', padding: '12px 24px', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}
            >
              Pay Now →
            </a>
            <button 
              onClick={() => setGeneratedLink('')}
              style={{ display: 'block', margin: '15px auto 0', background: 'transparent', color: '#525f7f', border: 'none', textDecoration: 'underline' }}
            >
              Create Another
            </button>
          </div>
        )}
      </div>

      {/* Stats Grid - NOW USING REAL DATA */}
      <div className="card">
        <h3>Performance</h3>
        <div className="stats-grid" data-test-id="stats-container">
          <div className="stat-box">
            <div className="label">Total Transactions</div>
            <div className="stat-value" data-test-id="total-transactions">{stats.count}</div>
          </div>
          <div className="stat-box">
            <div className="label">Total Volume</div>
            <div className="stat-value" data-test-id="total-amount">₹{(stats.volume / 100).toFixed(2)}</div>
          </div>
          <div className="stat-box">
            <div className="label">Success Rate</div>
            <div className="stat-value" data-test-id="success-rate">{stats.successRate}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;