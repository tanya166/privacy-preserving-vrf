require('dotenv').config({ path: '../.env' });
const pool = require('../database');
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

async function processDataWithUserKey(dataSegments, contractAddress, privateKey, rpcUrl, userVrfPrivateKey) {
    console.log('🔄 Processing data with USER-PROVIDED VRF key...');
    console.log('🔑 User VRF key will be used for fingerprint generation');
    console.log('🔐 User VRF key will be encrypted and stored in vrf_keys table');

    const contract = await initializeContract(contractAddress, privateKey, rpcUrl);
    console.log(`📦 Segments to process: ${dataSegments.length}`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results = [];
    const errors = [];

    for (let i = 0; i < dataSegments.length; i++) {
        const segment = dataSegments[i];
        console.log(`\n🔐 Processing segment ${i + 1}/${dataSegments.length} with USER VRF key:`, segment);

        try {
            const vrfResult = await vrfHandler.generateVRFWithKey(segment, userVrfPrivateKey);
            
            const { 
                originalData, 
                standardizedData, 
                segmentHash, 
                fingerprint, 
                secretKey, 
                walletAddress 
            } = vrfResult;
            
            console.log("✅ VRF Output using USER key:", { 
                originalData: originalData,
                standardizedData: standardizedData,
                segmentHash: segmentHash, 
                fingerprint: fingerprint.substring(0, 10) + '...', 
                walletAddress: walletAddress,
                userKeyUsed: true
            });

            const hashedFingerprint = ethers.keccak256(fingerprint);
            console.log(`🔨 Hashed fingerprint for blockchain: ${hashedFingerprint}`);

            const existing = await pool.query(
                'SELECT * FROM time_series_vrf WHERE segment_hash = $1',
                [segmentHash]
            );

            if (existing.rows.length > 0) {
                console.log(`⚠️ Skipping duplicate segment: ${segmentHash}`);
                skippedCount++;
                
                results.push({
                    originalData: originalData,
                    standardizedData: standardizedData,
                    segmentHash,
                    status: 'ALREADY_EXISTS',
                    message: 'Data already stored'
                });
                continue;
            }

            // STEP 4: Store VRF data in PostgreSQL
            console.log(`📝 Storing VRF data in PostgreSQL...`);
            
            await pool.query(
                `INSERT INTO time_series_vrf 
                 (segment_hash, vrf_fingerprint, secret_key, timestamp) 
                 VALUES ($1, $2, $3, NOW())`,
                [
                    segmentHash, 
                    fingerprint, 
                    secretKey
                ]
            );
            
            console.log(`✅ VRF data stored in PostgreSQL`);

            // STEP 5: Store hashed fingerprint in smart contract
            console.log(`🔗 Storing hashed VRF fingerprint in smart contract...`);
            
            const tx = await contract.storeFingerprint(segmentHash, hashedFingerprint);
            console.log(`⏳ Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);

            console.log(`✅ Processed Segment: ${segmentHash}`);
            processedCount++;
            
            results.push({
                originalData: originalData,
                standardizedData: standardizedData,
                segmentHash,
                originalFingerprint: fingerprint,
                hashedFingerprint,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                status: 'SUCCESS',
                message: 'Data successfully stored using user VRF key',
                keySource: 'User-provided VRF private key'
            });

        } catch (error) {
            console.error(`❌ Error processing segment ${i + 1}:`, error);
            errorCount++;
            
            // Rollback database entry if blockchain storage failed
            try {
                let vrfResult = await vrfHandler.generateVRFWithKey(segment, userVrfPrivateKey);
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
    console.log('🎉 Batch processing completed using USER VRF key!');
    
    return {
        success: errorCount === 0,
        summary: {
            total: dataSegments.length,
            successful: processedCount,
            skipped: skippedCount,
            errors: errorCount
        },
        results,
        errors: errors.length > 0 ? errors : undefined,
        workflow: {
            keyUsed: 'User-provided VRF private key',
            storage: 'User key encrypted and stored in vrf_keys table',
            verification: 'Will use stored encrypted key from database'
        }
    };
}

// ORIGINAL: Process data using environment VRF key (kept for backward compatibility)
async function processData(dataSegments, contractAddress, privateKey, rpcUrl, vrfPrivateKey = null) {
    console.log('🔄 Running VRF Batch Processing with standardized name + value format...');
    
    const useCustomVRFKey = vrfPrivateKey !== null;
    
    if (useCustomVRFKey) {
        console.log('🔑 Using custom VRF private key');
        // If custom key provided, use the new function
        return await processDataWithUserKey(dataSegments, contractAddress, privateKey, rpcUrl, vrfPrivateKey);
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
            // Use environment VRF key
            const vrfResult = await vrfHandler.generateVRF(segment, contractAddress);
            
            const { 
                originalData, 
                standardizedData, 
                segmentHash, 
                fingerprint, 
                signerAddress 
            } = vrfResult;
            
            console.log("✅ VRF Output:", { 
                originalData: originalData,
                standardizedData: standardizedData,
                segmentHash: segmentHash, 
                fingerprint: fingerprint.substring(0, 10) + '...', 
                signerAddress: signerAddress
            });

            const hashedFingerprint = ethers.keccak256(fingerprint);
            console.log(`🔨 Converted fingerprint to 32 bytes: ${hashedFingerprint}`);

            const existing = await pool.query(
                'SELECT * FROM time_series_vrf WHERE segment_hash = $1',
                [segmentHash]
            );

            if (existing.rows.length > 0) {
                console.log(`⚠️ Skipping duplicate segment: ${segmentHash}`);
                skippedCount++;
                
                results.push({
                    originalData: originalData,
                    standardizedData: standardizedData,
                    segmentHash,
                    status: 'ALREADY_EXISTS',
                    message: 'Data already stored'
                });
                continue;
            }

            console.log(`📝 Storing VRF data in PostgreSQL...`);
            
            await pool.query(
                `INSERT INTO time_series_vrf 
                 (segment_hash, vrf_fingerprint, secret_key, timestamp) 
                 VALUES ($1, $2, $3, NOW())`,
                [
                    segmentHash, 
                    fingerprint, 
                    process.env.VRF_SECRET_KEY // Use env key
                ]
            );
            
            console.log(`✅ VRF data stored in PostgreSQL`);

            console.log(`🔗 Storing VRF fingerprint in smart contract...`);
            
            const tx = await contract.storeFingerprint(segmentHash, hashedFingerprint);
            console.log(`⏳ Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);

            console.log(`✅ Processed Segment: ${segmentHash}`);
            processedCount++;
            
            results.push({
                originalData: originalData,
                standardizedData: standardizedData,
                segmentHash,
                originalFingerprint: fingerprint,
                hashedFingerprint,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                status: 'SUCCESS',
                message: 'Data successfully stored using environment VRF key'
            });

        } catch (error) {
            console.error(`❌ Error processing segment ${i + 1}:`, error);
            errorCount++;
            
            try {
                let vrfResult = await vrfHandler.generateVRF(segment, contractAddress);
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
    console.log('🚀 Starting processData.js with standardized name + value format');
    
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
        console.log('💡 Data format: [{"name": "Temperature Reading", "value": 25.5}, ...]');
        process.exit(1);
    }

    try {
        const result = await processData(newSegments, CONTRACT_ADDRESS, PRIVATE_KEY, RPC_URL);
        
        if (result.success) {
            console.log('🎉 All data processed successfully using standardized format!');
            console.log('💡 For verification, users only need to provide: {"name": "...", "value": "..."}');
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
    processData,                // Original function (uses env VRF key or custom key)
    processDataWithUserKey,     // NEW: Specifically for user-provided VRF keys
    loadDataFromFile,      
    initializeContract     
};

if (require.main === module) {
    processNewDataFromFile().catch((err) => {
        console.error("❌ Error in processing data:", err);
        process.exit(1);
    });
}