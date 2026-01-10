import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
  const [method, setMethod] = useState('card'); // Default to card
  const [loading, setLoading] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');

  // Inputs
  const [vpa, setVpa] = useState('');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  
  // Validation
  const [errors, setErrors] = useState({});
  const [detectedNetwork, setDetectedNetwork] = useState('');

  // 1. Get Order ID
  useEffect(() => {
    const orderId = searchParams.get('order_id');
    if (orderId) {
       setOrder({ id: orderId, amount: 50000 }); // Mock amount if backend doesn't provide public endpoint
    }
  }, [searchParams]);

  // --- HELPERS ---
  const formatCardNumber = (value) => {
    const v = value.replace(/\D/g, '').substring(0, 16);
    const parts = [];
    for (let i = 0; i < v.length; i += 4) parts.push(v.substring(i, i + 4));
    return parts.length > 1 ? parts.join('-') : v;
  };

  const formatExpiry = (value) => {
    const v = value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 2) return `${v.substring(0, 2)}/${v.substring(2)}`;
    return v;
  };

  const validateVPA = (vpa) => /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(vpa);
  
  const detectNetwork = (number) => {
    const cleanNum = number.replace(/\D/g, '');
    if (/^4/.test(cleanNum)) return 'Visa';
    if (/^5[1-5]/.test(cleanNum)) return 'Mastercard';
    if (/^3[47]/.test(cleanNum)) return 'Amex';
    if (/^60|^65|^8[1-9]/.test(cleanNum)) return 'Rupay';
    return 'Unknown';
  };

  // --- HANDLERS ---
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/-/g, '');
    setCard({ ...card, number: formatCardNumber(raw) });
    setDetectedNetwork(detectNetwork(raw));
    if (errors.card) setErrors({ ...errors, card: null });
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    
    const newErrors = {};

    // Validation
    if (method === 'upi') {
      if (!validateVPA(vpa)) newErrors.vpa = "Invalid VPA format";
    } else {
      if (card.number.replace(/\D/g, '').length < 16) newErrors.card = "Card number must be 16 digits";
      if (!card.expiry || card.expiry.length < 5) newErrors.expiry = "Invalid Expiry";
      if (!card.cvv || card.cvv.length < 3) newErrors.cvv = "Invalid CVV";
      if (!card.name) newErrors.name = "Name Required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Start Payment
    setLoading(true);
    setProcessingMsg("Processing payment...");

    const payload = {
      order_id: order.id,
      method: method,
      ...(method === 'upi' ? { vpa } : {
        card: {
          number: card.number.replace(/\D/g, ''),
          expiry_month: card.expiry.split('/')[0],
          expiry_year: card.expiry.split('/')[1],
          cvv: card.cvv,
          holder_name: card.name
        }
      })
    };

    try {
      // 1. Create Payment
      const res = await axios.post('http://localhost:8000/api/v1/payments', payload, {
         headers: { 'X-Api-Key': 'key_test_abc123', 'X-Api-Secret': 'secret_test_xyz789' }
      });
      const paymentId = res.data.id;

      // 2. Poll for Status
      const interval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`http://localhost:8000/api/v1/payments/${paymentId}`, {
            headers: { 'X-Api-Key': 'key_test_abc123', 'X-Api-Secret': 'secret_test_xyz789' }
          });
          
          if (statusRes.data.status === 'success') {
            clearInterval(interval);
            // Navigate to Success Page
            navigate(`/success?payment_id=${paymentId}`);
          } else if (statusRes.data.status === 'failed') {
            clearInterval(interval);
            // Navigate to Failure Page
            navigate(`/failure?payment_id=${paymentId}&order_id=${order.id}`);
          }
        } catch (err) { console.error(err); }
      }, 2000);

    } catch (err) {
      setLoading(false);
      alert("System Error: Could not initiate payment.");
    }
  };

  if (!order) return <div className="container">Loading order details...</div>;

  return (
    <div className="container" style={{ maxWidth: '480px', marginTop: '60px' }}>
      <div className="card" data-test-id="checkout-container">
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h3>Pay Merchant</h3>
          <div data-test-id="order-amount" style={{ fontSize: '32px', fontWeight: 'bold', color: '#635bff' }}>
            ₹{(order.amount / 100).toFixed(2)}
          </div>
          <div data-test-id="order-id" style={{ color: '#8898aa', fontSize: '14px' }}>Order ID: {order.id}</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spinner"></div>
            <p>{processingMsg}</p>
          </div>
        ) : (
          <>
            {/* Method Toggle */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button className={`method-btn ${method === 'upi' ? 'active' : ''}`} onClick={() => setMethod('upi')}>UPI</button>
              <button className={`method-btn ${method === 'card' ? 'active' : ''}`} onClick={() => setMethod('card')}>Card</button>
            </div>

            <form onSubmit={handlePayment}>
              {method === 'upi' ? (
                <div className="input-group">
                  <input data-test-id="vpa-input" placeholder="user@bank" value={vpa} onChange={e => setVpa(e.target.value)} />
                  {errors.vpa && <div style={{color:'red'}}>{errors.vpa}</div>}
                </div>
              ) : (
                <>
                   <div className="input-group" style={{position:'relative'}}>
                     <input data-test-id="card-number-input" placeholder="Card Number" value={card.number} onChange={handleCardNumberChange} maxLength="19" />
                     <span style={{position:'absolute', right:10, top:12, fontWeight:'bold', color:'#635bff'}}>{detectedNetwork}</span>
                     {errors.card && <div style={{color:'red'}}>{errors.card}</div>}
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} className="input-group">
                     <div>
                        <input data-test-id="expiry-input" placeholder="MM/YY" value={card.expiry} onChange={e => setCard({...card, expiry: formatExpiry(e.target.value)})} maxLength="5" />
                        {errors.expiry && <div style={{color:'red'}}>{errors.expiry}</div>}
                     </div>
                     <div>
                        <input data-test-id="cvv-input" placeholder="CVV" value={card.cvv} onChange={e => setCard({...card, cvv: e.target.value})} maxLength="3" />
                        {errors.cvv && <div style={{color:'red'}}>{errors.cvv}</div>}
                     </div>
                   </div>
                   <div className="input-group">
                      <input data-test-id="cardholder-name-input" placeholder="Cardholder Name" value={card.name} onChange={e => setCard({...card, name: e.target.value})} />
                      {errors.name && <div style={{color:'red'}}>{errors.name}</div>}
                   </div>
                </>
              )}
              <button data-test-id="pay-button" type="submit">Pay Now</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Checkout;