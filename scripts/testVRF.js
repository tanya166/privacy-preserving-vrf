const vrfHandler = require('./vrfHandler');

async function testVRF() {
  try {
    const testData = { temperature: 25.4, humidity: 78 };
    console.log('Test data:', testData);
    
    const result = await vrfHandler.generateVRF(testData);
    console.log('VRF generation successful:');
    console.log('- segmentHash:', result.segmentHash);
    console.log('- fingerprint:', result.fingerprint);
    console.log('- secretKey available:', !!result.secretKey);
    
    return result;
  } catch (error) {
    console.error('VRF generation failed:', error);
  }
}

testVRF();