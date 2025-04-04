const pool = require('../backend/database');
const vrfHandler = require('./vrfHandler');
const cron = require('node-cron');

async function processNewData() {
    console.log('🔄 Running VRF Batch Processing...');
    
    try {
        // Simulate fetching new time-series data
        console.log('📡 Fetching new segments...');
        const newSegments = [
            { temperature: 25.4, humidity: 78 },
            { temperature: 27.0, humidity: 80 }
        ];
        console.log(`📦 Segments to process: ${newSegments.length}`);
        
        for (const segment of newSegments) {
            console.log('🔐 Generating VRF for segment:', segment);
            const { segmentHash, fingerprint, publicKey } = await vrfHandler.generateVRF(segment);
            
            console.log('📝 Storing VRF data in PostgreSQL...');
            await pool.query(
                'INSERT INTO time_series_vrf (segment_hash, vrf_fingerprint, secret_key) VALUES ($1, $2, $3)',
                [segmentHash, fingerprint, publicKey]
            );
            
            console.log(`✅ Segment processed successfully:\n- segmentHash: ${segmentHash}\n- fingerprint: ${fingerprint}`);
        }
        
        console.log('🎉 All segments processed!');
    } catch (error) {
        console.error('❌ Error during batch processing:', error.message);
    }
}

// Run once immediately for testing
processNewData();

// Schedule to run every hour
cron.schedule('0 * * * *', () => {
    console.log('⏰ Scheduled job triggered.');
    processNewData();
});

console.log('⏳ Batch processing script started and waiting for scheduled job...');