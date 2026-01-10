import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

function Failure() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const paymentId = searchParams.get('payment_id');
  const orderId = searchParams.get('order_id');

  return (
    <div className="container" style={{ maxWidth: '480px', marginTop: '60px' }}>
      <div className="card" data-test-id="error-state" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '50px', color: '#e25555' }}>✕</div>
        <h2>Payment Failed</h2>
        <p data-test-id="error-message">The payment could not be completed.</p>
        
        {paymentId && (
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
                Ref: {paymentId}
            </div>
        )}

        <button 
            data-test-id="retry-button" 
            onClick={() => navigate(`/checkout?order_id=${orderId}`)}
            style={{ width: '100%' }}
        >
            Try Again
        </button>
      </div>
    </div>
  );
}

export default Failure;