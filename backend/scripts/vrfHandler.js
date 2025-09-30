
require("dotenv").config({ path: '../../.env' });
const { Wallet, keccak256, toUtf8Bytes } = require("ethers");
const { getBytes } = require("ethers");
const crypto = require("crypto");

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const KEY_DERIVATION_SALT = process.env.MASTER_ENCRYPTION_SALT || 'default_salt_change_in_production';

// Deterministic encryption using contract address as context
function encryptKey(privateKey, contractAddress) {
  try {
    const keyMaterial = contractAddress + KEY_DERIVATION_SALT;
    const derivedKey = crypto.createHash('sha256').update(keyMaterial).digest();
    
    const ivSource = crypto.createHash('sha256').update(privateKey + contractAddress).digest();
    const iv = ivSource.slice(0, 16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey , iv);
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
    const [ivHex, encryptedHex] = encryptedData.split(':');
    
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex'); 
    
    const keyMaterial = contractAddress + KEY_DERIVATION_SALT;
    const derivedKey = crypto.createHash('sha256').update(keyMaterial).digest();
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

function standardizeDataForFingerprint(inputData) {
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
  
  console.log(`🔄 Standardized data for fingerprint:`, standardizedData);
  return standardizedData;
}

// Core VRF computation function
async function computeVRF(segmentData, privateKey) {
  const standardizedData = standardizeDataForFingerprint(segmentData);
  
  const wallet = new Wallet(privateKey);
  const messageHash = keccak256(toUtf8Bytes(JSON.stringify(standardizedData)));
  const signature = await wallet.signMessage(getBytes(messageHash));
  
  return {
    originalData: segmentData,
    standardizedData: standardizedData,
    segmentHash: messageHash,
    fingerprint: signature,
    signerAddress: wallet.address
  };
}

// Store encrypted VRF key in vrf_keys table
async function storeEncryptedKey(contractAddress, vrfPrivateKey) {
  try {
    const pool = require('../database');
    
    console.log(`🔐 Storing encrypted VRF key for contract: ${contractAddress}`);
    
    // Encrypt the private key using contract address as context
    const encryptedKey = encryptKey(vrfPrivateKey, contractAddress);
    
    // Store in vrf_keys table
    const query = `
      INSERT INTO vrf_keys (smart_contract_address, encrypted_key) 
      VALUES ($1, $2) 
      ON CONFLICT (smart_contract_address) 
      DO UPDATE SET encrypted_key = $2, created_at = CURRENT_TIMESTAMP
      RETURNING id, created_at
    `;
    
    const result = await pool.query(query, [contractAddress, encryptedKey]);
    
    console.log(`✅ VRF key encrypted and stored with ID: ${result.rows[0].id}`);
    
    return {
      success: true,
      id: result.rows[0].id,
      contractAddress,
      createdAt: result.rows[0].created_at
    };
    
  } catch (error) {
    throw new Error(`Failed to store encrypted key: ${error.message}`);
  }
}

// Retrieve and decrypt VRF key from vrf_keys table
async function retrieveDecryptedKey(contractAddress) {
  try {
    const pool = require('../database');
    
    console.log(`🔍 Retrieving VRF key for contract: ${contractAddress}`);
    
    const query = `
      SELECT encrypted_key, created_at 
      FROM vrf_keys 
      WHERE smart_contract_address = $1
    `;
    
    const result = await pool.query(query, [contractAddress]);
    
    if (result.rows.length === 0) {
      throw new Error(`No VRF key found for contract address: ${contractAddress}`);
    }
    
    // Decrypt the key
    const decryptedKey = decryptKey(result.rows[0].encrypted_key, contractAddress);
    
    console.log(`🔓 Successfully retrieved and decrypted VRF key (stored: ${result.rows[0].created_at})`);
    
    return {
      privateKey: decryptedKey,
      createdAt: result.rows[0].created_at
    };
    
  } catch (error) {
    throw new Error(`Failed to retrieve VRF key: ${error.message}`);
  }
}

// Check if VRF key exists for a contract
async function checkVRFKeyExists(contractAddress) {
  try {
    const pool = require('../database');
    
    const query = `
      SELECT created_at 
      FROM vrf_keys 
      WHERE smart_contract_address = $1
    `;
    
    const result = await pool.query(query, [contractAddress]);
    
    return {
      exists: result.rows.length > 0,
      createdAt: result.rows.length > 0 ? result.rows[0].created_at : null
    };
    
  } catch (error) {
    throw new Error(`Failed to check VRF key existence: ${error.message}`);
  }
}

// Generate VRF using stored key from vrf_keys table
async function generateVRFForVerification(inputData, contractAddress) {
  try {
    console.log(`🔍 Generating VRF for verification using stored key...`);
    
    // Retrieve the stored VRF key
    const keyData = await retrieveDecryptedKey(contractAddress);
    
    // Generate VRF fingerprint using the stored key
    const result = await computeVRF(inputData, keyData.privateKey);
    
    console.log(`✅ Generated VRF fingerprint using stored key from vrf_keys table`);
    
    return {
      originalData: result.originalData,
      standardizedData: result.standardizedData,
      segmentHash: result.segmentHash,
      fingerprint: result.fingerprint,
      signerAddress: result.signerAddress,
      keySource: 'Retrieved from vrf_keys table',
      keyStoredAt: keyData.createdAt
    };
    
  } catch (error) {
    throw new Error(`Failed to generate VRF for verification: ${error.message}`);
  }
}

// Generate VRF using user-provided key (for initial storage)
async function generateVRFWithKey(segmentData, userPrivateKey) {
  try {
    console.log(`🔑 Generating VRF using user-provided private key`);
    
    if (!userPrivateKey || typeof userPrivateKey !== 'string') {
      throw new Error("Private key must be a valid string");
    }
    
    const formattedKey = userPrivateKey.startsWith('0x') ? userPrivateKey : `0x${userPrivateKey}`;
   
    if (formattedKey.length !== 66) {
      throw new Error("Private key must be 64 hex characters (with or without 0x prefix)");
    }
    
    // Generate VRF using user's key
    const result = await computeVRF(segmentData, formattedKey);
    
    console.log(`✅ Generated VRF using user's private key`);
    
    return {
      originalData: result.originalData,
      standardizedData: result.standardizedData,
      segmentHash: result.segmentHash,
      fingerprint: result.fingerprint,
      secretKey: formattedKey, 
      walletAddress: result.signerAddress,
      keySource: 'User-provided private key'
    };
    
  } catch (error) {
    throw new Error(`Failed to generate VRF with user key: ${error.message}`);
  }
}

// ORIGINAL: Generate VRF using environment key (for backward compatibility)
async function generateVRF(segmentData, contractAddress = process.env.CONTRACT_ADDRESS) {
  try {
    if (!process.env.VRF_SECRET_KEY) {
      throw new Error("VRF_SECRET_KEY is missing in .env file");
    }
    
    const result = await computeVRF(segmentData, process.env.VRF_SECRET_KEY);
    
    return {
      originalData: result.originalData,
      standardizedData: result.standardizedData,
      segmentHash: result.segmentHash,
      fingerprint: result.fingerprint,
      signerAddress: result.signerAddress,
      contractAddress: contractAddress,
      keySource: 'Environment VRF_SECRET_KEY'
    };
    
  } catch (error) {
    throw new Error(`Failed to generate VRF: ${error.message}`);
  }
}

// Test complete workflow with user key
async function testUserKeyWorkflow(testData, contractAddress, userPrivateKey) {
  try {
    console.log('🧪 Testing complete user key workflow...\n');
    
    // STEP 1: Store encrypted key in vrf_keys table
    console.log('Step 1: Storing encrypted VRF key in vrf_keys table...');
    const keyStorage = await storeEncryptedKey(contractAddress, userPrivateKey);
    console.log(`✅ Key stored with ID: ${keyStorage.id}`);
    
    // STEP 2: Generate fingerprint using stored key
    console.log('\nStep 2: Generating fingerprint using stored key...');
    const verificationResult = await generateVRFForVerification(testData, contractAddress);
    console.log(`✅ Verification fingerprint: ${verificationResult.fingerprint.substring(0, 20)}...`);
    
    // STEP 3: Generate fingerprint using original user key for comparison
    console.log('\nStep 3: Generating fingerprint using original user key for comparison...');
    const originalResult = await generateVRFWithKey(testData, userPrivateKey);
    console.log(`✅ Original fingerprint: ${originalResult.fingerprint.substring(0, 20)}...`);
    
    // STEP 4: Compare results
    const fingerprintsMatch = originalResult.fingerprint === verificationResult.fingerprint;
    const hashesMatch = originalResult.segmentHash === verificationResult.segmentHash;
    
    console.log('\nStep 4: Workflow Test Results:');
    console.log(`🔍 Fingerprints match: ${fingerprintsMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`🔍 Segment hashes match: ${hashesMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`🔍 Overall workflow test: ${fingerprintsMatch && hashesMatch ? '🎉 PASSED' : '💥 FAILED'}`);
    
    return {
      success: fingerprintsMatch && hashesMatch,
      keyStorage,
      originalResult,
      verificationResult,
      contractAddress,
      testData,
      workflow: {
        step1: 'VRF key encrypted and stored in vrf_keys table',
        step2: 'Fingerprint generated using stored encrypted key',
        step3: 'Fingerprint generated using original user key',
        step4: 'Results compared for consistency'
      }
    };
    
  } catch (error) {
    console.error('❌ User key workflow test failed:', error);
    return {
      success: false,
      error: error.message,
      contractAddress,
      testData
    };
  }
}

// Utility functions
function validatePrivateKey(privateKey) {
  try {
    if (!privateKey || typeof privateKey !== 'string') {
      return { valid: false, error: "Private key must be a valid string" };
    }
    
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    
    if (formattedKey.length !== 66) {
      return { valid: false, error: "Private key must be 64 hex characters (with or without 0x prefix)" };
    }
   
    const wallet = new Wallet(formattedKey);
    
    return { 
      valid: true, 
      formattedKey,
      address: wallet.address 
    };
    
  } catch (error) {
    return { 
      valid: false, 
      error: `Invalid private key: ${error.message}` 
    };
  }
}

function getWalletAddress(privateKey) {
  try {
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const wallet = new Wallet(formattedKey);
    return wallet.address;
  } catch (error) {
    throw new Error(`Invalid private key: ${error.message}`);
  }
}

// Database interaction functions
async function storeVRFFingerprint(segmentHash, fingerprint, contractAddress) {
  try {
    const pool = require('../database');
    
    const query = `
      INSERT INTO time_series_vrf (segment_hash, vrf_fingerprint, contract_address) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (segment_hash) DO NOTHING
      RETURNING id
    `;
    
    const result = await pool.query(query, [segmentHash, fingerprint, contractAddress]);
    
    return {
      success: true,
      id: result.rows.length > 0 ? result.rows[0].id : null,
      alreadyExists: result.rows.length === 0
    };
    
  } catch (error) {
    throw new Error(`Failed to store VRF fingerprint: ${error.message}`);
  }
}

async function getStoredFingerprint(segmentHash) {
  try {
    const pool = require('../database');
    
    const query = `
      SELECT vrf_fingerprint, contract_address, timestamp 
      FROM time_series_vrf 
      WHERE segment_hash = $1
    `;
    
    const result = await pool.query(query, [segmentHash]);
    
    if (result.rows.length === 0) {
      return { exists: false };
    }
    
    return {
      exists: true,
      fingerprint: result.rows[0].vrf_fingerprint,
      contractAddress: result.rows[0].contract_address,
      timestamp: result.rows[0].timestamp
    };
    
  } catch (error) {
    throw new Error(`Failed to get stored fingerprint: ${error.message}`);
  }
}

// Testing function
if (require.main === module) {
  (async () => {
    console.log("✅ Testing VRF Handler with vrf_keys table:\n");
    
    const testUserKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const testContractAddress = "0x742d35Cc7665C6C83e86F5E6A5e7e1a7d8A5e1A7";
    const testData = { name: "Test Data 1", value: 100 };
    
    console.log("🧪 Testing with sample data:", testData);
    
    // Test the complete workflow
    const workflowTest = await testUserKeyWorkflow(testData, testContractAddress, testUserKey);
    
    if (workflowTest.success) {
      console.log('\n🎉 VRF Handler workflow test PASSED!');
      console.log('✅ Encryption/decryption working correctly');
      console.log('✅ Fingerprint generation consistent');
    } else {
      console.log('\n❌ VRF Handler workflow test FAILED!');
      console.log('Error:', workflowTest.error);
    }
    
  })().catch(console.error);
}

module.exports = {
  // Core VRF functions
  generateVRF,                    // Environment key (backward compatibility)
  generateVRFForVerification,     // Uses stored key from vrf_keys table
  generateVRFWithKey,            // Uses user-provided key
  computeVRF,
  
  // Key management
  storeEncryptedKey,             // Store encrypted key in vrf_keys table
  retrieveDecryptedKey,          // Retrieve and decrypt key from vrf_keys table
  checkVRFKeyExists,             // Check if key exists for contract
  
  // Encryption/Decryption
  encryptKey,
  decryptKey,
  
  // Utility functions
  standardizeDataForFingerprint,
  validatePrivateKey,
  getWalletAddress,
  
  // Database functions
  storeVRFFingerprint,
  getStoredFingerprint,
  
  // Testing
  testUserKeyWorkflow
};