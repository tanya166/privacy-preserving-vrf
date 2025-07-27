require("dotenv").config({ path: './.env' });
const { ethers } = require("hardhat");

async function main() {
    const ContractFactory = await ethers.getContractFactory("VRFStorage"); 
    const contract = await ContractFactory.deploy();

    console.log("Contract deployed to:", await contract.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

