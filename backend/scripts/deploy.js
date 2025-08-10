require("dotenv").config({ path: '../../.env' });
const { ethers } = require('ethers');
const solc = require('solc');

// Your Solidity contract source code
const SOLIDITY_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VRFStorage {
    struct FingerprintData {
        bytes32 vrfFingerprint;
        uint256 timestamp;
        bool exists;
    }
    
    mapping(bytes32 => FingerprintData) public storedFingerprints;
    address public owner;

    event FingerprintStored(bytes32 indexed segmentHash, bytes32 vrfFingerprint, uint256 timestamp);
    event FingerprintUpdated(bytes32 indexed segmentHash, bytes32 oldFingerprint, bytes32 newFingerprint, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can store data");
        _;
    }

    function storeFingerprint(bytes32 segmentHash, bytes32 vrfFingerprint) public onlyOwner {
        bool isUpdate = storedFingerprints[segmentHash].exists;
        bytes32 oldFingerprint = storedFingerprints[segmentHash].vrfFingerprint;
        
        storedFingerprints[segmentHash] = FingerprintData({
            vrfFingerprint: vrfFingerprint,
            timestamp: block.timestamp,
            exists: true
        });

        if (isUpdate) {
            emit FingerprintUpdated(segmentHash, oldFingerprint, vrfFingerprint, block.timestamp);
        } else {
            emit FingerprintStored(segmentHash, vrfFingerprint, block.timestamp);
        }
    }

    function verifyFingerprint(bytes32 segmentHash, bytes32 claimedFingerprint) public view returns (bool) {
        return storedFingerprints[segmentHash].exists && 
               storedFingerprints[segmentHash].vrfFingerprint == claimedFingerprint;
    }

    function getFingerprint(bytes32 segmentHash) public view returns (bytes32 vrfFingerprint, uint256 timestamp, bool exists) {
        FingerprintData memory data = storedFingerprints[segmentHash];
        return (data.vrfFingerprint, data.timestamp, data.exists);
    }

    function getFingerprintTimestamp(bytes32 segmentHash) public view returns (uint256) {
        require(storedFingerprints[segmentHash].exists, "Fingerprint does not exist");
        return storedFingerprints[segmentHash].timestamp;
    }

    function fingerprintExists(bytes32 segmentHash) public view returns (bool) {
        return storedFingerprints[segmentHash].exists;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
}
`;

function compileSolidityContract() {
    console.log('🔧 Compiling Solidity contract...');
    
    try {
        // Prepare the input for the Solidity compiler
        const input = {
            language: 'Solidity',
            sources: {
                'VRFStorage.sol': {
                    content: SOLIDITY_SOURCE
                }
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['abi', 'evm.bytecode']
                    }
                },
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        };

        // Compile the contract
        const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
        
        // Check for compilation errors
        if (compiled.errors) {
            const hasErrors = compiled.errors.some(error => error.severity === 'error');
            
            compiled.errors.forEach(error => {
                if (error.severity === 'error') {
                    console.error('❌ Compilation Error:', error.formattedMessage);
                } else {
                    console.warn('⚠️  Compilation Warning:', error.formattedMessage);
                }
            });
            
            if (hasErrors) {
                throw new Error('Contract compilation failed with errors');
            }
        }

        // Extract the compiled contract
        const contractName = 'VRFStorage';
        const contractData = compiled.contracts['VRFStorage.sol'][contractName];
        
        if (!contractData) {
            throw new Error(`Contract ${contractName} not found in compilation output`);
        }

        const abi = contractData.abi;
        const bytecode = '0x' + contractData.evm.bytecode.object;

        console.log('✅ Contract compiled successfully');
        console.log(`📄 ABI contains ${abi.length} items`);
        console.log(`📄 Bytecode length: ${bytecode.length} characters`);
        
        // Validate bytecode
        if (!bytecode || bytecode === '0x') {
            throw new Error('Compiled bytecode is empty');
        }
        
        return { abi, bytecode };
        
    } catch (error) {
        console.error('❌ Contract compilation failed:', error.message);
        throw new Error(`Compilation failed: ${error.message}`);
    }
}

async function deployContract() {
    try {
        console.log('🚀 Starting self-contained contract deployment...');
        
        // First, compile the contract
        const { abi: CONTRACT_ABI, bytecode: VRF_STORAGE_BYTECODE } = compileSolidityContract();
        
        // Use SEPOLIA_RPC since that's what you're actually connecting to
        const rpcUrl = process.env.SEPOLIA_RPC;
        const privateKey = process.env.PRIVATE_KEY;
        
        console.log('📋 Environment check:');
        console.log(`- RPC URL exists: ${!!rpcUrl}`);
        console.log(`- RPC URL: ${rpcUrl ? rpcUrl.substring(0, 50) + '...' : 'NOT SET'}`);
        console.log(`- Private key exists: ${!!privateKey}`);
        console.log(`- Private key format: ${privateKey ? (privateKey.startsWith('0x') ? 'Valid 0x prefix' : 'Missing 0x prefix') : 'NOT SET'}`);
        console.log(`- Private key length: ${privateKey ? privateKey.length : 'N/A'}`);
                
        if (!rpcUrl || !privateKey) {
            throw new Error("Missing SEPOLIA_RPC or PRIVATE_KEY in environment variables");
        }

        console.log('🌐 Connecting to provider...');
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Test provider connection
        try {
            const network = await provider.getNetwork();
            console.log(`✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
            
            const blockNumber = await provider.getBlockNumber();
            console.log(`📦 Latest block: ${blockNumber}`);
        } catch (providerError) {
            console.error('❌ Provider connection failed:', providerError.message);
            throw new Error(`Provider connection failed: ${providerError.message}`);
        }

        console.log('👤 Creating wallet...');
        const wallet = new ethers.Wallet(privateKey, provider);
        console.log(`📍 Wallet address: ${wallet.address}`);
        
        // Check wallet balance
        try {
            const balance = await wallet.provider.getBalance(wallet.address);
            const balanceInEth = ethers.formatEther(balance);
            console.log(`💰 Wallet balance: ${balanceInEth} ETH`);
            
            if (balance === 0n) {
                throw new Error('Wallet has zero balance - cannot pay for gas');
            }
        } catch (balanceError) {
            console.error('❌ Balance check failed:', balanceError.message);
            throw balanceError;
        }

        console.log('📄 Contract details check:');
        console.log(`- ABI exists: ${!!CONTRACT_ABI}`);
        console.log(`- ABI length: ${CONTRACT_ABI ? CONTRACT_ABI.length : 'N/A'}`);
        console.log('📄 Current ABI functions:', CONTRACT_ABI.filter(item => item.type === 'function').map(item => item.name));
        console.log(`- Bytecode exists: ${!!VRF_STORAGE_BYTECODE}`);
        console.log(`- Bytecode length: ${VRF_STORAGE_BYTECODE ? VRF_STORAGE_BYTECODE.length : 'N/A'}`);
        console.log(`- Bytecode starts with 0x: ${VRF_STORAGE_BYTECODE ? VRF_STORAGE_BYTECODE.startsWith('0x') : 'N/A'}`);

        if (!CONTRACT_ABI || !VRF_STORAGE_BYTECODE) {
            throw new Error('Missing CONTRACT_ABI or VRF_STORAGE_BYTECODE');
        }

        console.log('🏭 Creating contract factory...');
        const contractFactory = new ethers.ContractFactory(CONTRACT_ABI, VRF_STORAGE_BYTECODE, wallet);
        console.log('✅ Contract factory created successfully');

        // Estimate gas for deployment
        try {
            console.log('⛽ Estimating deployment gas...');
            const estimatedGas = await contractFactory.getDeployTransaction().then(tx => 
                wallet.provider.estimateGas(tx)
            );
            console.log(`📊 Estimated gas: ${estimatedGas.toString()}`);
            
            const gasPrice = await wallet.provider.getFeeData();
            console.log(`💸 Gas price data:`, {
                gasPrice: gasPrice.gasPrice?.toString(),
                maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString()
            });
        } catch (gasError) {
            console.warn('⚠️  Gas estimation failed:', gasError.message);
        }

        console.log('🚀 Deploying contract...');
        const deploymentStartTime = Date.now();
        
        // Deploy with explicit gas settings
        const contract = await contractFactory.deploy({
            gasLimit: 3000000, // Increase gas limit
        });
        
        console.log('📄 Contract deployment transaction sent');
        console.log(`🔗 Deployment transaction hash: ${contract.deploymentTransaction()?.hash}`);
        console.log(`📍 Contract deployment address: ${await contract.getAddress()}`);

        console.log('⏳ Waiting for deployment confirmation...');
        await contract.waitForDeployment();
        
        const deploymentTime = Date.now() - deploymentStartTime;
        console.log(`✅ Contract deployed successfully in ${deploymentTime}ms`);
        
        const contractAddress = await contract.getAddress();
        console.log(`📍 Final contract address: ${contractAddress}`);

        console.log('⏳ Waiting for 3 block confirmations...');
        const deployTx = contract.deploymentTransaction();
        if (deployTx) {
            const receipt = await deployTx.wait(3);
            console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
            console.log(`⛽ Gas used: ${receipt.gasUsed?.toString()}`);
        }

        console.log('👑 Checking contract owner...');
        try {
            const owner = await contract.owner();
            console.log(`👤 Contract owner: ${owner}`);
            console.log(`🔍 Owner matches deployer: ${owner.toLowerCase() === wallet.address.toLowerCase()}`);
            
            // Test a contract function to verify ABI compatibility
            console.log('🧪 Testing contract function calls...');
            
            // Test fingerprintExists function
            const testHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            const exists = await contract.fingerprintExists(testHash);
            console.log(`✅ fingerprintExists test: ${exists} (should be false)`);
            
            // Test storedFingerprints mapping
            const storedData = await contract.storedFingerprints(testHash);
            console.log(`✅ storedFingerprints test: exists=${storedData[2]} (should be false)`);
            
            return {
                contractAddress,
                transactionHash: contract.deploymentTransaction()?.hash,
                owner,
                deployerAddress: wallet.address,
                abi: CONTRACT_ABI,
                bytecode: VRF_STORAGE_BYTECODE
            };
        } catch (ownerError) {
            console.error('❌ Failed to get contract owner:', ownerError.message);
            // Still return deployment info even if owner check fails
            return {
                contractAddress,
                transactionHash: contract.deploymentTransaction()?.hash,
                owner: 'OWNER_CHECK_FAILED',
                deployerAddress: wallet.address,
                abi: CONTRACT_ABI,
                bytecode: VRF_STORAGE_BYTECODE
            };
        }
        
    } catch (error) {
        console.error('❌ Deployment failed with error:', error);
        console.error('📋 Error details:');
        console.error(`- Error name: ${error.name || 'Unknown'}`);
        console.error(`- Error code: ${error.code || 'No code'}`);
        console.error(`- Error message: ${error.message || 'No message'}`);
        console.error(`- Error reason: ${error.reason || 'No reason'}`);
        
        if (error.transaction) {
            console.error('📄 Failed transaction details:', {
                to: error.transaction.to,
                from: error.transaction.from,
                data: error.transaction.data ? error.transaction.data.substring(0, 50) + '...' : 'No data',
                gasLimit: error.transaction.gasLimit?.toString(),
                gasPrice: error.transaction.gasPrice?.toString()
            });
        }
        
        if (error.receipt) {
            console.error('🧾 Transaction receipt:', {
                status: error.receipt.status,
                gasUsed: error.receipt.gasUsed?.toString(),
                blockNumber: error.receipt.blockNumber
            });
        }
        
        throw new Error(`Deployment failed: ${error.message}`);
    }
}

module.exports = {
    deployContract,
    compileSolidityContract,
    SOLIDITY_SOURCE
};

// Add this at the end of your file, after the module.exports
if (require.main === module) {
    deployContract()
        .then((result) => {
            console.log('🎉 Deployment completed successfully!');
            console.log('📋 Final Results:', {
                contractAddress: result.contractAddress,
                transactionHash: result.transactionHash,
                owner: result.owner,
                deployerAddress: result.deployerAddress
            });
            
            // Save the ABI and bytecode for future reference
            console.log('\n📄 Contract ABI and Bytecode saved in result object');
            console.log('🔧 You can now interact with your contract using the returned ABI');
            
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Deployment failed:', error.message);
            process.exit(1);
        });
}