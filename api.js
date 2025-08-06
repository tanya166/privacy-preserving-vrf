require("dotenv").config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const pool = require('./backend/database');
const vrfHandler = require('./scripts/vrfHandler');
const processDataModule = require('./scripts/processData');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ 
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json') {
            cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed'), false);
        }
    }
});

const CONTRACT_ABI = [
    "function storeFingerprint(bytes32 segmentHash, bytes32 vrfFingerprint) public",
    "function verifyFingerprint(bytes32 segmentHash, bytes32 claimedFingerprint) public view returns (bool)",
    "function getFingerprint(bytes32 segmentHash) public view returns (bytes32 vrfFingerprint, uint256 timestamp, bool exists)",
    "function fingerprintExists(bytes32 segmentHash) public view returns (bool)",
    "function owner() public view returns (address)"
];

function cleanupFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('Error cleaning up file:', error);
    }
}

async function deployContract() {
    try {
        const contractFile = fs.readFileSync("./artifacts/contracts/VRFStorage.sol/VRFStorage.json");
        const contractJson = JSON.parse(contractFile);
        const { abi, bytecode } = contractJson;
        const NETWORK = "sepolia";
        const rpcUrl = process.env.POLYGON_RPC || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
        if (!rpcUrl || rpcUrl.includes('undefined')) {
            throw new Error("Neither POLYGON_RPC nor ALCHEMY_API_KEY found in environment variables");
        }
        if (!process.env.PRIVATE_KEY) {
            throw new Error("PRIVATE_KEY not found in environment variables");
        }

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const privateKey = process.env.PRIVATE_KEY.startsWith("0x") 
            ? process.env.PRIVATE_KEY 
            : `0x${process.env.PRIVATE_KEY}`;
        
        const wallet = new ethers.Wallet(privateKey, provider);
        const balance = await provider.getBalance(wallet.address);
        
        const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
        const contract = await contractFactory.deploy();
        
        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();
        
        await contract.deploymentTransaction().wait(5);
        
        const owner = await contract.owner();
        
        return {
            contractAddress,
            transactionHash: contract.deploymentTransaction().hash,
            owner,
            deployerAddress: wallet.address,
            balance: ethers.formatEther(balance)
        };
    } catch (error) {
        throw new Error(`Deployment failed: ${error.message}`);
    }
}

function generateVRFKeys() {
    try {
        const wallet = ethers.Wallet.createRandom();
        const privateKey = wallet.privateKey;
        const publicKey = wallet.publicKey;
        
        return {
            privateKey,
            publicKey,
            address: wallet.address
        };
    } catch (error) {
        throw new Error(`Key generation failed: ${error.message}`);
    }
}
async function initializeContractWithAddress(contractAddress) {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC);
    const privateKey = process.env.PRIVATE_KEY.startsWith("0x") 
        ? process.env.PRIVATE_KEY 
        : `0x${process.env.PRIVATE_KEY}`;
    
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    return contract;
}

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Blockchain VRF API is running',
        timestamp: new Date().toISOString()
    });
});

app.post('/generate-keys', (req, res) => {
    try {
        console.log('🔑 Generating new VRF keys...');
        const keys = generateVRFKeys();
        
        console.log('✅ VRF keys generated successfully');
        
        res.json({
            success: true,
            message: 'VRF keys generated successfully',
            keys: {
                privateKey: keys.privateKey,
                publicKey: keys.publicKey,
                address: keys.address
            },
            important: 'SAVE THESE KEYS SECURELY! You will need the private key to store data with VRF fingerprints.'
        });
    } catch (error) {
        console.error('❌ Key generation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate VRF keys',
            details: error.message
        });
    }
});

app.post('/deploy', async (req, res) => {
    try {
        console.log('🚀 Starting contract deployment...');
       
        const artifactPath = "./artifacts/contracts/VRFStorage.sol/VRFStorage.json";
        if (!fs.existsSync(artifactPath)) {
            return res.status(400).json({
                success: false,
                error: 'Contract artifacts not found. Please compile your contract first.',
                details: 'Run: npx hardhat compile'
            });
        }

        const deploymentResult = await deployContract();
        
        console.log('✅ Contract deployed successfully:', deploymentResult.contractAddress);
        
        res.json({
            success: true,
            message: 'Contract deployed successfully',
            deployment: deploymentResult,
            note: 'Use this contract address for storing data'
        });
        
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        res.status(500).json({
            success: false,
            error: 'Contract deployment failed',
            details: error.message
        });
    }
});
app.post('/store-data', upload.single('jsonFile'), async (req, res) => {
    let filePath = null;
    
    try {
        
        const { contractAddress, vrfPrivateKey } = req.body;
        
        if (!contractAddress) {
            return res.status(400).json({
                success: false,
                error: 'Contract address is required. Deploy a contract first or provide an existing one.',
                hint: 'Use POST /deploy to deploy a new contract'
            });
        }

        if (vrfPrivateKey) {
            if (!vrfPrivateKey.startsWith('0x') || vrfPrivateKey.length !== 66) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid VRF private key format. Must be 64 characters hex string starting with 0x'
                });
            }
        }

        let dataToProcess = [];
        if (req.file) {
            filePath = req.file.path;
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);
          
            dataToProcess = Array.isArray(jsonData) ? jsonData : [jsonData];
        } else if (req.body.data) {
          
            dataToProcess = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
        } else {
            return res.status(400).json({
                success: false,
                error: 'No data provided. Send JSON file or data in request body'
            });
        }

        if (dataToProcess.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No data to process'
            });
        }

        console.log(`🚀 Starting unified store operation using processData.js for contract: ${contractAddress}`);
        console.log(`📦 Data segments to process: ${dataToProcess.length}`);
        
        // Get required environment variables
        const privateKey = process.env.PRIVATE_KEY;
        const rpcUrl = process.env.POLYGON_RPC;
        
        if (!privateKey || !rpcUrl) {
            return res.status(500).json({
                success: false,
                error: 'Missing environment configuration. Check PRIVATE_KEY and POLYGON_RPC in .env file'
            });
        }
        const result = await processDataModule.processData(
            dataToProcess, 
            contractAddress, 
            privateKey, 
            rpcUrl,
            vrfPrivateKey 
        );

        res.json({
            success: result.success,
            message: 'VRF processing and blockchain storage completed',
            contractAddress,
            summary: result.summary,
            results: result.results,
            errors: result.errors,
            note: 'This endpoint uses processData.js for unified VRF generation and smart contract storage'
        });

    } catch (error) {
        console.error('Store-Data API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to store data',
            details: error.message
        });
    } finally {
        if (filePath) {
            cleanupFile(filePath);
        }
    }
});
app.post('/deploy-and-store', upload.single('jsonFile'), async (req, res) => {
    let filePath = null;
    
    try {
        const { vrfPrivateKey } = req.body;
        
        if (vrfPrivateKey && (!vrfPrivateKey.startsWith('0x') || vrfPrivateKey.length !== 66)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid VRF private key format. Must be 64 characters hex string starting with 0x'
            });
        }

        let dataToProcess = [];
        
        if (req.file) {
            filePath = req.file.path;
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);
            dataToProcess = Array.isArray(jsonData) ? jsonData : [jsonData];
        } else if (req.body.data) {
            dataToProcess = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
        } else {
            return res.status(400).json({
                success: false,
                error: 'No data provided. Send JSON file or data in request body'
            });
        }

        if (dataToProcess.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No data to process'
            });
        }

        console.log('🚀 Starting deploy and store operation using processData.js...');

        console.log('📄 Deploying contract...');
        const deploymentResult = await deployContract();
        console.log('✅ Contract deployed:', deploymentResult.contractAddress);

        console.log('📦 Processing data with processData.js...');
        
        const privateKey = process.env.PRIVATE_KEY;
        const rpcUrl = process.env.POLYGON_RPC;
        
        if (!privateKey || !rpcUrl) {
            return res.status(500).json({
                success: false,
                error: 'Missing environment configuration. Check PRIVATE_KEY and POLYGON_RPC in .env file'
            });
        }

        const result = await processDataModule.processData(
            dataToProcess, 
            deploymentResult.contractAddress, 
            privateKey, 
            rpcUrl,
            vrfPrivateKey 
        );

        res.json({
            success: result.success,
            message: 'Contract deployed and data processed successfully using processData.js',
            deployment: {
                contractAddress: deploymentResult.contractAddress,
                deploymentTx: deploymentResult.transactionHash,
                owner: deploymentResult.owner,
                deployerAddress: deploymentResult.deployerAddress,
                balance: deploymentResult.balance
            },
            storage: {
                summary: result.summary,
                results: result.results,
                errors: result.errors
            }
        });

    } catch (error) {
        console.error('Deploy-and-Store API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deploy contract and store data',
            details: error.message
        });
    } finally {
        
        if (filePath) {
            cleanupFile(filePath);
        }
    }
});

app.get('/contract/info/:contractAddress', async (req, res) => {
    try {
        const { contractAddress } = req.params;
        
        if (!contractAddress) {
            return res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
        }

        const contract = await initializeContractWithAddress(contractAddress);
        const owner = await contract.owner();
        
        res.json({
            success: true,
            contract: {
                address: contractAddress,
                owner: owner,
                network: 'Sepolia Testnet'
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

app.post('/verify', async (req, res) => {
    try {
        const { data: dataToVerify, contractAddress } = req.body;
        
        if (!dataToVerify) {
            return res.status(400).json({
                success: false,
                error: 'No data provided for verification'
            });
        }

        if (!contractAddress) {
            return res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
        }

        const dataArray = Array.isArray(dataToVerify) ? dataToVerify : [dataToVerify];
        
        const contract = await initializeContractWithAddress(contractAddress);
        const results = [];

        console.log(`🔍 Verifying ${dataArray.length} data entries using vrfHandler...`);

        for (let i = 0; i < dataArray.length; i++) {
            const inputData = dataArray[i];
            
            try {
                console.log(`🔐 Verifying entry ${i + 1}/${dataArray.length}:`, inputData);

                const dataString = JSON.stringify(inputData);
                const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));
               
                const existsOnChain = await contract.fingerprintExists(expectedHash);
                
                if (existsOnChain) {
                    const [storedFingerprint, timestamp, exists] = await contract.getFingerprint(expectedHash);
                    const storedDate = new Date(Number(timestamp) * 1000);

                    results.push({
                        data: inputData,
                        segmentHash: expectedHash,
                        existsOnChain: true,
                        storedFingerprint,
                        timestamp: storedDate.toISOString(),
                        status: 'VERIFIED',
                        message: 'Data found and verified on blockchain'
                    });
                } else {
                    results.push({
                        data: inputData,
                        segmentHash: expectedHash,
                        existsOnChain: false,
                        status: 'NOT_FOUND',
                        message: 'Data not found on blockchain'
                    });
                }

            } catch (error) {
                console.error(`❌ Error verifying entry ${i + 1}:`, error);
                results.push({
                    data: inputData,
                    error: error.message,
                    status: 'ERROR',
                    message: 'Verification error occurred'
                });
            }
        }

        const verified = results.filter(r => r.status === 'VERIFIED').length;
        const notFound = results.filter(r => r.status === 'NOT_FOUND').length;
        const errors = results.filter(r => r.status === 'ERROR').length;

        res.json({
            success: true,
            contractAddress,
            summary: {
                total: dataArray.length,
                verified,
                notFound,
                errors
            },
            results
        });

    } catch (error) {
        console.error('Verify API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify data',
            details: error.message
        });
    }
});

app.get('/data/:contractAddress/:segmentHash', async (req, res) => {
    try {
        const { contractAddress, segmentHash } = req.params;
        
        if (!contractAddress) {
            return res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
        }

        const contract = await initializeContractWithAddress(contractAddress);

        const existsOnChain = await contract.fingerprintExists(segmentHash);
        
        if (!existsOnChain) {
            return res.status(404).json({
                success: false,
                error: 'Data not found on blockchain'
            });
        }

        const [storedFingerprint, timestamp, exists] = await contract.getFingerprint(segmentHash);
        const storedDate = new Date(Number(timestamp) * 1000);

        const dbResult = await pool.query(
            'SELECT vrf_fingerprint, secret_key, timestamp FROM time_series_vrf WHERE segment_hash = $1',
            [segmentHash]
        );

        const response = {
            success: true,
            data: {
                contractAddress,
                segmentHash,
                storedFingerprint,
                timestamp: storedDate.toISOString(),
                existsOnChain: true
            }
        };

        if (dbResult.rows.length > 0) {
            response.data.databaseInfo = {
                originalFingerprint: dbResult.rows[0].vrf_fingerprint,
                secretKeyHash: ethers.keccak256(dbResult.rows[0].secret_key), 
                dbTimestamp: dbResult.rows[0].timestamp
            };
        }

        res.json(response);

    } catch (error) {
        console.error('Get Data API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get data info',
            details: error.message
        });
    }
});

app.get('/data/:contractAddress', async (req, res) => {
    try {
        const { contractAddress } = req.params;
        const { limit = 100, offset = 0 } = req.query;
        
        if (!contractAddress) {
            return res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
        }

        const dbResult = await pool.query(
            'SELECT segment_hash, vrf_fingerprint, timestamp FROM time_series_vrf ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
            [parseInt(limit), parseInt(offset)]
        );

        const dataEntries = dbResult.rows.map(row => ({
            segmentHash: row.segment_hash,
            fingerprint: row.vrf_fingerprint.substring(0, 10) + '...', 
            timestamp: row.timestamp
        }));

        res.json({
            success: true,
            contractAddress,
            count: dataEntries.length,
            data: dataEntries,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: dataEntries.length === parseInt(limit)
            }
        });

    } catch (error) {
        console.error('List Data API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list data entries',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 VRF Blockchain API Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📖 Available endpoints:`);
    console.log(`   POST /generate-keys - Generate new VRF keys`);
    console.log(`   POST /deploy - Deploy new VRF storage contract`);
    console.log(`   POST /store-data - Store data with VRF fingerprints`);
    console.log(`   POST /deploy-and-store - Deploy contract and store data in one step`);
    console.log(`   POST /verify - Verify data integrity against blockchain`);
    console.log(`   GET /contract/info/:address - Get contract information`);
    console.log(`   GET /data/:contractAddress/:segmentHash - Get specific data info`);
    console.log(`   GET /data/:contractAddress - List all data for contract`);
});