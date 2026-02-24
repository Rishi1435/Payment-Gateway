import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Checkout from './pages/Checkout';

jest.mock('axios');
const axios = require('axios');

test('E2E Happy Path: User Completes Payment Successfully', async () => {
  // Mock API responses
  axios.get.mockImplementation((url) => {
    if (url.includes('/orders/')) {
      return Promise.resolve({ data: { id: 'order_abc123', amount: 99900 } });
    }
    if (url.includes('/payments/')) {
      return Promise.resolve({ data: { status: 'success' } });
    }
    return Promise.reject(new Error('not found'));
  });

  axios.post.mockResolvedValue({ data: { id: 'pay_12345' } });

  render(
    <BrowserRouter>
      <Checkout />
    </BrowserRouter>
  );

  // Wait for order details to load
  await waitFor(() => {
    expect(screen.getByTestId('checkout-container')).toBeInTheDocument();
  });

  // Switch to UPI method
  const upiBtn = screen.getByTestId('method-upi');
  fireEvent.click(upiBtn);

  // Fill in VPA
  const vpaInput = screen.getByTestId('vpa-input');
  fireEvent.change(vpaInput, { target: { value: 'user@bank' } });

  // Submit payment
  const payBtn = screen.getByTestId('pay-button');
  fireEvent.click(payBtn);

  // Verify transition to processing state
  await waitFor(() => {
    expect(screen.getByText(/Processing payment.../i)).toBeInTheDocument();
  });
});
