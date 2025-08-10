require('dotenv').config({ path: '../.env' });
const vrfHandler = require('./vrfHandler');
const { ethers } = require('ethers');

// ✅ FIX: Import the compilation function to get correct ABI
const { compileSolidityContract } = require('./path/to/your/deploy.js'); // Update this path

// ✅ FIX: Get the correct ABI dynamically
function getContractABI() {
    try {
        const compilationResult = compileSolidityContract();
        console.log(`✅ ABI compiled successfully (${compilationResult.abi.length} items)`);
        return compilationResult.abi;
    } catch (error) {
        console.error('❌ Failed to compile contract for ABI:', error.message);
        // Fallback to minimal ABI if compilation fails
        return [
            "function storeFingerprint(bytes32 segmentHash, bytes32 vrfFingerprint) public",
            "function verifyFingerprint(bytes32 segmentHash, bytes32 claimedFingerprint) public view returns (bool)",
            "function getFingerprint(bytes32 segmentHash) public view returns (bytes32 vrfFingerprint, uint256 timestamp, bool exists)",
            "function fingerprintExists(bytes32 segmentHash) public view returns (bool)",
            "function owner() public view returns (address)"
        ];
    }
}

async function initializeContract(contractAddress, privateKey, rpcUrl) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Get the correct ABI
    const CONTRACT_ABI = getContractABI();
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    return contract;
}

/**
 * FIXED: Verify data integrity using stored VRF key from vrf_keys table
 * @param {string} name - The name field entered by user
 * @param {string|number} value - The value field entered by user
 * @param {string} contractAddress - Smart contract address to retrieve key from vrf_keys table
 */
async function verifyDataIntegrity(name, value, contractAddress) {
    console.log('🔍 Starting blockchain verification using STORED VRF key from vrf_keys table...');
    console.log('📊 User input - Name:', name, 'Value:', value);
    console.log('🏢 Contract Address:', contractAddress);
    
    try {
        // Step 1: Reconstruct the data object using only name and value
        const reconstructedData = {
            name: name,
            value: value
        };
        
        console.log('🔄 Reconstructed data object:', reconstructedData);
        
        // Step 2: Check if VRF key exists for this contract in vrf_keys table
        const keyCheck = await vrfHandler.checkVRFKeyExists(contractAddress);
        if (!keyCheck.exists) {
            return {
                userInput: { name, value },
                reconstructedData,
                contractAddress,
                status: 'NO_VRF_KEY',
                error: `No VRF key found for contract ${contractAddress}. Deploy contract and store key first.`
            };
        }
        
        console.log(`✅ VRF key found for contract (stored: ${keyCheck.createdAt})`);
        
        // Step 3: Generate VRF fingerprint using STORED key from vrf_keys table
        console.log('🔐 Generating VRF fingerprint using STORED key from vrf_keys table...');
        const vrfResult = await vrfHandler.generateVRFForVerification(reconstructedData, contractAddress);
        
        console.log(`✅ Generated segmentHash: ${vrfResult.segmentHash}`);
        console.log(`✅ Generated fingerprint using stored key: ${vrfResult.fingerprint.substring(0, 20)}...`);
        
        const hashedFingerprint = ethers.keccak256(vrfResult.fingerprint);
        console.log(`🔨 Hashed fingerprint (32 bytes): ${hashedFingerprint}`);
        
        // Step 4: Connect to blockchain contract
        // ✅ FIX: Use SEPOLIA_RPC instead of POLYGON_RPC
        const rpcUrl = process.env.SEPOLIA_RPC;
        const privateKey = process.env.PRIVATE_KEY;
        
        if (!rpcUrl || !privateKey) {
            throw new Error("Missing SEPOLIA_RPC or PRIVATE_KEY in environment variables");
        }
        
        const contract = await initializeContract(contractAddress, privateKey, rpcUrl);
        console.log('🔗 Connected to smart contract');
        
        // Test contract connection
        try {
            const owner = await contract.owner();
            console.log(`✅ Contract owner: ${owner}`);
        } catch (ownerError) {
            console.error('❌ Failed to get contract owner:', ownerError.message);
            return {
                userInput: { name, value },
                contractAddress,
                error: `Contract connection failed: ${ownerError.message}`,
                status: 'CONTRACT_ERROR'
            };
        }
        
        // Step 5: Check blockchain for stored data
        console.log('🔍 Checking blockchain for stored fingerprint...');
        const existsOnChain = await contract.fingerprintExists(vrfResult.segmentHash);
        console.log(`📋 Exists on blockchain: ${existsOnChain}`);
        
        if (existsOnChain) {
            // Step 6: Verify fingerprint matches what's stored on blockchain
            const isValidOnChain = await contract.verifyFingerprint(vrfResult.segmentHash, hashedFingerprint);
            console.log(`✅ Blockchain verification: ${isValidOnChain ? 'PASSED' : 'FAILED'}`);
            
            const [storedFingerprint, timestamp, exists] = await contract.getFingerprint(vrfResult.segmentHash);
            const storedDate = new Date(Number(timestamp) * 1000);
            console.log(`📅 Originally stored: ${storedDate.toISOString()}`);
            console.log(`🔒 Stored fingerprint: ${storedFingerprint}`);
            console.log(`🔒 Generated fingerprint: ${hashedFingerprint}`);
            
            return {
                userInput: { name, value },
                reconstructedData,
                segmentHash: vrfResult.segmentHash,
                originalFingerprint: vrfResult.fingerprint,
                hashedFingerprint,
                existsOnChain,
                contractVerification: isValidOnChain,
                isVerified: isValidOnChain,
                chainTimestamp: storedDate,
                contractAddress: contractAddress,
                keySource: 'Retrieved from vrf_keys table using contract address',
                keyRetrievedFromDB: true,
                storedFingerprint,
                fingerprintMatch: storedFingerprint === hashedFingerprint,
                status: isValidOnChain ? 'VERIFIED' : 'VERIFICATION_FAILED',
                workflow: {
                    step1: 'Data reconstructed from user input',
                    step2: 'VRF key retrieved from vrf_keys table',
                    step3: 'Fingerprint generated using stored key',
                    step4: 'Fingerprint compared with blockchain storage'
                }
            };
            
        } else {
            console.log('❌ Data not found on blockchain');
            
            return {
                userInput: { name, value },
                reconstructedData,
                segmentHash: vrfResult.segmentHash,
                originalFingerprint: vrfResult.fingerprint,
                hashedFingerprint,
                existsOnChain: false,
                contractVerification: false,
                isVerified: false,
                chainTimestamp: null,
                contractAddress: contractAddress,
                keySource: 'Retrieved from vrf_keys table using contract address',
                keyRetrievedFromDB: true,
                status: 'NOT_FOUND_ON_CHAIN',
                workflow: {
                    step1: 'Data reconstructed from user input',
                    step2: 'VRF key retrieved from vrf_keys table',
                    step3: 'Fingerprint generated using stored key',
                    step4: 'Data not found on blockchain'
                }
            };
        }
        
    } catch (error) {
        console.error('❌ Verification error:', error);
        return {
            userInput: { name, value },
            contractAddress: contractAddress,
            error: error.message,
            status: 'ERROR'
        };
    }
}

/**
 * FIXED: Verify data using contract address and name-value pairs (uses stored key from vrf_keys table)
 */
async function verifyDataWithContractAddress(contractAddress, name, value) {
    console.log('🔍 Starting verification with stored VRF key from vrf_keys table...');
    console.log('🏢 Contract Address:', contractAddress);
    console.log('📊 User input - Name:', name, 'Value:', value);
    console.log('🔑 Key source: vrf_keys table (encrypted storage)');
    
    return await verifyDataIntegrity(name, value, contractAddress);
}

/**
 * FIXED: Verify multiple name-value pairs using stored keys from vrf_keys table
 */
async function verifyMultipleNameValues(nameValuePairs) {
    console.log(`🔍 Verifying ${nameValuePairs.length} name-value pairs using STORED VRF keys from vrf_keys table...\n`);
    
    const results = [];
    for (let i = 0; i < nameValuePairs.length; i++) {
        const { name, value, contractAddress } = nameValuePairs[i];
        console.log(`\n--- Verifying Pair ${i + 1}/${nameValuePairs.length} ---`);
        console.log(`🔑 Using stored VRF key from vrf_keys table for contract: ${contractAddress}`);
        
        const result = await verifyDataIntegrity(name, value, contractAddress);
        results.push(result);
        
        if (result.status === 'VERIFIED') {
            console.log('🎉 BLOCKCHAIN VERIFICATION SUCCESSFUL');
        } else if (result.status === 'NOT_FOUND_ON_CHAIN') {
            console.log('⚠️ DATA NOT FOUND ON BLOCKCHAIN');
        } else if (result.status === 'NO_VRF_KEY') {
            console.log('🔑 NO VRF KEY FOUND FOR CONTRACT IN VRF_KEYS TABLE');
        } else if (result.status === 'ERROR') {
            console.log('🚨 ERROR DURING VERIFICATION');
        } else {
            console.log('❌ BLOCKCHAIN VERIFICATION FAILED');
        }
    }
    
    const verified = results.filter(r => r.status === 'VERIFIED').length;
    const notFound = results.filter(r => r.status === 'NOT_FOUND_ON_CHAIN').length;
    const noKey = results.filter(r => r.status === 'NO_VRF_KEY').length;
    const failed = results.filter(r => r.status === 'VERIFICATION_FAILED').length;
    const errors = results.filter(r => r.status === 'ERROR').length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 BLOCKCHAIN VERIFICATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Verified on blockchain: ${verified}`);
    console.log(`⚠️ Not found on blockchain: ${notFound}`);
    console.log(`🔑 No VRF key for contract: ${noKey}`);
    console.log(`❌ Failed verification: ${failed}`);
    console.log(`🚨 Errors: ${errors}`);
    console.log(`📈 Total processed: ${results.length}`);
    console.log(`🔐 All verifications used stored VRF keys from vrf_keys table`);
    
    return results;
}

// Test encryption workflow with user-provided key
async function testEncryptionWorkflow(contractAddress) {
    console.log('🧪 Testing encryption/decryption workflow with user key...\n');
    
    try {
        // Generate a test user key
        const testUserKey = ethers.Wallet.createRandom().privateKey;
        console.log(`🔑 Generated test user key: ${testUserKey.substring(0, 10)}...`);
        
        // Test data
        const testData = { name: "Test Encryption", value: 12345 };
        
        // Run complete workflow test
        const workflowResult = await vrfHandler.testUserKeyWorkflow(testData, contractAddress, testUserKey);
        
        return workflowResult;
        
    } catch (error) {
        console.error('❌ Encryption workflow test failed:', error);
        return {
            success: false,
            error: error.message,
            contractAddress
        };
    }
}

// Main function demonstrating the workflow
async function main() {
    const testContractAddress = process.env.CONTRACT_ADDRESS || "0x742d35Cc7665C6C83e86F5E6A5e7e1a7d8A5e1A7";
    
    // Test encryption workflow first
    console.log('🧪 Testing user key encryption/decryption workflow:\n');
    const encryptionTest = await testEncryptionWorkflow(testContractAddress);
    
    if (!encryptionTest.success) {
        console.error('❌ Encryption test failed, stopping...');
        return;
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test verification with stored keys
    const testNameValues = [
        { name: "Test Data 1", value: 100, contractAddress: testContractAddress },
        { name: "Test Data 2", value: 200, contractAddress: testContractAddress },
        { name: "Test Data 3", value: 300, contractAddress: testContractAddress }
    ];
    
    console.log('🧪 Verifying name-value pairs using STORED VRF keys from vrf_keys table:\n');
    await verifyMultipleNameValues(testNameValues);
}

// Export functions for use in other modules
module.exports = {
    verifyDataIntegrity,              // FIXED: Uses stored VRF key from vrf_keys table
    verifyDataWithContractAddress,    // FIXED: Uses stored VRF key from vrf_keys table
    verifyMultipleNameValues,         // FIXED: Uses stored VRF key from vrf_keys table
    testEncryptionWorkflow,           // Test user key workflow
    initializeContract,
    getContractABI                    // NEW: Export ABI getter function
};

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}