import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login({ setAuth }) {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // For Deliverable 1, we just simulate login with the test email
    if (email === 'test@example.com') {
      setAuth(true);
      navigate('/dashboard');
    } else {
      alert("Use test@example.com");
    }
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '100px' }}>
      <div className="card">
        <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>Merchant Portal</h2>
        <form data-test-id="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <input
              data-test-id="email-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <input
              data-test-id="password-input"
              type="password"
              placeholder="Password"
            />
          </div>
          <button data-test-id="login-button" type="submit">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;