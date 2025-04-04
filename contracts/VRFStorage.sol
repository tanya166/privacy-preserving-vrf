// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VRFStorage {
    mapping(bytes32 => bytes32) public storedFingerprints;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function storeFingerprint(bytes32 segmentHash, bytes32 vrfFingerprint) public {
        require(msg.sender == owner, "Only owner can store data");
        storedFingerprints[segmentHash] = vrfFingerprint;
    }

    function verifyFingerprint(bytes32 segmentHash, bytes32 claimedFingerprint) public view returns (bool) {
        return storedFingerprints[segmentHash] == claimedFingerprint;
    }
}

