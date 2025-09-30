
require("dotenv").config();
const express = require('express');
const cors = require('cors');
const busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const pool = require('./database');
const vrfHandler = require('./scripts/vrfHandler');
const { deployContract, CONTRACT_ABI,compileSolidityContract } = require('./scripts/deploy.js');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'https://privacy-preserving-vrf.vercel.app',
    'http://localhost:3001'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

// Note: CONTRACT_ABI is now imported from deploy.js

// Encryption functions
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const KEY_DERIVATION_SALT = process.env.MASTER_ENCRYPTION_SALT || 'default_salt_change_in_production';

function encryptKey(privateKey, contractAddress) {
  try {
    const crypto = require('crypto');
    const keyMaterial = contractAddress + KEY_DERIVATION_SALT;
    const derivedKey = crypto.createHash('sha256').update(keyMaterial).digest();
    
    const ivSource = crypto.createHash('sha256').update(privateKey + contractAddress).digest();
    const iv = ivSource.slice(0, 16);
    
    const cipher = crypto.createCipher('aes-256-cbc', derivedKey);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

function decryptKey(encryptedData, contractAddress) {
  try {
    const crypto = require('crypto');
    const [ivHex, encryptedHex] = encryptedData.split(':');
    
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }
    
    const keyMaterial = contractAddress + KEY_DERIVATION_SALT;
    const derivedKey = crypto.createHash('sha256').update(keyMaterial).digest();
    
    const decipher = crypto.createDecipher('aes-256-cbc', derivedKey);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

// Initialize database tables
async function initializeTables() {
  try {
    // Create vrf_keys table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vrf_keys (
        id SERIAL PRIMARY KEY,
        smart_contract_address VARCHAR(42) UNIQUE NOT NULL,
        encrypted_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create time_series_vrf table for storing fingerprints
    await pool.query(`
      CREATE TABLE IF NOT EXISTS time_series_vrf (
        id SERIAL PRIMARY KEY,
        segment_hash VARCHAR(66) UNIQUE NOT NULL,
        vrf_fingerprint TEXT NOT NULL,
        contract_address VARCHAR(42) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize tables:', error);
  }
}

// Standardize data format
function standardizeData(inputData) {
  let standardizedData;
  
  if (typeof inputData === 'object' && inputData !== null) {
    const name = inputData.name || inputData.Name || 'Unknown';
    const value = inputData.value || inputData.Value || inputData.temp || inputData.temperature || 0;
    
    standardizedData = {
      name: name,
      value: value
    };
  } else {
    standardizedData = {
      name: 'Unknown',
      value: inputData
    };
  }
  
  return standardizedData;
}

// Generate VRF fingerprint
async function generateFingerprint(data, privateKey) {
  const standardizedData = standardizeData(data);
  const wallet = new ethers.Wallet(privateKey);
  const messageHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(standardizedData)));
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));
  
  return {
    originalData: data,
    standardizedData,
    segmentHash: messageHash,
    fingerprint: signature,
    signerAddress: wallet.address
  };
}

// API Endpoints

app.get('/', (req, res) => {
    console.log("okay");
    res.json({ message: 'VRF Blockchain API Server is running!', port: PORT });
});

app.post('/test', (req, res) => {
    console.log('🧪 Test endpoint hit!', req.body);
    res.json({ message: 'Test successful', body: req.body });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Blockchain VRF API is running',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

app.post('/deploy-contract', async (req, res) => {
    const requestStartTime = Date.now();
    console.log('\n🚀 === NEW DEPLOYMENT REQUEST ===');
    console.log(`⏰ Request timestamp: ${new Date().toISOString()}`);
    console.log(`🌐 Request IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`📋 Request body keys: ${Object.keys(req.body)}`);
    
    try {
        const { vrfPrivateKey } = req.body;
        
        console.log('🔍 VRF Key validation:');
        console.log(`- VRF key provided: ${!!vrfPrivateKey}`);
        console.log(`- VRF key type: ${typeof vrfPrivateKey}`);
        console.log(`- VRF key length: ${vrfPrivateKey ? vrfPrivateKey.length : 'N/A'}`);
        console.log(`- VRF key starts with 0x: ${vrfPrivateKey ? vrfPrivateKey.startsWith('0x') : 'N/A'}`);
        console.log(`- VRF key preview: ${vrfPrivateKey ? vrfPrivateKey.substring(0, 10) + '...' : 'N/A'}`);
        
        if (!vrfPrivateKey || !vrfPrivateKey.startsWith('0x') || vrfPrivateKey.length !== 66) {
            console.error('❌ VRF key validation failed');
            return res.status(400).json({
                success: false,
                error: 'Valid VRF private key is required (64 hex characters with 0x prefix)',
                received: {
                    hasKey: !!vrfPrivateKey,
                    length: vrfPrivateKey ? vrfPrivateKey.length : 0,
                    startsWithOx: vrfPrivateKey ? vrfPrivateKey.startsWith('0x') : false
                }
            });
        }

        console.log('✅ VRF key validation passed');
        console.log('\n🚀 Starting smart contract deployment using self-contained deploy.js...');
        
        // Deploy contract using imported function
        // The updated deploy.js now compiles the contract internally
        const deployResult = await deployContract();
        const deploymentTime = Date.now() - requestStartTime;
        
        console.log(`\n✅ Contract deployed successfully in ${deploymentTime}ms`);
        console.log('📋 Deployment result:', {
            contractAddress: deployResult.contractAddress,
            transactionHash: deployResult.transactionHash,
            owner: deployResult.owner,
            deployerAddress: deployResult.deployerAddress,
            hasABI: !!deployResult.abi,
            hasBytecode: !!deployResult.bytecode
        });
        
        // Verify the deployment was successful and ABI is compatible
        if (!deployResult.contractAddress) {
            throw new Error('Contract deployment failed - no contract address returned');
        }
        
        console.log('\n🔐 Processing VRF key encryption...');
        console.log(`- Contract address for encryption: ${deployResult.contractAddress}`);
        
        // Encrypt and store VRF key in vrf_keys table
        let encryptedKey;
        try {
            encryptedKey = encryptKey(vrfPrivateKey, deployResult.contractAddress);
            console.log(`✅ VRF key encrypted successfully (length: ${encryptedKey.length})`);
        } catch (encryptError) {
            console.error('❌ VRF key encryption failed:', encryptError.message);
            throw new Error(`VRF key encryption failed: ${encryptError.message}`);
        }
        
        console.log('\n💾 Storing encrypted VRF key in database...');
        
        try {
            const dbResult = await pool.query(
                'INSERT INTO vrf_keys (smart_contract_address, encrypted_key) VALUES ($1, $2) ON CONFLICT (smart_contract_address) DO UPDATE SET encrypted_key = $2 RETURNING *',
                [deployResult.contractAddress, encryptedKey]
            );
            
            console.log(`✅ VRF key stored in database`);
            console.log(`📊 Database operation result:`, {
                rowsAffected: dbResult.rowCount,
                insertedAddress: dbResult.rows[0]?.smart_contract_address
            });
        } catch (dbError) {
            console.error('❌ Database storage failed:', dbError.message);
            console.error('📋 Database error details:', {
                code: dbError.code,
                detail: dbError.detail,
                constraint: dbError.constraint
            });
            throw new Error(`Database storage failed: ${dbError.message}`);
        }
        
        const totalTime = Date.now() - requestStartTime;
        console.log(`\n🎉 === DEPLOYMENT COMPLETED SUCCESSFULLY ===`);
        console.log(`⏱️  Total time: ${totalTime}ms`);
        
        // Return comprehensive deployment information
        res.json({
            success: true,
            message: 'Smart contract deployed and VRF key stored successfully',
            contractAddress: deployResult.contractAddress,
            transactionHash: deployResult.transactionHash,
            owner: deployResult.owner,
            deployerAddress: deployResult.deployerAddress,
            vrfKeyStored: true,
            contractInfo: {
                hasABI: !!deployResult.abi,
                hasBytecode: !!deployResult.bytecode,
                abiLength: deployResult.abi ? deployResult.abi.length : 0,
                compiledInternally: true // Indicates this was compiled by the deploy script
            },
            timing: {
                deploymentTime: deploymentTime,
                totalTime: totalTime
            }
        });
        
    } catch (error) {
        const totalTime = Date.now() - requestStartTime;
        console.error(`\n❌ === DEPLOYMENT FAILED ===`);
        console.error(`⏱️  Failed after: ${totalTime}ms`);
        console.error('📋 Error details:');
        console.error(`- Error name: ${error.name || 'Unknown'}`);
        console.error(`- Error message: ${error.message || 'No message'}`);
        console.error(`- Error stack: ${error.stack || 'No stack trace'}`);
        
        // Log additional error properties if they exist
        if (error.code) console.error(`- Error code: ${error.code}`);
        if (error.reason) console.error(`- Error reason: ${error.reason}`);
        if (error.transaction) console.error(`- Transaction data: ${JSON.stringify(error.transaction, null, 2)}`);
        
        // Check for specific compilation errors
        if (error.message.includes('compilation failed') || error.message.includes('Compilation failed')) {
            console.error('🔧 This appears to be a Solidity compilation error');
            console.error('💡 Check if the solc package is installed: npm install solc');
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to deploy contract',
            details: error.message,
            timestamp: new Date().toISOString(),
            requestDuration: totalTime,
            errorType: error.name || 'Unknown'
        });
    }
});

app.post('/store-data', async (req, res) => {
    console.log('🎯 /store-data endpoint hit!', req.body);
    try {
        const { contractAddress, data } = req.body;
        
        if (!contractAddress) {
            return res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
        }
        
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Data is required'
            });
        }
        
        // ✅ FIX: Get the correct ABI by compiling the contract
        console.log('🔧 Compiling contract to get correct ABI...');
        let CONTRACT_ABI;
        try {
            const compilationResult = compileSolidityContract();
            CONTRACT_ABI = compilationResult.abi;
            console.log(`✅ ABI compiled successfully (${CONTRACT_ABI.length} items)`);
        } catch (compileError) {
            console.error('❌ Failed to compile contract for ABI:', compileError.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to compile contract for ABI',
                details: compileError.message,
                hint: 'Make sure solc package is installed: npm install solc'
            });
        }
        
        // Retrieve VRF key from vrf_keys table
        const keyResult = await pool.query(
            'SELECT encrypted_key FROM vrf_keys WHERE smart_contract_address = $1',
            [contractAddress]
        );
        
        if (keyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No VRF key found for this contract address',
                hint: 'Deploy a contract first with /deploy-contract endpoint'
            });
        }
        
        // Decrypt the VRF key
        const vrfPrivateKey = decryptKey(keyResult.rows[0].encrypted_key, contractAddress);
        console.log('🔓 Retrieved and decrypted VRF key from database');
        
        // Initialize blockchain contract
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log('🔍 Enhanced Debug Info:');
        console.log('- Contract address:', contractAddress);
        console.log('- Wallet address:', wallet.address);
        console.log('- Network:', await provider.getNetwork());
        
        // ✅ ENHANCED: More thorough contract validation
        try {
            const contractCode = await provider.getCode(contractAddress);
            console.log('- Contract exists:', contractCode !== '0x');
            console.log('- Bytecode length:', contractCode.length);
            
            if (contractCode === '0x') {
                return res.status(400).json({
                    success: false,
                    error: 'Contract not found at the provided address',
                    contractAddress,
                    hint: 'Make sure the contract is deployed on Sepolia testnet'
                });
            }
        } catch (contractError) {
            console.error('❌ Contract validation failed:', contractError);
            return res.status(400).json({
                success: false,
                error: 'Failed to validate contract',
                details: contractError.message,
                contractAddress
            });
        }
        
        // ✅ FIX: Create contract instance with the compiled ABI
        console.log('🏭 Creating contract instance with compiled ABI...');
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
        console.log('✅ Contract instance created successfully');
        
        // ✅ ENHANCED: Test contract owner and basic functions
        try {
            console.log('👑 Testing contract owner...');
            const owner = await contract.owner();
            console.log('- Contract owner:', owner);
            console.log('- Is wallet owner?:', owner.toLowerCase() === wallet.address.toLowerCase());
            
            if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized to store data',
                    details: 'Only contract owner can store data',
                    contractOwner: owner,
                    walletAddress: wallet.address
                });
            }
        } catch (ownerError) {
            console.error('❌ Failed to get contract owner:', ownerError.message);
            console.error('📋 Owner error details:', ownerError);
            return res.status(400).json({
                success: false,
                error: 'Contract owner check failed - ABI mismatch or contract issue',
                details: ownerError.message,
                hint: 'This usually means the contract ABI doesn\'t match the deployed contract'
            });
        }
        
        // Process data array
        const dataArray = Array.isArray(data) ? data : [data];
        const results = [];
        
        console.log(`📦 Processing ${dataArray.length} data segments...`);
        
        for (let i = 0; i < dataArray.length; i++) {
            const item = dataArray[i];
            console.log(`\n🔐 Processing item ${i + 1}/${dataArray.length}:`, item);
            
            try {
                // Generate VRF fingerprint
                const vrfResult = await generateFingerprint(item, vrfPrivateKey);
                console.log('✅ VRF fingerprint generated');
                console.log('- Segment hash:', vrfResult.segmentHash);
                console.log('- Fingerprint preview:', vrfResult.fingerprint.substring(0, 20) + '...');
                
                // Hash fingerprint for blockchain storage
                const hashedFingerprint = ethers.keccak256(vrfResult.fingerprint);
                console.log('- Hashed fingerprint:', hashedFingerprint);
                
                // ✅ ENHANCED: More detailed existence check
                console.log('🔍 Checking if data exists on blockchain...');
                let existsOnChain;
                try {
                    existsOnChain = await contract.fingerprintExists(vrfResult.segmentHash);
                    console.log('- Exists check result:', existsOnChain);
                } catch (existsError) {
                    console.error('❌ Failed to check existence:', existsError.message);
                    throw new Error(`Existence check failed: ${existsError.message}`);
                }
                
                if (existsOnChain) {
                    console.log('⚠️ Data already exists on blockchain');
                    results.push({
                        originalData: item,
                        segmentHash: vrfResult.segmentHash,
                        status: 'ALREADY_EXISTS'
                    });
                    continue;
                }
                
                // Store in database first
                console.log('💾 Storing in database...');
                await pool.query(
                    'INSERT INTO time_series_vrf (segment_hash, vrf_fingerprint, contract_address) VALUES ($1, $2, $3) ON CONFLICT (segment_hash) DO NOTHING',
                    [vrfResult.segmentHash, vrfResult.fingerprint, contractAddress]
                );
                console.log('✅ Stored in database');
                
                // ✅ ENHANCED: More detailed blockchain transaction
                console.log('🔗 Preparing blockchain transaction...');
                console.log('- Segment hash (bytes32):', vrfResult.segmentHash);
                console.log('- Hashed fingerprint (bytes32):', hashedFingerprint);
                
                // Check gas estimation first
                try {
                    const gasEstimate = await contract.storeFingerprint.estimateGas(
                        vrfResult.segmentHash, 
                        hashedFingerprint
                    );
                    console.log('- Estimated gas:', gasEstimate.toString());
                } catch (gasError) {
                    console.error('❌ Gas estimation failed:', gasError);
                    throw new Error(`Gas estimation failed: ${gasError.message}`);
                }
                
                // Execute the transaction
                console.log('🚀 Executing blockchain transaction...');
                const tx = await contract.storeFingerprint(
                    vrfResult.segmentHash, 
                    hashedFingerprint,
                    {
                        gasLimit: 300000, // Set explicit gas limit
                    }
                );
                
                console.log('📄 Transaction sent:', tx.hash);
                console.log('⏳ Waiting for confirmation...');
                
                const receipt = await tx.wait();
                console.log(`✅ Transaction confirmed - Block: ${receipt.blockNumber}`);
                console.log(`⛽ Gas used: ${receipt.gasUsed?.toString()}`);
                
                results.push({
                    originalData: item,
                    standardizedData: vrfResult.standardizedData,
                    segmentHash: vrfResult.segmentHash,
                    hashedFingerprint,
                    transactionHash: tx.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed?.toString(),
                    status: 'SUCCESS'
                });
                
            } catch (itemError) {
                console.error(`❌ Error processing item ${i + 1}:`, itemError);
                results.push({
                    originalData: item,
                    error: itemError.message,
                    status: 'ERROR'
                });
            }
        }
        
        const successful = results.filter(r => r.status === 'SUCCESS').length;
        const existing = results.filter(r => r.status === 'ALREADY_EXISTS').length;
        const errors = results.filter(r => r.status === 'ERROR').length;
        
        console.log(`📊 Final Summary: ${successful} successful, ${existing} existing, ${errors} errors`);
        
        res.json({
            success: errors === 0, // Only success if no errors
            message: `Processed ${dataArray.length} items: ${successful} stored, ${existing} already existed, ${errors} errors`,
            contractAddress,
            summary: {
                total: dataArray.length,
                successful,
                existing,
                errors
            },
            results
        });
        
    } catch (error) {
        console.error('❌ Store data error:', error);
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            reason: error.reason,
            action: error.action,
            data: error.data
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to store data',
            details: error.message,
            errorCode: error.code,
            errorReason: error.reason
        });
    }
});
// Add this endpoint to check ABI compatibility
app.get('/debug/contract/:contractAddress', async (req, res) => {
    try {
        const { contractAddress } = req.params;
        console.log(`🔍 Debugging contract: ${contractAddress}`);
        
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        // 1. Check if contract exists
        const contractCode = await provider.getCode(contractAddress);
        console.log('📄 Contract bytecode length:', contractCode.length);
        console.log('📄 Contract exists:', contractCode !== '0x');
        
        if (contractCode === '0x') {
            return res.json({
                success: false,
                error: 'Contract not found at this address',
                contractAddress,
                network: 'Sepolia'
            });
        }
        
        // 2. Test each ABI function individually
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
        const functionTests = {};
        
        console.log('\n🧪 Testing individual ABI functions...');
        
        // Test owner() function
        try {
            const owner = await contract.owner();
            functionTests.owner = {
                success: true,
                result: owner,
                note: 'Basic read function works'
            };
            console.log('✅ owner():', owner);
        } catch (error) {
            functionTests.owner = {
                success: false,
                error: error.message,
                note: 'Basic function failed - ABI mismatch likely'
            };
            console.log('❌ owner() failed:', error.message);
        }
        
        // Test fingerprintExists() with a dummy hash
        try {
            const dummyHash = ethers.keccak256(ethers.toUtf8Bytes('test'));
            const exists = await contract.fingerprintExists(dummyHash);
            functionTests.fingerprintExists = {
                success: true,
                result: exists,
                note: 'Read function with parameter works'
            };
            console.log('✅ fingerprintExists():', exists);
        } catch (error) {
            functionTests.fingerprintExists = {
                success: false,
                error: error.message,
                note: 'Function with parameters failed'
            };
            console.log('❌ fingerprintExists() failed:', error.message);
        }
        
        // Test getFingerprint() with dummy hash
        try {
            const dummyHash = ethers.keccak256(ethers.toUtf8Bytes('test'));
            const fingerprint = await contract.getFingerprint(dummyHash);
            functionTests.getFingerprint = {
                success: true,
                result: fingerprint,
                note: 'Complex read function works'
            };
            console.log('✅ getFingerprint():', fingerprint);
        } catch (error) {
            functionTests.getFingerprint = {
                success: false,
                error: error.message,
                note: 'Complex function failed'
            };
            console.log('❌ getFingerprint() failed:', error.message);
        }
        
        // 3. Try to estimate gas for storeFingerprint (without executing)
        try {
            const dummyHash = ethers.keccak256(ethers.toUtf8Bytes('test'));
            const dummyFingerprint = ethers.keccak256(ethers.toUtf8Bytes('fingerprint'));
            const gasEstimate = await contract.storeFingerprint.estimateGas(dummyHash, dummyFingerprint);
            functionTests.storeFingerprint_estimate = {
                success: true,
                result: gasEstimate.toString(),
                note: 'Write function signature is correct'
            };
            console.log('✅ storeFingerprint gas estimate:', gasEstimate.toString());
        } catch (error) {
            functionTests.storeFingerprint_estimate = {
                success: false,
                error: error.message,
                note: 'Write function signature mismatch or other issue'
            };
            console.log('❌ storeFingerprint estimate failed:', error.message);
        }
        
        // 4. Check contract info
        const network = await provider.getNetwork();
        const balance = await provider.getBalance(wallet.address);
        
        // 5. Analyze ABI vs actual contract
        const abiAnalysis = {
            expectedFunctions: CONTRACT_ABI.filter(item => item.includes('function')),
            totalAbiEntries: CONTRACT_ABI.length,
            hasOwnerFunction: CONTRACT_ABI.some(item => item.includes('owner()')),
            hasStoreFingerprintFunction: CONTRACT_ABI.some(item => item.includes('storeFingerprint')),
            hasFingerprintExistsFunction: CONTRACT_ABI.some(item => item.includes('fingerprintExists'))
        };
        
        console.log('\n📊 ABI Analysis:', abiAnalysis);
        
        res.json({
            success: true,
            contractAddress,
            network: {
                name: network.name,
                chainId: network.chainId.toString()
            },
            contract: {
                exists: contractCode !== '0x',
                bytecodeLength: contractCode.length,
                bytecodePreview: contractCode.substring(0, 100) + '...'
            },
            wallet: {
                address: wallet.address,
                balance: ethers.formatEther(balance) + ' ETH'
            },
            abiAnalysis,
            functionTests,
            diagnosis: {
                contractFound: contractCode !== '0x',
                basicFunctionsWork: functionTests.owner?.success || false,
                parameterFunctionsWork: functionTests.fingerprintExists?.success || false,
                writeFunctionsWork: functionTests.storeFingerprint_estimate?.success || false,
                overallCompatibility: Object.values(functionTests).filter(test => test.success).length + '/4 functions working'
            }
        });
        
    } catch (error) {
        console.error('❌ Contract debug failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to debug contract',
            details: error.message
        });
    }
});

// Also add this helper to show your current ABI
app.get('/debug/abi', (req, res) => {
    res.json({
        success: true,
        abi: CONTRACT_ABI,
        abiLength: CONTRACT_ABI.length,
        functions: CONTRACT_ABI.filter(item => item.includes('function')),
        events: CONTRACT_ABI.filter(item => item.includes('event'))
    });
});

app.post('/verify', async (req, res) => {
    try {
        console.log('📨 Received verification request:', req.body);
        
        const { contractAddress, name, value, data } = req.body;
        
        if (!contractAddress) {
            return res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
        }
        
        // Handle different data input formats
        let dataToVerify;
        if (data) {
            // If data property exists, use it
            dataToVerify = Array.isArray(data) ? data : [data];
        } else if (name !== undefined && value !== undefined) {
            // If name and value are provided directly
            dataToVerify = [{ name, value }];
        } else {
            return res.status(400).json({
                success: false,
                error: 'No data provided for verification. Provide either "data" array or "name" and "value" fields'
            });
        }
        
        console.log(`🔍 Verifying ${dataToVerify.length} data entries...`);
        
        // ✅ FIX: Get the correct ABI by compiling the contract
        console.log('🔧 Compiling contract to get correct ABI...');
        let CONTRACT_ABI;
        try {
            const compilationResult = compileSolidityContract();
            CONTRACT_ABI = compilationResult.abi;
            console.log(`✅ ABI compiled successfully (${CONTRACT_ABI.length} items)`);
        } catch (compileError) {
            console.error('❌ Failed to compile contract for ABI:', compileError.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to compile contract for ABI',
                details: compileError.message,
                hint: 'Make sure solc package is installed: npm install solc'
            });
        }
        
        // Retrieve VRF key from vrf_keys table
        const keyResult = await pool.query(
            'SELECT encrypted_key, created_at FROM vrf_keys WHERE smart_contract_address = $1',
            [contractAddress]
        );
        
        if (keyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No VRF key found for this contract address',
                hint: 'Store data first using /store-data endpoint'
            });
        }
        
        // Decrypt the VRF key
        const vrfPrivateKey = decryptKey(keyResult.rows[0].encrypted_key, contractAddress);
        console.log(`🔓 Retrieved VRF key from database (stored: ${keyResult.rows[0].created_at})`);
        
        // Initialize blockchain contract (use SEPOLIA_RPC since that's your actual network)
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        // ✅ FIX: Create contract instance with the compiled ABI
        console.log('🏭 Creating contract instance with compiled ABI...');
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
        console.log('✅ Contract instance created successfully');
        
        // Test contract connection
        try {
            console.log('🧪 Testing contract connection...');
            const owner = await contract.owner();
            console.log(`✅ Contract owner: ${owner}`);
        } catch (contractError) {
            console.error('❌ Failed to connect to contract:', contractError.message);
            return res.status(400).json({
                success: false,
                error: 'Failed to connect to contract - ABI mismatch or contract issue',
                details: contractError.message,
                contractAddress,
                hint: 'Make sure the contract address is correct and deployed on Sepolia'
            });
        }
        
        const results = [];
        
        for (let i = 0; i < dataToVerify.length; i++) {
            const item = dataToVerify[i];
            console.log(`\n🔐 Verifying item ${i + 1}/${dataToVerify.length}:`, item);
            
            try {
                // Generate fingerprint using stored VRF key
                const vrfResult = await generateFingerprint(item, vrfPrivateKey);
                console.log('✅ Generated fingerprint using stored VRF key');
                
                // Hash fingerprint for blockchain comparison
                const hashedFingerprint = ethers.keccak256(vrfResult.fingerprint);
                
                // Check if exists on blockchain
                const existsOnChain = await contract.fingerprintExists(vrfResult.segmentHash);
                
                if (existsOnChain) {
                    // Get stored fingerprint from blockchain
                    const [storedFingerprint, timestamp, exists] = await contract.getFingerprint(vrfResult.segmentHash);
                    const storedDate = new Date(Number(timestamp) * 1000);
                    
                    // Compare fingerprints
                    const fingerprintMatch = storedFingerprint === hashedFingerprint;
                    
                    console.log(`🔍 Fingerprint comparison:`);
                    console.log(`   Stored: ${storedFingerprint}`);
                    console.log(`   Generated: ${hashedFingerprint}`);
                    console.log(`   Match: ${fingerprintMatch ? '✅ YES' : '❌ NO'}`);
                    
                    results.push({
                        originalInput: item,
                        standardizedData: vrfResult.standardizedData,
                        segmentHash: vrfResult.segmentHash,
                        existsOnChain: true,
                        storedFingerprint,
                        generatedFingerprint: hashedFingerprint,
                        timestamp: storedDate.toISOString(),
                        verified: fingerprintMatch,
                        status: fingerprintMatch ? 'VERIFIED' : 'FINGERPRINT_MISMATCH'
                    });
                } else {
                    console.log('❌ Data not found on blockchain');
                    results.push({
                        originalInput: item,
                        standardizedData: vrfResult.standardizedData,
                        segmentHash: vrfResult.segmentHash,
                        existsOnChain: false,
                        verified: false,
                        status: 'NOT_FOUND'
                    });
                }
                
            } catch (error) {
                console.error(`❌ Error verifying item ${i + 1}:`, error);
                results.push({
                    originalInput: item,
                    error: error.message,
                    status: 'ERROR'
                });
            }
        }
        
        const verified = results.filter(r => r.status === 'VERIFIED').length;
        const notFound = results.filter(r => r.status === 'NOT_FOUND').length;
        const errors = results.filter(r => r.status === 'ERROR').length;
        const mismatches = results.filter(r => r.status === 'FINGERPRINT_MISMATCH').length;
        
        console.log(`📊 Verification Summary: ${verified} verified, ${notFound} not found, ${mismatches} mismatches, ${errors} errors`);
        
        res.json({
            success: true,
            contractAddress,
            summary: {
                total: dataToVerify.length,
                verified,
                notFound,
                errors,
                mismatches
            },
            results,
            workflow: {
                keySource: 'Retrieved from vrf_keys table',
                verification: 'Used stored encrypted key for fingerprint generation'
            }
        });
        
    } catch (error) {
        console.error('❌ Verify API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify data',
            details: error.message
        });
    }
});

// Generate new VRF keys
app.post('/generate-keys', (req, res) => {
    try {
        const wallet = ethers.Wallet.createRandom();
        
        res.json({
            success: true,
            message: 'VRF keys generated successfully',
            keys: {
                privateKey: wallet.privateKey,
                publicKey: wallet.publicKey,
                address: wallet.address
            },
            important: 'SAVE THE PRIVATE KEY SECURELY! You will need it to deploy a contract.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to generate keys',
            details: error.message
        });
    }
});

// Get contract info
app.get('/contract/info/:contractAddress', async (req, res) => {
    try {
        const { contractAddress } = req.params;
        
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
        const owner = await contract.owner();
        
        // Check if we have a VRF key for this contract
        const keyCheck = await pool.query(
            'SELECT created_at FROM vrf_keys WHERE smart_contract_address = $1',
            [contractAddress]
        );
        
        const hasStoredKey = keyCheck.rows.length > 0;
        
        res.json({
            success: true,
            contract: {
                address: contractAddress,
                owner: owner,
                hasStoredVRFKey: hasStoredKey,
                keyStoredAt: hasStoredKey ? keyCheck.rows[0].created_at : null
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get contract info',
            details: error.message
        });
    }
});

// Initialize tables on startup
initializeTables();

app.listen(PORT, () => {
    console.log(`🚀 VRF Blockchain API Server running on port ${PORT}`);
    console.log(`📍 Available endpoints:`);
    console.log(`   POST /generate-keys - Generate new VRF keys`);
    console.log(`   POST /deploy-contract - Deploy contract using deploy.js and store VRF key`);
    console.log(`   POST /store-data - Store data using stored VRF key`);
    console.log(`   POST /verify - Verify data using stored VRF key`);
    console.log(`   GET /contract/info/:address - Get contract information`);
    console.log(`\n🔄 WORKFLOW:`);
    console.log(`   1. Generate VRF keys with /generate-keys`);
    console.log(`   2. Deploy contract with VRF key using /deploy-contract (uses deploy.js)`);
    console.log(`   3. Store data using /store-data (uses stored key)`);
    console.log(`   4. Verify data using /verify with name and value`);
    console.log(`\n🔧 ENVIRONMENT:`);
    console.log(`   - Network: Sepolia Testnet`);
    console.log(`   - RPC: ${process.env.SEPOLIA_RPC ? 'Connected' : 'Not configured'}`);
    console.log(`   - Database: ${process.env.DB_NAME || 'Not configured'}`);
});