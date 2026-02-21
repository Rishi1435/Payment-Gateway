const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// Helper: Luhn Algorithm
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

// 1. PUBLIC CREATE PAYMENT (POST /api/v1/payments/public)
router.post('/public', async (req, res) => {
    const { order_id, method, vpa, card } = req.body;

    try {
        const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Order not found' } });
        }

        const order = orderResult.rows[0];
        const paymentAmount = order.amount; // Force using order amount for public

        let card_last4 = null;
        let card_network = null;

        if (method === 'upi') {
            const vpaRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
            if (!vpa || !vpaRegex.test(vpa)) {
                return res.status(400).json({ error: { code: 'INVALID_VPA', description: 'VPA format invalid' } });
            }
        } else if (method === 'card') {
            if (!card || !card.number || !card.expiry_month || !card.expiry_year || !card.cvv || !card.holder_name) {
                return res.status(400).json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Missing card details' } });
            }

            const rawCardNumber = card.number.replace(/\D/g, '');
            if (rawCardNumber.length < 13 || rawCardNumber.length > 19 || !isValidLuhn(rawCardNumber)) {
                return res.status(400).json({ error: { code: 'INVALID_CARD', description: 'Card validation failed' } });
            }

            // Strict Expiry Check
            const currentYear = new Date().getFullYear();
            const expYearRaw = String(card.expiry_year);
            const expYear = expYearRaw.length === 2 ? parseInt(`20${expYearRaw}`, 10) : parseInt(expYearRaw, 10);
            const expMonth = parseInt(card.expiry_month, 10);

            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1; // 1-12

            if (expMonth < 1 || expMonth > 12 || expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
                return res.status(400).json({ error: { code: 'EXPIRED_CARD', description: 'Card expiry date invalid' } });
            }

            // Determine strict lowercase network
            if (/^4/.test(rawCardNumber)) card_network = 'visa';
            else if (/^5[1-5]/.test(rawCardNumber)) card_network = 'mastercard';
            else if (/^3[47]/.test(rawCardNumber)) card_network = 'amex';
            else if (/^60|^65|^8[1-9]/.test(rawCardNumber)) card_network = 'rupay';
            else card_network = 'unknown';

            card_last4 = rawCardNumber.slice(-4);
        } else {
            return res.status(400).json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Invalid payment method' } });
        }

        // Test Mode Variables
        const isTestMode = process.env.TEST_MODE === 'true';
        let processingDelay = Math.floor(Math.random() * (10000 - 5000 + 1) + 5000); // 5-10 seconds
        let isSuccess = method === 'upi' ? (Math.random() < 0.90) : (Math.random() < 0.95);

        if (isTestMode) {
            if (process.env.TEST_PAYMENT_SUCCESS !== undefined) {
                isSuccess = process.env.TEST_PAYMENT_SUCCESS === 'true';
            }
            if (process.env.TEST_PROCESSING_DELAY !== undefined) {
                processingDelay = parseInt(process.env.TEST_PROCESSING_DELAY, 10);
            }
        }

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let randomStr = '';
        for (let i = 0; i < 16; i++) randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
        const generatedPaymentId = `pay_${randomStr}`;

        // Step 1: Insert Payment as "processing"
        const insertResult = await pool.query(
            `INSERT INTO payments 
            (id, order_id, merchant_id, amount, currency, status, method, vpa, card_last4, card_network, created_at)
            VALUES 
            ($1, $2, $3, $4, $5, 'processing', $6, $7, $8, $9, NOW()) 
            RETURNING *`,
            [
                generatedPaymentId,
                order.id,
                order.merchant_id,
                paymentAmount,
                order.currency || 'INR',
                method,
                method === 'upi' ? vpa : null,
                card_last4,
                card_network
            ]
        );

        const payment = insertResult.rows[0];

        // Send immediate response with "processing" status
        const responseBody = {
            id: payment.id,
            order_id: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            status: payment.status,
            created_at: payment.created_at
        };
        if (method === 'upi') responseBody.vpa = payment.vpa;
        if (method === 'card') {
            responseBody.card_network = payment.card_network;
            responseBody.card_last4 = payment.card_last4;
        }

        res.status(201).json(responseBody);

        // Step 2: Simulate Delay & Update to Final State (Async)
        setTimeout(async () => {
            const finalStatus = isSuccess ? 'success' : 'failed';
            let errorCode = null;
            let errorDesc = null;

            if (finalStatus === 'failed') {
                errorCode = 'PAYMENT_FAILED';
                errorDesc = 'Payment processing failed';
            }

            try {
                await pool.query(
                    `UPDATE payments 
                     SET status = $1, error_code = $2, error_description = $3, updated_at = NOW() 
                     WHERE id = $4`,
                    [finalStatus, errorCode, errorDesc, generatedPaymentId]
                );
            } catch (err) {
                console.error("Async Save Error:", err);
            }
        }, processingDelay);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: 'SERVER_ERROR', description: 'Internal Server Error' } });
    }
});

// 1. CREATE PAYMENT (POST /api/v1/payments)
router.post('/', authenticate, async (req, res) => {
    const { order_id, amount, currency, method, vpa, card } = req.body;

    try {
        // Validation: Verify order and amount
        const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Order not found' } });
        }

        const order = orderResult.rows[0];
        // Allow amount in the request body to match the order amount or be omitted (and we use order amount)
        const paymentAmount = amount || order.amount;
        if (paymentAmount !== order.amount) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Payment amount mismatch' } });
        }

        let card_last4 = null;
        let card_network = null;

        // Validation: Details
        if (method === 'upi') {
            const vpaRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
            if (!vpa || !vpaRegex.test(vpa)) {
                return res.status(400).json({ error: { code: 'INVALID_VPA', description: 'VPA format invalid' } });
            }
        } else if (method === 'card') {
            if (!card || !card.number || !card.expiry_month || !card.expiry_year || !card.cvv || !card.holder_name) {
                return res.status(400).json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Missing card details' } });
            }

            const rawCardNumber = card.number.replace(/\D/g, '');
            if (rawCardNumber.length < 13 || rawCardNumber.length > 19 || !isValidLuhn(rawCardNumber)) {
                return res.status(400).json({ error: { code: 'INVALID_CARD', description: 'Card validation failed' } });
            }

            // Strict Expiry Check
            const currentYear = new Date().getFullYear();
            const expYearRaw = String(card.expiry_year);
            const expYear = expYearRaw.length === 2 ? parseInt(`20${expYearRaw}`, 10) : parseInt(expYearRaw, 10);
            const expMonth = parseInt(card.expiry_month, 10);

            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1; // 1-12

            if (expMonth < 1 || expMonth > 12 || expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
                return res.status(400).json({ error: { code: 'EXPIRED_CARD', description: 'Card expiry date invalid' } });
            }

            // Determine strict lowercase network
            if (/^4/.test(rawCardNumber)) card_network = 'visa';
            else if (/^5[1-5]/.test(rawCardNumber)) card_network = 'mastercard';
            else if (/^3[47]/.test(rawCardNumber)) card_network = 'amex';
            else if (/^60|^65|^8[1-9]/.test(rawCardNumber)) card_network = 'rupay';
            else card_network = 'unknown';

            card_last4 = rawCardNumber.slice(-4);
        } else {
            return res.status(400).json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Invalid payment method' } });
        }

        // Test Mode Variables
        const isTestMode = process.env.TEST_MODE === 'true';
        let processingDelay = Math.floor(Math.random() * (10000 - 5000 + 1) + 5000); // 5-10 seconds
        let isSuccess = method === 'upi' ? (Math.random() < 0.90) : (Math.random() < 0.95);

        if (isTestMode) {
            if (process.env.TEST_PAYMENT_SUCCESS !== undefined) {
                isSuccess = process.env.TEST_PAYMENT_SUCCESS === 'true';
            }
            if (process.env.TEST_PROCESSING_DELAY !== undefined) {
                processingDelay = parseInt(process.env.TEST_PROCESSING_DELAY, 10);
            }
        }

        const generatedPaymentId = `pay_${Math.random().toString(36).substring(2, 18)}`;

        // Step 1: Insert Payment as "processing"
        const insertResult = await pool.query(
            `INSERT INTO payments 
            (id, order_id, merchant_id, amount, currency, status, method, card_last4, card_network, created_at)
            VALUES 
            ($1, $2, $3, $4, $5, 'processing', $6, $7, $8, NOW()) 
            RETURNING *`,
            [
                generatedPaymentId,
                order_id,
                req.merchant.id,
                paymentAmount,
                currency || 'INR',
                method,
                card_last4,
                card_network
            ]
        );

        const payment = insertResult.rows[0];

        // Send immediate response with "processing" status
        res.status(201).json({
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            method: payment.method
        });

        // Step 2: Simulate Delay & Update to Final State (Async)
        setTimeout(async () => {
            const finalStatus = isSuccess ? 'success' : 'failed';
            let errorCode = null;
            let errorDesc = null;

            if (finalStatus === 'failed') {
                errorCode = 'PAYMENT_FAILED';
                errorDesc = 'The payment could not be processed due to a bank decline.';
            }

            try {
                await pool.query(
                    `UPDATE payments 
                     SET status = $1, error_code = $2, error_description = $3 
                     WHERE id = $4`,
                    [finalStatus, errorCode, errorDesc, generatedPaymentId]
                );
                // In a real application, you might trigger a webhook here
            } catch (err) {
                console.error("Async Save Error:", err);
            }
        }, processingDelay);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: 'SERVER_ERROR', description: 'Internal Server Error' } });
    }
});

// 2. GET PAYMENT STATUS (GET /api/v1/payments/:id)
router.get('/:id', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
            [req.params.id, req.merchant.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Payment not found' } });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: 'SERVER_ERROR', description: 'Internal Server Error' } });
    }
});

// 3. GET ALL PAYMENTS (GET /api/v1/payments) - For Dashboard
router.get('/', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM payments WHERE merchant_id = $1 ORDER BY created_at DESC',
            [req.merchant.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: 'SERVER_ERROR', description: 'Database error' } });
    }
});

module.exports = router;