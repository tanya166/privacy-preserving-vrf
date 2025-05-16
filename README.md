# privacy-preserving-vrf

In blockchain systems, transparency is a key feature, but it comes at the cost of privacy. Our project aims to prove the validity of time-series data (e.g., temperature readings) without exposing the raw data.

We are building a **Prototype Tool** that:

- Lets users store fingerprints of time-series data securely.
- Enables claims like “X happened” without exposing full data.
- Uses VRFs + Blockchain to ensure trust and privacy.

We use **Verifiable Random Functions (VRFs)** to create cryptographic fingerprints of time-series data. These fingerprints allow third parties to verify claims about the data without accessing the original records — enabling privacy and transparency.

---

## Steps to Use

### 1️⃣ Clone the Repo
```bash
git clone https://github.com/your-username/vrf-blockchain-tool.git
cd vrf-blockchain-tool
2️⃣ Install Dependencies

npm install
3️⃣ Set Up Environment Variables
Create a .env file in the root folder and add your config:

VRF_SECRET_KEY=your_private_key
DATABASE_URL=your_postgres_connection_string
4️⃣ Generate VRF Keys
Run the key generation script (or use the included logic in your main script) to create a VRF key pair:

Store the secret key in .env.

Keep the public key for verification purposes.

5️⃣ Process and Store Fingerprints
Use the fingerprinting module/script to:

Read raw time-series data (e.g., temperature logs),

Generate a VRF fingerprint and segment hash for each entry,

Store them in the PostgreSQL database.

🔸 This is the core part of the tool. You’re building verifiable proof without saving actual data.

6️⃣ (Optional) Store Fingerprints on Blockchain
If you’ve deployed your smart contract to the Sepolia Ethereum Testnet, you can manually send selected fingerprints to the blockchain:

Open Hardhat console:

npx hardhat console --network sepolia
Call the contract’s function:

const contract = await ethers.getContractAt("YourContract", "0xYourContractAddress");
await contract.storeFingerprint("0xFINGERPRINT_HASH");
❗ You’ll need to manually interact with the smart contract.

7️⃣ Selective Verification (Manual)
To verify a claim like “temperature > 30°C”:

Filter the original data manually.

Recompute fingerprints for those filtered entries using the VRF logic.

Share only the matching fingerprints and hashes.

🔸 This step must be done manually for now.


