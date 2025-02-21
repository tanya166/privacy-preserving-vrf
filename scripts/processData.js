const pool = require('../backend/db');
const vrfHandler = require('./vrfHandler');
const cron = require('node-cron');

async function processNewData() {
    console.log('🔄 Running VRF Batch Processing...');
    
    // Fetch new time-series data from an API or data source
    const newSegments = [
        { temperature: 25.4, humidity: 78 },
        { temperature: 27.0, humidity: 80 }
    ];

    for (const segment of newSegments) {
        const { segmentHash, fingerprint, secretKey } = await vrfHandler.generateVRF(segment);
        
        await pool.query(
            'INSERT INTO time_series_vrf (segment_hash, vrf_fingerprint, secret_key) VALUES ($1, $2, $3)',
            [segmentHash, fingerprint, secretKey]
        );

        console.log(`✅ Processed Segment: ${segmentHash}`);
    }
}

// Schedule to run every hour
cron.schedule('0 * * * *', processNewData);

console.log('⏳ Batch processing script started...');
