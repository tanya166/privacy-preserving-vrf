const { ethers } = require('hardhat');

async function main() {
    const VRFStorage = await ethers.getContractFactory('VRFStorage');
    const contract = await VRFStorage.deploy();
    await contract.deployed();
    
    console.log('Contract deployed at:', contract.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
