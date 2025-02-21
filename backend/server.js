const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const vrfHandler = require('../scripts/vrfHandler');
const pool = require('./db');

dotenv.config();
const app = express();
app.use(bodyParser.json());

app.post('/process-data', async (req, res) => {
    try {
        const { segmentData } = req.body;
        const { segmentHash, fingerprint, secretKey } = await vrfHandler.generateVRF(segmentData);

        await pool.query(
            'INSERT INTO time_series_vrf (segment_hash, vrf_fingerprint, secret_key) VALUES ($1, $2, $3)',
            [segmentHash, fingerprint, secretKey]
        );

        res.json({ segmentHash, fingerprint });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
