require("dotenv").config({ path: '../.env' });

const { ethers } = require("hardhat");

async function main() {
    const ContractFactory = await ethers.getContractFactory("VRFStorage"); // Correct contract name
    const contract = await ContractFactory.deploy(); // Deploy contract

    console.log("Contract deployed to:", await contract.getAddress()); // Use getAddress() in Ethers v6
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

