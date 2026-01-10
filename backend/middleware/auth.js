const pool = require('../db');

const authenticate = async (req, res, next) => {
    // 1. Get headers
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    if (!apiKey || !apiSecret) {
        return res.status(401).json({
            error: { code: 'AUTHENTICATION_ERROR', description: 'Missing API credentials' }
        });
    }

    try {
        // 2. Check database for matching merchant
        const result = await pool.query(
            'SELECT * FROM merchants WHERE api_key = $1 AND api_secret = $2',
            [apiKey, apiSecret]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: { code: 'AUTHENTICATION_ERROR', description: 'Invalid API credentials' }
            });
        }

        // 3. Attach merchant to request so we can use it later
        req.merchant = result.rows[0];
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = authenticate;