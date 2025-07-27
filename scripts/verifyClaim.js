const pool = require('../backend/database');
const vrfHandler = require('./vrfHandler');

async function verifyClaim(testData) {
  try {
    const result = await vrfHandler.generateVRF(testData);
    const { segmentHash, fingerprint } = result;

    console.log(`🔍 Verifying segment for data:`, testData);
    console.log(`🔐 Recomputed Segment Hash: ${segmentHash}`);
    console.log(`🔐 Recomputed Fingerprint: ${fingerprint}`);
    const query = `
      SELECT * FROM time_series_vrf 
      WHERE segment_hash = $1 AND vrf_fingerprint = $2
    `;
    const values = [segmentHash, fingerprint];
    const res = await pool.query(query, values);

    if (res.rows.length > 0) {
      console.log("✅ Verification successful! This data existed and matches the stored fingerprint.");
      console.log("📊 Found record:", res.rows[0]);
    } else {
      console.log("❌ Verification failed. No matching fingerprint found for this data.");
      
      const debugQuery = `SELECT * FROM time_series_vrf WHERE segment_hash = $1`;
      const debugRes = await pool.query(debugQuery, [segmentHash]);
      
      if (debugRes.rows.length > 0) {
        console.log("🔍 Found segment with different fingerprint:");
        console.log("   Stored fingerprint:", debugRes.rows[0].vrf_fingerprint);
        console.log("   Computed fingerprint:", fingerprint);
        console.log("   Match:", debugRes.rows[0].vrf_fingerprint === fingerprint);
      } else {
        console.log("🔍 No segment found with this hash in database");
      }
    }

    pool.end();
  } catch (err) {
    console.error("💥 Error during verification:", err);
  }
}

const testClaim = {
  temperature: 10,
  humidity: 80
};

verifyClaim(testClaim);
