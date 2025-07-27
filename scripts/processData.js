require('dotenv').config({ path: '../.env' });
console.log('VRF_SECRET_KEY from .env:', process.env.VRF_SECRET_KEY);

const pool = require('../backend/database');
const vrfHandler = require('./vrfHandler');

async function processNewData() {
    console.log('🚀 Starting processData.js');
    console.log('🔄 Running VRF Batch Processing...');

    const newSegments = [
        { "temperature": 40, "humidity": 80 }
    ];

    console.log(`📦 Segments to process: ${newSegments.length}`);

    for (const segment of newSegments) {
        console.log(`🔐 Generating VRF for segment:`, segment);

        const { segmentHash, fingerprint, secretKey } = await vrfHandler.generateVRF(segment);
        console.log("✅ VRF Output:", { segmentHash, fingerprint, secretKey });

        const existing = await pool.query(
            'SELECT * FROM time_series_vrf WHERE segment_hash = $1',
            [segmentHash]
        );

        if (existing.rows.length > 0) {
            console.log(`⚠️ Skipping duplicate segment: ${segmentHash}`);
            continue;
        }

        console.log(`📝 Storing VRF data in PostgreSQL...`);

        await pool.query(
            'INSERT INTO time_series_vrf (segment_hash, vrf_fingerprint, secret_key) VALUES ($1, $2, $3)',
            [segmentHash, fingerprint, secretKey]
        );

        console.log(`✅ Processed Segment: ${segmentHash}`);
    }
}

processNewData().catch((err) => {
    console.error("❌ Error in processing data:", err);
});