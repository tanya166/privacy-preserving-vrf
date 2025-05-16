# privacy-preserving-vrf

In blockchain systems, transparency is a key feature, but it comes at the cost of privacy. Our project aims to prove the validity of time-series data (e.g., temperature readings) without exposing the raw data.

We are building a **Prototype Tool** that:

- Lets users store fingerprints of time-series data securely.
- Enables claims like “X happened” without exposing full data.
- Uses VRFs + Blockchain to ensure trust and privacy.

We use **Verifiable Random Functions (VRFs)** to create cryptographic fingerprints of time-series data. These fingerprints allow third parties to verify claims about the data without accessing the original records — enabling privacy and transparency.

---
## Tech stack:
```

Node.js,PostgreSQL,Ethereum (Sepolia Testnet) ,Solidity ,Hardhat, Ethers.js

```

## How to Use This Tool

This tool helps you **generate, store, and selectively verify VRF fingerprints** for time-series data while preserving privacy.


### 1️⃣ Clone the Repo
```bash
git clone https://github.com/your-username/vrf-blockchain-tool.git
cd vrf-blockchain-tool
```
### 2️⃣ Install Dependencies

npm install

### 3️⃣ Set Up Environment Variables
Create a .env file in the root folder and add your config:

```
VRF_SECRET_KEY=your_private_key
DATABASE_URL=your_postgres_connection
INFURA_API_KEY=your_infura_key
WALLET_PRIVATE_KEY=your_wallet_key
CONTRACT_ADDRESS=deployed_smart_contract_address
```

### Step 4: Generate VRF Key Pair

Generate a public and secret key pair for cryptographic hashing.
```bash
node vrfKeyGen.js
```
The secret key will be saved securely in your .env file.

### Step 5: Process Data & Store Fingerprints

Process your raw time-series data (e.g., temperature logs) to create VRF fingerprints and segment hashes, then store them in PostgreSQL.

```bash
node processAndStore.js
```
### Step 6: Deploy Smart Contract (Optional)
Deploy the smart contract to the Sepolia Ethereum testnet to enable on-chain storage of VRF fingerprints.

```bash
npx hardhat run scripts/deploy.js --network sepolia

```

### Step 7: Send Fingerprints to Blockchain (Optional)
Send the stored fingerprints from PostgreSQL to the deployed smart contract on Ethereum.


- Reads VRF fingerprints stored in PostgreSQL.
- Sends them to the deployed smart contract on Sepolia Testnet automatically.
  
```bash

node interact.js
```
### Step 8: Selective Verification (Manual)
To prove claims like “at least one temperature reading > 30°C” without revealing full data:

- Filter your original dataset manually for entries that satisfy the claim.

- Recompute VRF fingerprints for these entries locally using your VRF secret key.

- Share only those matching fingerprints to prove the claim while keeping raw data private.




