require('dotenv').config({ path: '../.env' });
const pool = require('../backend/database');
const vrfHandler = require('./vrfHandler');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const CONTRACT_ABI = [
    "function storeFingerprint(bytes32 segmentHash, bytes32 vrfFingerprint) public",
    "function verifyFingerprint(bytes32 segmentHash, bytes32 claimedFingerprint) public view returns (bool)",
    "function getFingerprint(bytes32 segmentHash) public view returns (bytes32 vrfFingerprint, uint256 timestamp, bool exists)",
    "function fingerprintExists(bytes32 segmentHash) public view returns (bool)"
];

async function initializeContract(contractAddress, privateKey, rpcUrl) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    return contract;
}

function loadDataFromFile(filePath) {
    try {
       
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

       
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileContent);
        
        
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        console.log(`📄 Loaded ${dataArray.length} data segments from: ${filePath}`);
        return dataArray;
        
    } catch (error) {
        throw new Error(`Failed to load data from file: ${error.message}`);
    }
}

async function processData(dataSegments, contractAddress, privateKey, rpcUrl, vrfPrivateKey = null) {
    console.log('🔄 Running VRF Batch Processing...');
    
    const useCustomVRFKey = vrfPrivateKey !== null;
    
    if (useCustomVRFKey) {
        console.log('🔑 Using custom VRF private key');
    } else {
        console.log('🔑 Using environment VRF key (.env file)');
    }

    const contract = await initializeContract(contractAddress, privateKey, rpcUrl);

    console.log(`📦 Segments to process: ${dataSegments.length}`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results = [];
    const errors = [];

    for (let i = 0; i < dataSegments.length; i++) {
        const segment = dataSegments[i];
        console.log(`\n🔐 Processing segment ${i + 1}/${dataSegments.length}:`, segment);

        try {
            let vrfResult;
            
            if (useCustomVRFKey) {
                vrfResult = await vrfHandler.generateVRFWithKey(segment, vrfPrivateKey);
            } else {
                vrfResult = await vrfHandler.generateVRF(segment);
            }
            
            const { segmentHash, fingerprint, secretKey, walletAddress } = vrfResult;
            
            console.log("✅ VRF Output:", { 
                segmentHash, 
                fingerprint: fingerprint.substring(0, 10) + '...', 
                walletAddress: walletAddress || 'N/A',
                secretKey: secretKey.substring(0, 10) + '...' 
            });

           
            const hashedFingerprint = ethers.keccak256(fingerprint);
            console.log(`🔨 Converted fingerprint from ${fingerprint.length - 2} chars to 32 bytes: ${hashedFingerprint}`);

            const existing = await pool.query(
                'SELECT * FROM time_series_vrf WHERE segment_hash = $1',
                [segmentHash]
            );

            if (existing.rows.length > 0) {
                console.log(`⚠️ Skipping duplicate segment: ${segmentHash}`);
                skippedCount++;
                
                results.push({
                    segment,
                    segmentHash,
                    status: 'ALREADY_EXISTS',
                    message: 'Data already stored'
                });
                continue;
            }

            console.log(`📝 Storing VRF data in PostgreSQL...`);
            
            await pool.query(
                'INSERT INTO time_series_vrf (segment_hash, vrf_fingerprint, secret_key) VALUES ($1, $2, $3)',
                [segmentHash, fingerprint, secretKey]
            );

            console.log(`🔗 Storing VRF fingerprint in smart contract...`);
            
            const tx = await contract.storeFingerprint(segmentHash, hashedFingerprint);
            console.log(`⏳ Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);

            console.log(`✅ Processed Segment: ${segmentHash}`);
            processedCount++;
            
            results.push({
                segment,
                segmentHash,
                originalFingerprint: fingerprint,
                hashedFingerprint,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                status: 'SUCCESS',
                message: 'Data successfully stored on blockchain'
            });

        } catch (error) {
            console.error(`❌ Error processing segment ${i + 1}:`, error);
            errorCount++;
            
            try {
                let vrfResult;
                if (useCustomVRFKey) {
                    vrfResult = await vrfHandler.generateVRFWithKey(segment, vrfPrivateKey);
                } else {
                    vrfResult = await vrfHandler.generateVRF(segment);
                }
                
                await pool.query('DELETE FROM time_series_vrf WHERE segment_hash = $1', [vrfResult.segmentHash]);
                console.log(`🔄 Rolled back database entry for ${vrfResult.segmentHash}`);
            } catch (rollbackError) {
                console.error(`❌ Failed to rollback database entry:`, rollbackError);
            }
            
            errors.push({
                segment,
                error: error.message,
                index: i + 1
            });
        }
    }

    console.log('\n📊 Processing Summary:');
    console.log(`   Total segments: ${dataSegments.length}`);
    console.log(`   Successfully processed: ${processedCount}`);
    console.log(`   Skipped (duplicates): ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('🎉 Batch processing completed!');
    
    return {
        success: errorCount === 0,
        summary: {
            total: dataSegments.length,
            successful: processedCount,
            skipped: skippedCount,
            errors: errorCount
        },
        results,
        errors: errors.length > 0 ? errors : undefined
    };
}

async function processNewDataFromFile() {
    console.log('🚀 Starting processData.js from command line');
    
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const RPC_URL = process.env.POLYGON_RPC;
    
    console.log('🔍 Environment check:');
    console.log('CONTRACT_ADDRESS:', CONTRACT_ADDRESS);
    console.log('RPC_URL:', RPC_URL);
    console.log('PRIVATE_KEY:', PRIVATE_KEY ? 'defined' : 'undefined');

    if (!CONTRACT_ADDRESS || !PRIVATE_KEY || !RPC_URL) {
        console.error('❌ Missing required environment variables: CONTRACT_ADDRESS, PRIVATE_KEY, POLYGON_RPC');
        process.exit(1);
    }


    const jsonFilePath = process.argv[2] || path.join(__dirname, 'data.json');
    
    let newSegments;
    try {
        newSegments = loadDataFromFile(jsonFilePath);
    } catch (error) {
        console.error('❌ Failed to load data:', error.message);
        console.log('💡 Usage: node processData.js [path/to/your/data.json]');
        console.log('💡 Or create a "data.json" file in the same directory as this script');
        process.exit(1);
    }

    try {
        const result = await processData(newSegments, CONTRACT_ADDRESS, PRIVATE_KEY, RPC_URL);
        
        if (result.success) {
            console.log('🎉 All data processed successfully!');
            process.exit(0);
        } else {
            console.log(`⚠️ Processing completed with ${result.summary.errors} errors`);
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ Fatal error in processing data:", error);
        process.exit(1);
    }
}

module.exports = {
    processData,           
    loadDataFromFile,      
    initializeContract     
};

if (require.main === module) {
    processNewDataFromFile().catch((err) => {
        console.error("❌ Error in processing data:", err);
        process.exit(1);
    });
}