require('dotenv').config({ path: '../.env' });
const vrfHandler = require('./vrfHandler');
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.POLYGON_RPC; 

const CONTRACT_ABI = [
    "function storeFingerprint(bytes32 segmentHash, bytes32 vrfFingerprint) public",
    "function verifyFingerprint(bytes32 segmentHash, bytes32 claimedFingerprint) public view returns (bool)",
    "function getFingerprint(bytes32 segmentHash) public view returns (bytes32 vrfFingerprint, uint256 timestamp, bool exists)",
    "function fingerprintExists(bytes32 segmentHash) public view returns (bool)"
];

async function initializeContract() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    return contract;
}

async function verifyDataIntegrity(inputData) {
    console.log('🔍 Starting blockchain verification...');
    console.log('📊 Input data:', inputData);
    
    try {
        // Step 1: Generate VRF fingerprint for the input data
        console.log('🔐 Generating VRF fingerprint...');
        const { segmentHash, fingerprint } = await vrfHandler.generateVRF(inputData);
        console.log(`✅ Generated segmentHash: ${segmentHash}`);
        console.log(`✅ Generated fingerprint: ${fingerprint}`);
        
        const hashedFingerprint = ethers.keccak256(fingerprint);
        console.log(`🔨 Hashed fingerprint (32 bytes): ${hashedFingerprint}`);
        
        const contract = await initializeContract();
        console.log('🔗 Connected to smart contract');
        
        console.log('🔍 Checking blockchain...');
        const existsOnChain = await contract.fingerprintExists(segmentHash);
        console.log(`📋 Exists on blockchain: ${existsOnChain}`);
        
        if (existsOnChain) {
            const isValidOnChain = await contract.verifyFingerprint(segmentHash, hashedFingerprint);
            console.log(`✅ Blockchain verification: ${isValidOnChain ? 'PASSED' : 'FAILED'}`);
            
            const [storedFingerprint, timestamp, exists] = await contract.getFingerprint(segmentHash);
            const storedDate = new Date(Number(timestamp) * 1000);
            console.log(`📅 Originally stored: ${storedDate.toISOString()}`);
            console.log(`🔒 Stored fingerprint: ${storedFingerprint}`);
            
            return {
                segmentHash,
                originalFingerprint: fingerprint,
                hashedFingerprint,
                existsOnChain,
                contractVerification: isValidOnChain,
                isVerified: isValidOnChain,
                chainTimestamp: storedDate,
                status: isValidOnChain ? 'VERIFIED' : 'VERIFICATION_FAILED'
            };
            
        } else {
            console.log('❌ Data not found on blockchain');
            
            return {
                segmentHash,
                originalFingerprint: fingerprint,
                hashedFingerprint,
                existsOnChain: false,
                contractVerification: false,
                isVerified: false,
                chainTimestamp: null,
                status: 'NOT_FOUND_ON_CHAIN'
            };
        }
        
    } catch (error) {
        console.error('❌ Verification error:', error);
        return {
            error: error.message,
            status: 'ERROR'
        };
    }
}

async function verifyMultipleData(dataArray) {
    console.log(`🔍 Verifying ${dataArray.length} data entries on blockchain...\n`);
    
    const results = [];
    for (let i = 0; i < dataArray.length; i++) {
        console.log(`\n--- Verifying Entry ${i + 1}/${dataArray.length} ---`);
        const result = await verifyDataIntegrity(dataArray[i]);
        results.push(result);
        
        if (result.status === 'VERIFIED') {
            console.log('🎉 BLOCKCHAIN VERIFICATION SUCCESSFUL');
        } else if (result.status === 'NOT_FOUND_ON_CHAIN') {
            console.log('⚠️ DATA NOT FOUND ON BLOCKCHAIN');
        } else {
            console.log('❌ BLOCKCHAIN VERIFICATION FAILED');
        }
    }
    

    const verified = results.filter(r => r.status === 'VERIFIED').length;
    const notFound = results.filter(r => r.status === 'NOT_FOUND_ON_CHAIN').length;
    const failed = results.filter(r => r.status === 'VERIFICATION_FAILED').length;
    const errors = results.filter(r => r.status === 'ERROR').length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 BLOCKCHAIN VERIFICATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Verified on blockchain: ${verified}`);
    console.log(`⚠️ Not found on blockchain: ${notFound}`);
    console.log(`❌ Failed verification: ${failed}`);
    console.log(`🚨 Errors: ${errors}`);
    console.log(`📈 Total processed: ${results.length}`);
    
    return results;
}

// Main function with your specific data
async function main() {
    const newSegments = [
        { "temperature": 13, "humidity": 80 }
    ];
    
    console.log('🧪 Verifying your data on blockchain:\n');
    await verifyMultipleData(newSegments);
}

// Export functions for use in other modules
module.exports = {
    verifyDataIntegrity,
    verifyMultipleData,
    initializeContract
};

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}