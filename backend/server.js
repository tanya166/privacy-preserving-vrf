const dotenv = require("dotenv"); // Import dotenv
dotenv.config({ path: "../.env" }); // Load .env file
const express = require('express');
const bodyParser = require('body-parser');
const { Contract, JsonRpcProvider } = require('ethers');

const vrfHandler = require('../scripts/vrfHandler');
const pool = require('./database'); // Use 'database' instead of 'db'


dotenv.config();
const app = express();
app.use(bodyParser.json());

// 🔹 Initialize Blockchain Connection
const contractABI = require('../artifacts/contracts/VRFStorage.sol/VRFStorage.json').abi;
const provider = new JsonRpcProvider(process.env.POLYGON_RPC);
const contract = new Contract(process.env.CONTRACT_ADDRESS, contractABI, provider);

app.post('/process-data', async (req, res) => {
    try {
        console.log("Received request at /process-data:", req.body); // Debugging input data
        const { segmentData } = req.body;
        
        const { segmentHash, fingerprint, secretKey } = await vrfHandler.generateVRF(segmentData);
        console.log("Generated VRF Data:", { segmentHash, fingerprint, secretKey }); // Debugging generated data

        // Store in PostgreSQL
        await pool.query(
            'INSERT INTO time_series_vrf (segment_hash, vrf_fingerprint, secret_key) VALUES ($1, $2, $3)',
            [segmentHash, fingerprint, secretKey]
        );
        console.log("Stored in PostgreSQL successfully");

        res.json({ segmentHash, fingerprint });
    } catch (error) {
        console.error("Error in /process-data:", error); // Debugging error
        res.status(500).json({ error: error.message });
    }
});

// 🔹 Step 2: Verify VRF Data on Blockchain
app.get('/verify', async (req, res) => {
    try {
        console.log("Received request at /verify:", req.query); // Debugging input query
        const { segmentHash } = req.query;

        // Fetch VRF fingerprint from PostgreSQL
        const result = await pool.query('SELECT vrf_fingerprint FROM time_series_vrf WHERE segment_hash = $1', [segmentHash]);
        if (result.rowCount === 0) {
            console.warn("Segment not found in database:", segmentHash);
            return res.status(404).json({ error: 'Segment not found' });
        }

        const claimedFingerprint = result.rows[0].vrf_fingerprint;
        console.log("Retrieved VRF Fingerprint from DB:", claimedFingerprint); // Debugging DB response

        // Verify on Blockchain
        const storedFingerprint = await contract.verifyFingerprint(segmentHash, claimedFingerprint);
        console.log("Blockchain Verification Result:", storedFingerprint); // Debugging blockchain result

        res.json({ verified: storedFingerprint });
    } catch (error) {
        console.error("Error in /verify:", error); // Debugging error
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = server; 
