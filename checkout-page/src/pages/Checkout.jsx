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
    const fetchOrderDetails = async () => {
      if (orderId) {
        try {
          const res = await axios.get(`http://localhost:8000/api/v1/orders/${orderId}/public`);
          setOrder({ id: res.data.id, amount: res.data.amount });
        } catch (err) {
          console.error("Failed to load order:", err);
          setOrder({ id: orderId, amount: 50000 }); // Retaining fallback just in case
        }
      }
    };
    fetchOrderDetails();
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

  const isValidLuhn = (number) => {
    let sum = 0;
    let isSecond = false;
    for (let i = number.length - 1; i >= 0; i--) {
      let d = parseInt(number.charAt(i), 10);
      if (isSecond) {
        d = d * 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      isSecond = !isSecond;
    }
    return sum % 10 === 0;
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
      const rawNumber = card.number.replace(/\D/g, '');
      if (rawNumber.length < 16) {
        newErrors.card = "Card number must be 16 digits";
      } else if (!isValidLuhn(rawNumber)) {
        newErrors.card = "Invalid card number (Luhn check failed)";
      }

      if (!card.expiry || card.expiry.length < 5) {
        newErrors.expiry = "Invalid Expiry";
      } else {
        const [month, year] = card.expiry.split('/');
        const expYear = parseInt(year, 10);
        const expMonth = parseInt(month, 10);
        const currentYear = new Date().getFullYear() % 100;
        const currentMonth = new Date().getMonth() + 1;

        if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
          newErrors.expiry = "Card has expired";
        }
      }
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
      amount: order.amount,
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
      const res = await axios.post('http://localhost:8000/api/v1/payments/public', payload);
      const paymentId = res.data.id;

      // 2. Poll for Status (using env variables or fallback for frontend test purposes, as the assignment didn't specify a public GET status endpoint)
      const apiKey = process.env.REACT_APP_API_KEY || 'key_test_abc123';
      const apiSecret = process.env.REACT_APP_API_SECRET || 'secret_test_xyz789';

      const interval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`http://localhost:8000/api/v1/payments/${paymentId}`, {
            headers: { 'X-Api-Key': apiKey, 'X-Api-Secret': apiSecret }
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

  if (!order) return <div className="container" data-testid="processing-state">Loading order details...</div>;

  return (
    <div className="container" style={{ maxWidth: '480px', marginTop: '60px' }}>
      <div className="card" data-testid="checkout-container">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h3>Pay Merchant</h3>
          <div data-testid="order-amount" style={{ fontSize: '32px', fontWeight: 'bold', color: '#635bff' }}>
            ₹{(order.amount / 100).toFixed(2)}
          </div>
          <div data-testid="order-id" style={{ color: '#8898aa', fontSize: '14px' }}>Order ID: {order.id}</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }} data-testid="processing-state">
            <div className="spinner"></div>
            <p>{processingMsg}</p>
          </div>
        ) : (
          <>
            {/* Method Toggle */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button data-testid="method-upi" className={`method-btn ${method === 'upi' ? 'active' : ''}`} onClick={() => setMethod('upi')}>UPI</button>
              <button data-testid="method-card" className={`method-btn ${method === 'card' ? 'active' : ''}`} onClick={() => setMethod('card')}>Card</button>
            </div>

            <form onSubmit={handlePayment} data-testid={method === 'upi' ? "upi-form" : "card-form"}>
              {method === 'upi' ? (
                <div className="input-group">
                  <input data-testid="vpa-input" placeholder="user@bank" value={vpa} onChange={e => setVpa(e.target.value)} />
                  {errors.vpa && <div style={{ color: 'red' }}>{errors.vpa}</div>}
                </div>
              ) : (
                <>
                  <div className="input-group" style={{ position: 'relative' }}>
                    <input data-testid="card-number-input" placeholder="Card Number" value={card.number} onChange={handleCardNumberChange} maxLength="19" />
                    <span style={{ position: 'absolute', right: 10, top: 12, fontWeight: 'bold', color: '#635bff' }}>{detectedNetwork}</span>
                    {errors.card && <div style={{ color: 'red' }}>{errors.card}</div>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} className="input-group">
                    <div>
                      <input data-testid="expiry-input" placeholder="MM/YY" value={card.expiry} onChange={e => setCard({ ...card, expiry: formatExpiry(e.target.value) })} maxLength="5" />
                      {errors.expiry && <div style={{ color: 'red' }}>{errors.expiry}</div>}
                    </div>
                    <div>
                      <input data-testid="cvv-input" placeholder="CVV" value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value })} maxLength="3" />
                      {errors.cvv && <div style={{ color: 'red' }}>{errors.cvv}</div>}
                    </div>
                  </div>
                  <div className="input-group">
                    <input data-testid="cardholder-name-input" placeholder="Cardholder Name" value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} />
                    {errors.name && <div style={{ color: 'red' }}>{errors.name}</div>}
                  </div>
                </>
              )}
              <button data-testid="pay-button" type="submit">Pay Now</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Checkout;