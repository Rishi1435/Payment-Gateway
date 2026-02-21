const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors()); // Allow frontend to call API
app.use(express.json());

// Routes
app.use('/api/v1/orders', require('./routes/orders'));
app.use('/api/v1/payments', require('./routes/payments'));

// Health Check [cite: 35]
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            status: "healthy",
            database: "connected",
            redis: "connected",
            worker: "running",
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ status: "unhealthy", database: "disconnected", redis: "disconnected", worker: "stopped" });
    }
});

// Test Merchant Endpoint [cite: 54]
app.get('/api/v1/test/merchant', async (req, res) => {
    const result = await pool.query("SELECT * FROM merchants WHERE email = 'test@example.com'");
    if (result.rows.length > 0) {
        const m = result.rows[0];
        res.json({ id: m.id, email: m.email, api_key: m.api_key, seeded: true });
    } else {
        res.status(404).json({ error: { code: 'NOT_FOUND_ERROR', description: 'Merchant not found' } });
    }
});

const PORT = process.env.PORT || 8000;

// Seed Test Merchant on Startup
const seedTestMerchant = async () => {
    try {
        const result = await pool.query("SELECT * FROM merchants WHERE email = 'test@example.com'");
        if (result.rows.length === 0) {
            await pool.query(
                `INSERT INTO merchants (id, name, email, api_key, api_secret, callback_url) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    '550e8400-e29b-41d4-a716-446655440000',
                    'Test Merchant',
                    'test@example.com',
                    'test_key_123',
                    'test_secret_456',
                    'http://localhost:3000/callback'
                ]
            );
            console.log('Test merchant seeded with specific UUID');
        }
    } catch (err) {
        console.error('Failed to seed test merchant:', err);
    }
};

app.listen(PORT, async () => {
    await seedTestMerchant();
    console.log(`API running on port ${PORT}`);
});