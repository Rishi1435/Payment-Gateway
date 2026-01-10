import React from 'react';
import { useSearchParams } from 'react-router-dom';

function Success() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('payment_id');

  return (
    <div className="container" style={{ maxWidth: '480px', marginTop: '60px' }}>
      <div className="card" data-test-id="success-state" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '50px', color: '#00d924' }}>✓</div>
        <h2>Payment Successful!</h2>
        <p data-test-id="success-message">Your payment has been processed successfully.</p>
        
        <div style={{ background: '#f6f9fc', padding: '10px', marginTop: '20px', marginBottom: '20px' }}>
          Reference ID: <span data-test-id="payment-id">{paymentId}</span>
        </div>

        <a 
          href="http://localhost:3000/dashboard"
          style={{
            display: 'inline-block',
            background: '#635bff',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}
        >
          Return to Merchant
        </a>
      </div>
    </div>
  );
}

export default Success;