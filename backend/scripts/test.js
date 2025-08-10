// Test script to debug the contract deployment issue
const { ethers } = require('ethers');
require('dotenv').config();

const CONTRACT_ABI = [
    "function storeFingerprint(bytes32 segmentHash, bytes32 vrfFingerprint) public",
    "function verifyFingerprint(bytes32 segmentHash, bytes32 claimedFingerprint) public view returns (bool)",
    "function getFingerprint(bytes32 segmentHash) public view returns (bytes32 vrfFingerprint, uint256 timestamp, bool exists)",
    "function fingerprintExists(bytes32 segmentHash) public view returns (bool)",
    "function owner() public view returns (address)"
];

// Your existing bytecode
const VRF_STORAGE_BYTECODE = "0x608060405234801561001057600080fd5b50336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506106a0806100606000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c80632f745c591461005c5780635b7121f81461008c5780638da5cb5b146100a8578063c5958af9146100c6578063f851a440146100f6575b600080fd5b610076600480360381019061007191906103d5565b610114565b60405161008391906104ac565b60405180910390f35b6100a660048036038101906100a191906103d5565b6101c7565b005b6100b0610256565b6040516100bd9190610431565b60405180910390f35b6100e060048036038101906100db919061044c565b61027c565b6040516100ed9190610475565b60405180910390f35b6100fe6102e9565b60405161010b9190610431565b60405180910390f35b600080600160008481526020019081526020016000206040518060600160405290816000820154815260200160018201548152602001600282015460ff161515815250509050806040015161016d57600080fd5b8060000151915080602001519250600192509250925092565b600160008381526020019081526020016000206000015460001461021a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610211906104e7565b60405180910390fd5b60405180606001604052808281526020014281526020016001151581525060016000848152602001908152602001600020600082015181600001556020820151816001015560408201518160020160006101000a81548160ff02191690831515021790555090505050565b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000600160008381526020019081526020016000206040518060600160405290816000820154815260200160018201548152602001600282015460ff161515815250509050806040015192915050565b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600080fd5b6000819050919050565b61032881610315565b811461033357600080fd5b50565b6000813590506103458161031f565b92915050565b6000819050919050565b61035e8161034b565b811461036957600080fd5b50565b60008135905061037b81610355565b92915050565b60008060408385031215610398576103976102f8565b5b60006103a685828601610336565b92505060206103b78582860161036c565b9150509250929050565b6103ca81610315565b82525050565b60006020820190506103e560008301846103c1565b92915050565b6103f48161034b565b82525050565b600060608201905061040f60008301866103c1565b61041c60208301856103eb565b610429604083018461045c565b949350505050565b600060208201905061044660008301846103c1565b92915050565b60006020828403121561046257610461610310565b5b600061047084828501610336565b91505092915050565b600060208201905061048e60008301846103eb565b92915050565b60008115159050919050565b6104a981610494565b82525050565b60006020820190506104c460008301846104a0565b92915050565b7f46696e6765727072696e7420616c72656164792065786973747300000000000060008201525050565b60006020820190508181036000830152610500816104ca565b9050919050565b50565b61051381610494565b82525050565b600060208201905061052e600083018461050a565b9291505056fea26469706673582212209c8f9b7e6d4a5c3b2f1e0d9c8b7a6958473625140392817465738291046352687464736f6c63430008110033";

async function testDeployment() {
    try {
        console.log('🧪 Testing contract deployment...\n');
        
        // Check environment variables
        const rpcUrl = process.env.POLYGON_RPC;
        const privateKey = process.env.PRIVATE_KEY;
        
        if (!rpcUrl || !privateKey) {
            throw new Error("Missing POLYGON_RPC or PRIVATE_KEY in environment variables");
        }
        
        console.log(`🔗 RPC URL: ${rpcUrl}`);
        console.log(`👤 Private Key: ${privateKey.substring(0, 6)}...${privateKey.substring(privateKey.length - 4)}`);
        
        // Create provider and wallet
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Test network connection
        console.log('\n🔍 Testing network connection...');
        const network = await provider.getNetwork();
        console.log(`✅ Network: ${network.name} (Chain ID: ${network.chainId})`);
        
        const wallet = new ethers.Wallet(privateKey, provider);
        console.log(`👤 Deployer Address: ${wallet.address}`);
        
        // Check balance
        const balance = await provider.getBalance(wallet.address);
        console.log(`💰 Balance: ${ethers.formatEther(balance)} MATIC`);
        
        if (balance === 0n) {
            console.log('❌ No MATIC balance! Add funds to deploy contracts.');
            return;
        }
        
        // Test contract deployment
        console.log('\n🚀 Deploying contract...');
        const contractFactory = new ethers.ContractFactory(CONTRACT_ABI, VRF_STORAGE_BYTECODE, wallet);
        
        const contract = await contractFactory.deploy();
        console.log(`⏳ Transaction Hash: ${contract.deploymentTransaction().hash}`);
        
        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();
        console.log(`📍 Contract Address: ${contractAddress}`);
        
        // Wait for confirmations
        console.log('⏳ Waiting for confirmations...');
        await contract.deploymentTransaction().wait(3);
        
        // Test owner() call
        console.log('\n🔍 Testing owner() function call...');
        try {
            const owner = await contract.owner();
            console.log(`✅ Owner: ${owner}`);
            console.log('🎉 Deployment and owner() call successful!');
        } catch (ownerError) {
            console.log(`❌ Owner() call failed: ${ownerError.message}`);
            
            // Try direct call to the address
            console.log('\n🔍 Testing direct call to contract...');
            const directContract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
            
            try {
                const directOwner = await directContract.owner();
                console.log(`✅ Direct call owner: ${directOwner}`);
            } catch (directError) {
                console.log(`❌ Direct call also failed: ${directError.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testDeployment();