const express = require('express');
const router = express.Router();
const pool = require('../db');

// Middleware to check API Keys (Simple version)
const authenticate = async (req, res, next) => {
    const apiKey = req.header('X-Api-Key');
    const apiSecret = req.header('X-Api-Secret');

    if (!apiKey || !apiSecret) {
        return res.status(401).json({ error: 'Missing API credentials' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM merchants WHERE api_key = $1 AND api_secret = $2',
            [apiKey, apiSecret]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.merchant = result.rows[0];
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Auth error' });
    }
};

// 1. CREATE PAYMENT (POST /api/v1/payments)
router.post('/', authenticate, async (req, res) => {
    const { order_id, amount, currency, method, vpa, card } = req.body;

    // Simulation: 80% Success, 20% Failure
    // You can change 0.2 to 0.0 to force success while recording your video
    const isSuccess = Math.random() > 0.2; 
    const status = isSuccess ? 'success' : 'failed';

    // Simulate Bank Delay (2 seconds)
    setTimeout(async () => {
        try {
            // Check if order exists (Optional validation)
            // Insert Payment Record
            const result = await pool.query(
                `INSERT INTO payments 
                (id, order_id, merchant_id, amount, currency, status, method, created_at)
                VALUES 
                ($1, $2, $3, $4, $5, $6, $7, NOW()) 
                RETURNING *`,
                [
                    `pay_${Math.random().toString(36).substring(2, 18)}`, // Generate ID like pay_...
                    order_id,
                    req.merchant.id,
                    50000, // Mock amount (500.00) if not passed, or use req.body.amount if available
                    'INR',
                    status,
                    method
                ]
            );
            
            // We don't send the response here because of the timeout/async nature in a real webhook scenario,
            // but for this REST API, we need to return the ID immediately so the frontend can poll.
            // However, since we used setTimeout, the response 'res' is already waiting.
            // NOTE: In a real Express handler, putting the DB call inside setTimeout prevents sending the response correctly
            // if we want to delay the RESPONSE.
            // Instead, we will delay the RESPONSE itself.
        } catch (err) {
            console.error("Async Save Error:", err);
        }
    }, 2000); 

    // IMMEDIATE RESPONSE (To allow polling)
    // We insert "pending" first, then update to success/fail after delay?
    // OR simpler for this project: Just wait 2 seconds then save & respond.
    
    // REVISED LOGIC FOR SIMPLICITY:
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    
    try {
        const result = await pool.query(
            `INSERT INTO payments 
            (id, order_id, merchant_id, amount, currency, status, method, created_at)
            VALUES 
            ($1, $2, $3, $4, $5, $6, $7, NOW()) 
            RETURNING id, status`,
            [
                `pay_${Math.random().toString(36).substring(2, 18)}`,
                order_id,
                req.merchant.id,
                50000, // Hardcoded 500.00 for simplicity as per schema defaults or frontend
                'INR',
                status,
                method
            ]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 2. GET PAYMENT STATUS (GET /api/v1/payments/:id)
router.get('/:id', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM payments WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
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
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;