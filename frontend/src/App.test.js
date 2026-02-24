import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './pages/Dashboard';

// Mocking axios for E2E-like happy path simulation without real backend
jest.mock('axios');
const axios = require('axios');

test('E2E Happy Path: Loads Dashboard and generates Payment Link', async () => {
  // Mock API responses
  axios.get.mockImplementation((url) => {
    if (url.includes('/test/merchant')) {
      return Promise.resolve({ data: { api_key: 'test_key', api_secret: 'test_sec' } });
    }
    if (url.includes('/payments')) {
      return Promise.resolve({ data: [{ id: 'pay_123', amount: 50000, status: 'success', method: 'upi', created_at: new Date() }] });
    }
    return Promise.reject(new Error('not found'));
  });

  axios.post.mockResolvedValue({ data: { id: 'order_1234' } });

  render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );

  // Verify dashboard loads correctly
  expect(await screen.findByText(/API Credentials/i)).toBeInTheDocument();
  expect(screen.getByTestId('dashboard')).toBeInTheDocument();

  // Simulate entering amount and creating an order
  const amountInput = screen.getByRole('spinbutton');
  fireEvent.change(amountInput, { target: { value: '800' } });

  const createBtn = screen.getByText(/Create Payment Link/i);
  fireEvent.click(createBtn);

  // Wait for the successful creation UI to appear
  await waitFor(() => {
    expect(screen.getByText(/Order Created Successfully/i)).toBeInTheDocument();
  });
});
