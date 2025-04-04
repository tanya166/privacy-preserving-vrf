const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VRFStorage", function () {
    let contract, owner;

    beforeEach(async function () {
        const VRFStorage = await ethers.getContractFactory("VRFStorage");
        contract = await VRFStorage.deploy();
        await contract.waitForDeployment();
        [owner] = await ethers.getSigners();
    });

    it("Should store and verify fingerprints", async function () {
        const segmentHash = ethers.keccak256(ethers.toUtf8Bytes("segment1"));
        const vrfFingerprint = ethers.keccak256(ethers.toUtf8Bytes("fingerprint1"));

        await contract.storeFingerprint(segmentHash, vrfFingerprint);
        expect(await contract.verifyFingerprint(segmentHash, vrfFingerprint)).to.be.true;
    });

    it("Should not verify incorrect fingerprints", async function () {
        const segmentHash = ethers.keccak256(ethers.toUtf8Bytes("segment2"));
        const wrongFingerprint = ethers.keccak256(ethers.toUtf8Bytes("wrong"));

        expect(await contract.verifyFingerprint(segmentHash, wrongFingerprint)).to.be.false;
    });
});
