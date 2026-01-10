import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Checkout from './pages/Checkout';
import Success from './pages/Success';
import Failure from './pages/Failure';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/success" element={<Success />} />
        <Route path="/failure" element={<Failure />} />
        {/* Default redirect to checkout if someone just goes to / */}
        <Route path="*" element={<Navigate to="/checkout" replace />} />
      </Routes>
    </Router>
  );
}

export default App;