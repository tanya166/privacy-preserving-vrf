import React, { useState } from 'react';

const DataVerificationForm = () => {
  const [contractAddress, setContractAddress] = useState('');
  const [formFields, setFormFields] = useState([{ fieldName: '', value: '' }]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleAddField = () => {
    setFormFields([...formFields, { fieldName: '', value: '' }]);
  };

  const handleRemoveField = (index) => {
    const newFields = formFields.filter((_, i) => i !== index);
    setFormFields(newFields);
  };

  const handleFieldChange = (index, key, value) => {
    const newFields = [...formFields];
    newFields[index][key] = value;
    setFormFields(newFields);
  };

  const handleStoreData = async () => {
    setLoading(true);
    try {
      // Convert form fields to data object
      const data = {};
      formFields.forEach(field => {
        if (field.fieldName && field.value) {
          // Try to parse as number if possible, otherwise keep as string
          const parsedValue = isNaN(field.value) ? field.value : Number(field.value);
          data[field.fieldName] = parsedValue;
        }
      });

      const response = await fetch('http://localhost:3000/store-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractAddress,
          data
        }),
      });

      const result = await response.json();
      setResults(result);
      console.log('Store result:', result);
    } catch (error) {
      console.error('Error storing data:', error);
      setResults({ success: false, error: error.message });
    }
    setLoading(false);
  };

  const handleVerifyData = async () => {
    setLoading(true);
    try {
      // Convert form fields to data object
      const data = {};
      formFields.forEach(field => {
        if (field.fieldName && field.value) {
          // Try to parse as number if possible, otherwise keep as string
          const parsedValue = isNaN(field.value) ? field.value : Number(field.value);
          data[field.fieldName] = parsedValue;
        }
      });

      const response = await fetch('http://localhost:3000/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractAddress,
          data
        }),
      });

      const result = await response.json();
      setResults(result);
      console.log('Verify result:', result);
    } catch (error) {
      console.error('Error verifying data:', error);
      setResults({ success: false, error: error.message });
    }
    setLoading(false);
  };

  const handleDeployAndStore = async () => {
    setLoading(true);
    try {
      // Convert form fields to data object
      const data = {};
      formFields.forEach(field => {
        if (field.fieldName && field.value) {
          // Try to parse as number if possible, otherwise keep as string
          const parsedValue = isNaN(field.value) ? field.value : Number(field.value);
          data[field.fieldName] = parsedValue;
        }
      });

      const response = await fetch('http://localhost:3000/deploy-and-store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data
        }),
      });

      const result = await response.json();
      if (result.success && result.deployment) {
        setContractAddress(result.deployment.contractAddress);
      }
      setResults(result);
      console.log('Deploy and store result:', result);
    } catch (error) {
      console.error('Error deploying and storing data:', error);
      setResults({ success: false, error: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          ✅ Verify Data Integrity
        </h2>
        <p className="text-gray-600 mb-4">
          Verify that your data exists and hasn't been tampered with on the blockchain.
        </p>
      </div>

      {/* Contract Address Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Smart Contract Address *
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Dynamic Form Fields */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-4">Data to Store/Verify</h3>
        
        {formFields.map((field, index) => (
          <div key={index} className="flex gap-4 mb-4 items-center">
            <input
              type="text"
              placeholder="Field name (e.g., temperature, value, humidity)"
              value={field.fieldName}
              onChange={(e) => handleFieldChange(index, 'fieldName', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Value (e.g., 100, 25, hello)"
              value={field.value}
              onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {formFields.length > 1 && (
              <button
                onClick={() => handleRemoveField(index)}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        
        <button
          onClick={handleAddField}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          + Add Field
        </button>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-4">
        <button
          onClick={handleDeployAndStore}
          disabled={loading || formFields.some(f => !f.fieldName || !f.value)}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : '🚀 Deploy Contract & Store Data'}
        </button>

        <button
          onClick={handleStoreData}
          disabled={loading || !contractAddress || formFields.some(f => !f.fieldName || !f.value)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : '💾 Store Data'}
        </button>

        <button
          onClick={handleVerifyData}
          disabled={loading || !contractAddress || formFields.some(f => !f.fieldName || !f.value)}
          className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : '✅ Verify Data'}
        </button>
      </div>

      {/* Results Display */}
      {results && (
        <div className="mt-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Results</h3>
          
          {results.success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <span className="text-green-600 text-xl mr-2">✅</span>
                <span className="text-green-800 font-medium">
                  {results.message || 'Operation completed successfully!'}
                </span>
              </div>

              {/* Contract Address Display */}
              {results.deployment && (
                <div className="bg-white p-4 rounded-lg mb-4 border border-green-200">
                  <h4 className="font-medium text-gray-800 mb-2">Contract Deployment</h4>
                  <p className="text-sm text-gray-600 break-all">
                    <strong>Address:</strong> {results.deployment.contractAddress}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Transaction:</strong> {results.deployment.deploymentTx}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Owner:</strong> {results.deployment.owner}
                  </p>
                </div>
              )}

              {/* Contract Address for other operations */}
              {results.contractAddress && !results.deployment && (
                <div className="bg-white p-4 rounded-lg mb-4 border border-green-200">
                  <p className="text-sm text-gray-600 break-all">
                    <strong>Contract Address:</strong> {results.contractAddress}
                  </p>
                </div>
              )}

              {/* Summary Display */}
              {results.summary && (
                <div className="bg-white p-4 rounded-lg mb-4 border border-green-200">
                  <h4 className="font-medium text-gray-800 mb-2">Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total:</span>
                      <span className="ml-2 font-medium">{results.summary.total}</span>
                    </div>
                    {results.summary.verified !== undefined && (
                      <div>
                        <span className="text-green-600">Verified:</span>
                        <span className="ml-2 font-medium text-green-800">{results.summary.verified}</span>
                      </div>
                    )}
                    {results.summary.stored !== undefined && (
                      <div>
                        <span className="text-blue-600">Stored:</span>
                        <span className="ml-2 font-medium text-blue-800">{results.summary.stored}</span>
                      </div>
                    )}
                    {results.summary.notFound !== undefined && (
                      <div>
                        <span className="text-yellow-600">Not Found:</span>
                        <span className="ml-2 font-medium text-yellow-800">{results.summary.notFound}</span>
                      </div>
                    )}
                    {results.summary.errors !== undefined && results.summary.errors > 0 && (
                      <div>
                        <span className="text-red-600">Errors:</span>
                        <span className="ml-2 font-medium text-red-800">{results.summary.errors}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Processed Data Display */}
              {results.processedData && (
                <div className="bg-white p-4 rounded-lg mb-4 border border-green-200">
                  <h4 className="font-medium text-gray-800 mb-2">Processed Data</h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
                    {JSON.stringify(results.processedData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Verification Results */}
              {results.results && Array.isArray(results.results) && (
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-gray-800 mb-2">Detailed Results</h4>
                  {results.results.map((result, index) => (
                    <div key={index} className="mb-3 p-3 border rounded">
                      <div className="flex items-center mb-2">
                        <span className={`w-3 h-3 rounded-full mr-2 ${
                          result.status === 'VERIFIED' ? 'bg-green-500' :
                          result.status === 'NOT_FOUND' ? 'bg-yellow-500' :
                          result.status === 'STORED' ? 'bg-blue-500' : 'bg-red-500'
                        }`}></span>
                        <span className="font-medium">
                          {result.status}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <p><strong>Input:</strong> {JSON.stringify(result.originalInput || result.data)}</p>
                        {result.message && <p><strong>Message:</strong> {result.message}</p>}
                        {result.timestamp && <p><strong>Timestamp:</strong> {result.timestamp}</p>}
                        {result.segmentHash && (
                          <p className="break-all"><strong>Hash:</strong> {result.segmentHash}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <span className="text-red-600 text-xl mr-2">❌</span>
                <span className="text-red-800 font-medium">Operation Failed</span>
              </div>
              <p className="text-red-700 text-sm">
                <strong>Error:</strong> {results.error || 'Unknown error occurred'}
              </p>
              {results.details && (
                <p className="text-red-600 text-xs mt-2">
                  <strong>Details:</strong> {results.details}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Usage Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="flex items-center font-medium text-blue-800 mb-2">
          <span className="text-blue-600 mr-2">ℹ️</span>
          How to use:
        </h4>
        <div className="text-blue-700 text-sm space-y-2">
          <p><strong>1. Deploy & Store:</strong> Creates a new contract and stores your data (no contract address needed)</p>
          <p><strong>2. Store Data:</strong> Stores data in an existing contract (requires contract address)</p>
          <p><strong>3. Verify Data:</strong> Checks if your data exists and is valid on the blockchain</p>
          <p><strong>Example fields:</strong> temperature: 25, humidity: 80, value: 100</p>
        </div>
      </div>

      {/* Example Data */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">Example Data to Try:</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white p-3 rounded border">
            <p className="font-medium text-gray-700">Temperature Sensor</p>
            <p className="text-gray-600">temperature: 25</p>
            <p className="text-gray-600">humidity: 80</p>
          </div>
          <div className="bg-white p-3 rounded border">
            <p className="font-medium text-gray-700">IoT Device</p>
            <p className="text-gray-600">device_id: sensor_01</p>
            <p className="text-gray-600">status: active</p>
          </div>
          <div className="bg-white p-3 rounded border">
            <p className="font-medium text-gray-700">Simple Value</p>
            <p className="text-gray-600">value: 100</p>
            <p className="text-gray-600">type: measurement</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataVerificationForm;