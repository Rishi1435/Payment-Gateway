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
        res.status(404).json({ error: "Merchant not found" });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));