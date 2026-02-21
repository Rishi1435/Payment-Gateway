const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// Helper to generate random alphanumeric string
const generateId = (prefix) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix + result; // e.g., order_NXhj67fGH2jk9mPq
};

// CREATE ORDER
router.post('/', authenticate, async (req, res) => {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    // Validation [cite: 40]
    if (!amount || amount < 100) {
        return res.status(400).json({
            error: { code: 'BAD_REQUEST_ERROR', description: 'amount must be at least 100' }
        });
    }

    const orderId = generateId('order_');
    const merchantId = req.merchant.id;

    try {
        const result = await pool.query(
            `INSERT INTO orders (id, merchant_id, amount, currency, receipt, notes, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'created')
             RETURNING *`,
            [orderId, merchantId, amount, currency, receipt, notes]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: 'SERVER_ERROR', description: 'Database error' } });
    }
});

// GET ORDER
router.get('/:id', authenticate, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: { code: 'NOT_FOUND_ERROR', description: 'Order not found' }
            });
        }

        const order = result.rows[0];

        // Authorization validation: Check if this order belongs to the requester
        if (order.merchant_id !== req.merchant.id) {
            return res.status(404).json({
                error: { code: 'NOT_FOUND_ERROR', description: 'Order not found' } // Use 404 to avoid leaking existence
            });
        }

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: { code: 'SERVER_ERROR', description: 'Database error' } });
    }
});

// PUBLIC GET ORDER (For Checkout Page)
router.get('/:id/public', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, amount, currency, status FROM orders WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: { code: 'NOT_FOUND_ERROR', description: 'Order not found' }
            });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: { code: 'SERVER_ERROR', description: 'Database error' } });
    }
});

module.exports = router;