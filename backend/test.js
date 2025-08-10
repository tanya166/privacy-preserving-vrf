// test_exports.js - Run this to verify all exports are working
const vrfHandler = require('./scripts/vrfHandler');

console.log('🔍 Testing vrfHandler exports...\n');

const requiredFunctions = [
    'generateVRF',
    'generateVRFWithKey',        // ← This is the problematic one
    'generateVRFKeys',
    'createVRFRecord',
    'compareVRFResults',
    'validatePrivateKey',
    'getWalletAddress',
    'computeVRF',
    'verifyOwnClaim',
    'storeVRFRecord',
    'prepareDataForVerification',
    'standardizeDataForFingerprint'
];

let allExportsFound = true;

requiredFunctions.forEach(funcName => {
    if (typeof vrfHandler[funcName] === 'function') {
        console.log(`✅ ${funcName} - exported correctly`);
    } else {
        console.log(`❌ ${funcName} - NOT EXPORTED or not a function`);
        allExportsFound = false;
    }
});

console.log('\n📋 Available exports:');
console.log(Object.keys(vrfHandler));

console.log(`\n${allExportsFound ? '✅ All required functions exported!' : '❌ Some functions missing from exports!'}`);

// Test the problematic function specifically
if (typeof vrfHandler.generateVRFWithKey === 'function') {
    console.log('\n🎉 generateVRFWithKey is properly exported and ready to use!');
} else {
    console.log('\n❌ generateVRFWithKey is still missing from exports!');
    console.log('💡 Make sure your vrfHandler.js module.exports includes generateVRFWithKey');
}