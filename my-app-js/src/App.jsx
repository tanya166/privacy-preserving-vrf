import React, { useState, useEffect } from 'react';

const VRFBlockchainApp = () => {
  const [modals, setModals] = useState({
    deploy: false,
    store: false,
    verify: false
  });

  const [inputMethods, setInputMethods] = useState({
    deploy: 'form',
    store: 'form',
    verify: 'form'
  });

  const [loading, setLoading] = useState({
    deploy: false,
    store: false,
    verify: false
  });

  const [results, setResults] = useState({
    deploy: null,
    store: null,
    verify: null
  });

  const [formData, setFormData] = useState({
    deploy: {
      vrfPrivateKey: '',
      dataFields: [{ name: '', value: '' }],
      file: null
    },
    store: {
      contractAddress: '',
      vrfPrivateKey: '',
      dataFields: [{ name: '', value: '' }],
      file: null
    },
    verify: {
      contractAddress: '',
      dataFields: [{ name: '', value: '' }],
      file: null
    }
  });

  const [apiStatus, setApiStatus] = useState('checking');
  const API_BASE_URL = 'http://localhost:3000';

  const openModal = (modalType) => {
    setModals(prev => ({ ...prev, [modalType]: true }));
  };

  const closeModal = (modalType) => {
    setModals(prev => ({ ...prev, [modalType]: false }));
    setResults(prev => ({ ...prev, [modalType]: null }));
    setLoading(prev => ({ ...prev, [modalType]: false }));
    // Reset form data
    setFormData(prev => ({
      ...prev,
      [modalType]: {
        ...prev[modalType],
        vrfPrivateKey: modalType === 'verify' ? undefined : '',
        contractAddress: modalType === 'deploy' ? undefined : '',
        dataFields: [{ name: '', value: '' }],
        file: null
      }
    }));
  };

  const toggleInputMethod = (type, method) => {
    setInputMethods(prev => ({ ...prev, [type]: method }));
  };

  const addDataField = (type) => {
    setFormData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        dataFields: [...prev[type].dataFields, { name: '', value: '' }]
      }
    }));
  };

  const removeDataField = (type, index) => {
    setFormData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        dataFields: prev[type].dataFields.filter((_, i) => i !== index)
      }
    }));
  };

  const updateDataField = (type, index, field, value) => {
    setFormData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        dataFields: prev[type].dataFields.map((item, i) => 
          i === index ? { ...item, [field]: value } : item
        )
      }
    }));
  };

  const updateFormField = (type, field, value) => {
    setFormData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  const collectFormData = (type) => {
    const fields = formData[type].dataFields;
    const dataObjects = [];

    console.log(`🔍 DEBUG: Collecting form data for ${type}:`, fields);

    fields.forEach((field, index) => {
      console.log(`🔍 Field ${index}:`, { name: field.name, value: field.value });
      
      if (field.name.trim() && field.value.trim()) {
        let value = field.value.trim();
        
        // Convert to number if possible
        const numericValue = Number(value);
        if (!isNaN(numericValue) && isFinite(numericValue) && value !== '') {
          value = numericValue;
          console.log(`✅ Converted to number: ${value} (type: ${typeof value})`);
        } else {
          console.log(`📝 Keeping as string: "${value}" (type: ${typeof value})`);
        }
        
        dataObjects.push({
          name: field.name.trim(),
          value: value
        });
      }
    });

    console.log(`🔍 Final data objects:`, dataObjects);
    return dataObjects;
  };

  const handleFileUpload = async (type, file) => {
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Handle JSON file correctly - extract only the data
      if (jsonData.data && Array.isArray(jsonData.data)) {
        console.warn('⚠️ JSON file contains wrapper object. Extracting data array.');
        return jsonData.data;
      }
      
      // If JSON is directly an array or single object
      const result = Array.isArray(jsonData) ? jsonData : [jsonData];
      
      // Ensure only name and value fields are used
      return result.map(item => ({
        name: item.name,
        value: item.value
      }));
      
    } catch (error) {
      throw new Error('Invalid JSON file');
    }
  };

  const handleSubmit = async (type) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    setResults(prev => ({ ...prev, [type]: null }));

    try {
      // Validate VRF private key for deploy and store operations
      if ((type === 'deploy' || type === 'store') && !formData[type].vrfPrivateKey.trim()) {
        throw new Error('VRF Private Key is required to generate fingerprints');
      }

      // Validate contract address for store and verify operations
      if ((type === 'store' || type === 'verify') && !formData[type].contractAddress.trim()) {
        throw new Error('Smart Contract Address is required');
      }

      let jsonData;
      
      if (inputMethods[type] === 'file' && formData[type].file) {
        jsonData = await handleFileUpload(type, formData[type].file);
      } else {
        jsonData = collectFormData(type);
        if (jsonData.length === 0) {
          throw new Error('Please provide data to process');
        }
      }

      // Simulate API call - replace with actual axios calls
      let response;
      
      if (type === 'deploy') {
        const payload = {
          vrfPrivateKey: formData[type].vrfPrivateKey,
          data: jsonData
        };
        console.log('Deploy payload:', payload);
        // response = await axios.post('/deploy-and-store', payload);
        // For demo purposes:
        response = { data: { deployment: { contractAddress: '0x123...' }, storage: { summary: { successful: jsonData.length } } } };
      } else if (type === 'store') {
        const payload = {
          contractAddress: formData[type].contractAddress,
          vrfPrivateKey: formData[type].vrfPrivateKey,
          data: jsonData
        };
        console.log('Store payload:', payload);
        // response = await axios.post('/store-data', payload);
        // For demo purposes:
        response = { data: { contractAddress: formData[type].contractAddress, summary: { successful: jsonData.length } } };
      } else if (type === 'verify') {
        const payload = {
          contractAddress: formData[type].contractAddress,
          data: jsonData
        };
        console.log('Verify payload:', payload);
        // response = await axios.post('/verify', payload);
        // For demo purposes:
        response = { 
          data: { 
            contractAddress: formData[type].contractAddress, 
            summary: { verified: jsonData.length, notFound: 0, errors: 0 },
            results: jsonData.map((item, index) => ({
              status: 'VERIFIED',
              message: 'Data verified successfully',
              data: item,
              segmentHash: `0x${Math.random().toString(16).substr(2, 8)}...`
            }))
          } 
        };
      }

      setResults(prev => ({ 
        ...prev, 
        [type]: { 
          success: true, 
          data: response.data 
        } 
      }));
      
    } catch (error) {
      console.error(`${type} operation failed:`, error);
      
      setResults(prev => ({ 
        ...prev, 
        [type]: { 
          success: false, 
          error: {
            message: error.message || 'An unexpected error occurred'
          }
        } 
      }));
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const renderJsonFormatInfo = (type) => {
    const actionText = type === 'verify' ? 'verify' : 'store';
    
    return (
      <div className="json-format-info" style={{ 
        background: '#f8f9fa', 
        border: '1px solid #dee2e6', 
        borderRadius: '8px', 
        padding: '15px', 
        margin: '15px 0',
        fontSize: '14px'
      }}>
        <div className="info-header" style={{ marginBottom: '10px', fontWeight: 'bold', color: '#495057' }}>
          <span style={{ marginRight: '8px' }}>ℹ️</span>
          JSON File Format (Name & Value Only)
        </div>
        <p style={{ margin: '0 0 15px 0', color: '#6c757d' }}>
          Your JSON file should contain only <strong>name</strong> and <strong>value</strong> fields to {actionText}.
        </p>
        
        <div className="format-example">
          <div style={{ color: '#28a745', fontWeight: 'bold', marginBottom: '8px' }}>✅ Correct Format:</div>
          <pre style={{ 
            background: '#fff', 
            border: '1px solid #e9ecef', 
            borderRadius: '4px', 
            padding: '10px', 
            overflow: 'auto',
            fontSize: '12px',
            margin: '0'
          }}>
{`[
  {
    "name": "Test Data 1",
    "value": 102
  },
  {
    "name": "Test Data 2", 
    "value": "Sample Text"
  }
]`}
          </pre>
        </div>

        <div style={{ marginTop: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ marginRight: '8px' }}>📝</span>
            <span>Only <strong>name</strong> and <strong>value</strong> fields are needed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ marginRight: '8px' }}>🔢</span>
            <span>Values can be strings or numbers</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>📋</span>
            <span>Use an array format, even for single items</span>
          </div>
        </div>
      </div>
    );
  };

  const renderDataFields = (type) => {
    return (
      <div className="data-input-section" style={{ margin: '20px 0' }}>
        <h4 style={{ marginBottom: '15px', color: '#495057' }}>
          Data to {type === 'verify' ? 'Verify' : 'Store'}
        </h4>
        <div className="data-fields">
          {formData[type].dataFields.map((field, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              gap: '10px', 
              marginBottom: '10px', 
              alignItems: 'center' 
            }}>
              <input
                type="text"
                style={{
                  flex: '1',
                  padding: '10px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                placeholder="Name (e.g., Test Data 1)"
                value={field.name}
                onChange={(e) => updateDataField(type, index, 'name', e.target.value)}
              />
              <input
                type="text"
                style={{
                  flex: '1',
                  padding: '10px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                placeholder="Value (e.g., 102 or Sample Text)"
                value={field.value}
                onChange={(e) => updateDataField(type, index, 'value', e.target.value)}
              />
              {formData[type].dataFields.length > 1 && (
                <button
                  type="button"
                  style={{
                    padding: '8px 12px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  onClick={() => removeDataField(type, index)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          style={{
            padding: '8px 15px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
          onClick={() => addDataField(type)}
        >
          + Add Data
        </button>
      </div>
    );
  };

  const renderFileUpload = (type) => {
    return (
      <div className="file-upload-section">
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Upload JSON File
          </label>
          <div 
            style={{
              border: '2px dashed #dee2e6',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: formData[type].file ? '#f8f9fa' : '#fff'
            }}
            onClick={() => document.getElementById(`${type}File`).click()}
          >
            <span>
              {formData[type].file ? `📁 ${formData[type].file.name}` : '📁 Click to select JSON file'}
            </span>
            <input
              type="file"
              id={`${type}File`}
              style={{ display: 'none' }}
              accept=".json"
              onChange={(e) => updateFormField(type, 'file', e.target.files[0])}
            />
          </div>
        </div>
        
        {renderJsonFormatInfo(type)}
      </div>
    );
  };

  const renderResult = (type, result) => {
    if (!result) return null;

    if (result.success) {
      if (type === 'deploy') {
        return (
          <div style={{ 
            background: '#d4edda', 
            border: '1px solid #c3e6cb', 
            borderRadius: '8px', 
            padding: '15px', 
            margin: '15px 0' 
          }}>
            <h3 style={{ color: '#155724', margin: '0 0 10px 0' }}>✅ Success!</h3>
            <div style={{ marginBottom: '10px' }}>
              <strong>📄 Contract Address:</strong><br />
              <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '3px' }}>
                {result.data.deployment.contractAddress}
              </code>
            </div>
            <p><strong>Data Stored:</strong> {result.data.storage.summary.successful} items</p>
          </div>
        );
      } else if (type === 'store') {
        return (
          <div style={{ 
            background: '#d4edda', 
            border: '1px solid #c3e6cb', 
            borderRadius: '8px', 
            padding: '15px', 
            margin: '15px 0' 
          }}>
            <h3 style={{ color: '#155724', margin: '0 0 10px 0' }}>✅ Data Stored Successfully!</h3>
            <p><strong>Contract Address:</strong> <code>{result.data.contractAddress}</code></p>
            <p><strong>Items Stored:</strong> {result.data.summary.successful}</p>
          </div>
        );
      } else if (type === 'verify') {
        return (
          <div style={{ 
            background: '#d1ecf1', 
            border: '1px solid #bee5eb', 
            borderRadius: '8px', 
            padding: '15px', 
            margin: '15px 0' 
          }}>
            <h3 style={{ color: '#0c5460', margin: '0 0 10px 0' }}>🔍 Verification Results</h3>
            <p><strong>Contract:</strong> <code>{result.data.contractAddress}</code></p>
            <p><strong>Summary:</strong> {result.data.summary.verified} verified, {result.data.summary.notFound} not found, {result.data.summary.errors} errors</p>
            <hr style={{ margin: '15px 0' }} />
            {result.data.results.map((item, index) => {
              let bgColor = '#d4edda'; // verified
              let textColor = '#155724';
              let statusIcon = '✅';
              
              if (item.status === 'NOT_FOUND') {
                bgColor = '#fff3cd';
                textColor = '#856404';
                statusIcon = '⚠️';
              } else if (item.status === 'ERROR') {
                bgColor = '#f8d7da';
                textColor = '#721c24';
                statusIcon = '❌';
              }

              return (
                <div key={index} style={{
                  background: bgColor,
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  padding: '10px',
                  margin: '10px 0',
                  color: textColor
                }}>
                  <strong>{statusIcon} Data Item {index + 1}:</strong><br />
                  <strong>Status:</strong> {item.status}<br />
                  <strong>Message:</strong> {item.message}<br />
                  <strong>Data:</strong> <code>Name: "{item.data.name}", Value: {JSON.stringify(item.data.value)}</code>
                </div>
              );
            })}
          </div>
        );
      }
    } else {
      return (
        <div style={{ 
          background: '#f8d7da', 
          border: '1px solid #f5c6cb', 
          borderRadius: '8px', 
          padding: '15px', 
          margin: '15px 0' 
        }}>
          <h3 style={{ color: '#721c24', margin: '0 0 10px 0' }}>❌ Error</h3>
          <p><strong>Message:</strong> {result.error.message}</p>
        </div>
      );
    }
  };

  const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '20px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{title}</h2>
            <button 
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                lineHeight: '1'
              }}
            >
              &times;
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#495057' }}>🔐 VRF Blockchain Storage</h1>
        <p style={{ color: '#6c757d' }}>Secure data storage with Verifiable Random Function fingerprints on blockchain</p>
        <p style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Simplified: Only Name & Value Required</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '20px',
          background: '#f8f9fa'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <span style={{ fontSize: '24px', marginRight: '10px' }}>🚀</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Deploy & Store</span>
          </div>
          <div style={{ marginBottom: '15px', color: '#6c757d', fontSize: '14px' }}>
            Create a new smart contract and store your name-value data with VRF fingerprints.
          </div>
          <button 
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '10px 20px',
              cursor: 'pointer',
              width: '100%'
            }}
            onClick={() => openModal('deploy')}
          >
            Deploy & Store Data
          </button>
        </div>

        <div style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '20px',
          background: '#f8f9fa'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <span style={{ fontSize: '24px', marginRight: '10px' }}>📦</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Store Data</span>
          </div>
          <div style={{ marginBottom: '15px', color: '#6c757d', fontSize: '14px' }}>
            Add name-value data to an existing smart contract.
          </div>
          <button 
            style={{
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '10px 20px',
              cursor: 'pointer',
              width: '100%'
            }}
            onClick={() => openModal('store')}
          >
            Store in Existing Contract
          </button>
        </div>

        <div style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '20px',
          background: '#f8f9fa'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <span style={{ fontSize: '24px', marginRight: '10px' }}>✅</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Verify Data</span>
          </div>
          <div style={{ marginBottom: '15px', color: '#6c757d', fontSize: '14px' }}>
            Verify the integrity of your name-value data against the blockchain.
          </div>
          <button 
            style={{
              background: '#ffc107',
              color: '#212529',
              border: 'none',
              borderRadius: '4px',
              padding: '10px 20px',
              cursor: 'pointer',
              width: '100%'
            }}
            onClick={() => openModal('verify')}
          >
            Verify Data Integrity
          </button>
        </div>
      </div>

      {/* Deploy & Store Modal */}
      <Modal 
        isOpen={modals.deploy} 
        onClose={() => closeModal('deploy')}
        title="🚀 Deploy Contract & Store Data"
      >
        <p>Create a new smart contract and store your name-value data with VRF fingerprints.</p>
        
        <div style={{ display: 'flex', marginBottom: '20px', border: '1px solid #dee2e6', borderRadius: '4px' }}>
          <button 
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: inputMethods.deploy === 'form' ? '#007bff' : '#f8f9fa',
              color: inputMethods.deploy === 'form' ? 'white' : '#495057',
              cursor: 'pointer'
            }}
            onClick={() => toggleInputMethod('deploy', 'form')}
          >
            Form Input
          </button>
          <button 
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: inputMethods.deploy === 'file' ? '#007bff' : '#f8f9fa',
              color: inputMethods.deploy === 'file' ? 'white' : '#495057',
              cursor: 'pointer'
            }}
            onClick={() => toggleInputMethod('deploy', 'file')}
          >
            Upload JSON
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>VRF Private Key *</label>
          <input
            type="text"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            placeholder="0x... (required for VRF fingerprint generation)"
            value={formData.deploy.vrfPrivateKey}
            onChange={(e) => updateFormField('deploy', 'vrfPrivateKey', e.target.value)}
            required
          />
          <small style={{ color: '#6c757d' }}>Required to generate VRF fingerprints for data integrity</small>
        </div>

        {inputMethods.deploy === 'form' ? renderDataFields('deploy') : renderFileUpload('deploy')}

        <button 
          style={{
            background: loading.deploy ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '12px 20px',
            cursor: loading.deploy ? 'not-allowed' : 'pointer',
            width: '100%',
            fontSize: '16px'
          }}
          onClick={() => handleSubmit('deploy')}
          disabled={loading.deploy}
        >
          {loading.deploy ? '🔄 Deploying...' : '🚀 Deploy & Store'}
        </button>

        {loading.deploy && (
          <div style={{ textAlign: 'center', margin: '20px 0', color: '#6c757d' }}>
            <div>🔄 Deploying contract and storing data... This may take a few minutes.</div>
          </div>
        )}

        {renderResult('deploy', results.deploy)}
      </Modal>

      {/* Store Data Modal */}
      <Modal 
        isOpen={modals.store} 
        onClose={() => closeModal('store')}
        title="📦 Store Data in Existing Contract"
      >
        <p>Add name-value data to an existing smart contract with VRF fingerprints.</p>
        
        <div style={{ display: 'flex', marginBottom: '20px', border: '1px solid #dee2e6', borderRadius: '4px' }}>
          <button 
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: inputMethods.store === 'form' ? '#28a745' : '#f8f9fa',
              color: inputMethods.store === 'form' ? 'white' : '#495057',
              cursor: 'pointer'
            }}
            onClick={() => toggleInputMethod('store', 'form')}
          >
            Form Input
          </button>
          <button 
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: inputMethods.store === 'file' ? '#28a745' : '#f8f9fa',
              color: inputMethods.store === 'file' ? 'white' : '#495057',
              cursor: 'pointer'
            }}
            onClick={() => toggleInputMethod('store', 'file')}
          >
            Upload JSON
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Smart Contract Address *</label>
          <input
            type="text"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            placeholder="0x..."
            value={formData.store.contractAddress}
            onChange={(e) => updateFormField('store', 'contractAddress', e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>VRF Private Key *</label>
          <input
            type="text"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            placeholder="0x... (required for VRF fingerprint generation)"
            value={formData.store.vrfPrivateKey}
            onChange={(e) => updateFormField('store', 'vrfPrivateKey', e.target.value)}
            required
          />
          <small style={{ color: '#6c757d' }}>Required to generate VRF fingerprints for data integrity</small>
        </div>

        {inputMethods.store === 'form' ? renderDataFields('store') : renderFileUpload('store')}

        <button 
          style={{
            background: loading.store ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '12px 20px',
            cursor: loading.store ? 'not-allowed' : 'pointer',
            width: '100%',
            fontSize: '16px'
          }}
          onClick={() => handleSubmit('store')}
          disabled={loading.store}
        >
          {loading.store ? '🔄 Storing...' : '📦 Store Data'}
        </button>

        {loading.store && (
          <div style={{ textAlign: 'center', margin: '20px 0', color: '#6c757d' }}>
            <div>🔄 Storing data with VRF fingerprints...</div>
          </div>
        )}

        {renderResult('store', results.store)}
      </Modal>

      {/* Verify Data Modal */}
      <Modal 
        isOpen={modals.verify} 
        onClose={() => closeModal('verify')}
        title="✅ Verify Data Integrity"
      >
        <p>Verify that your name-value data exists and hasn't been tampered with on the blockchain.</p>
        
        <div style={{ display: 'flex', marginBottom: '20px', border: '1px solid #dee2e6', borderRadius: '4px' }}>
          <button 
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: inputMethods.verify === 'form' ? '#ffc107' : '#f8f9fa',
              color: inputMethods.verify === 'form' ? '#212529' : '#495057',
              cursor: 'pointer'
            }}
            onClick={() => toggleInputMethod('verify', 'form')}
          >
            Form Input
          </button>
          <button 
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: inputMethods.verify === 'file' ? '#ffc107' : '#f8f9fa',
              color: inputMethods.verify === 'file' ? '#212529' : '#495057',
              cursor: 'pointer'
            }}
            onClick={() => toggleInputMethod('verify', 'file')}
          >
            Upload JSON
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Smart Contract Address *</label>
          <input
            type="text"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            placeholder="0x..."
            value={formData.verify.contractAddress}
            onChange={(e) => updateFormField('verify', 'contractAddress', e.target.value)}
            required
          />
        </div>

        {inputMethods.verify === 'form' ? renderDataFields('verify') : renderFileUpload('verify')}

        <button 
          style={{
            background: loading.verify ? '#6c757d' : '#ffc107',
            color: loading.verify ? 'white' : '#212529',
            border: 'none',
            borderRadius: '4px',
            padding: '12px 20px',
            cursor: loading.verify ? 'not-allowed' : 'pointer',
            width: '100%',
            fontSize: '16px'
          }}
          onClick={() => handleSubmit('verify')}
          disabled={loading.verify}
        >
          {loading.verify ? '🔄 Verifying...' : '✅ Verify Data'}
        </button>

        {loading.verify && (
          <div style={{ textAlign: 'center', margin: '20px 0', color: '#6c757d' }}>
            <div>🔄 Verifying data integrity...</div>
          </div>
        )}

        {renderResult('verify', results.verify)}
      </Modal>
    </div>
  );
};

export default VRFBlockchainApp;