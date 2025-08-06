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

    // Optional: Allow owner to transfer ownership
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
}