
import React, { useState, useEffect } from 'react';
import './App.css';

// Since axios is not available, we'll use fetch instead
const apiCall = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw error;
  }
  
  return response.json();
};

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
      dataFields: [{ key: '', value: '' }],
      file: null
    },
    store: {
      contractAddress: '',
      vrfPrivateKey: '',
      dataFields: [{ key: '', value: '' }],
      file: null
    },
    verify: {
      contractAddress: '',
      dataFields: [{ key: '', value: '' }],
      file: null
    }
  });

  const API_BASE_URL = 'http://localhost:3000';

  useEffect(() => {
    // Test API connectivity
    apiCall(`${API_BASE_URL}/health`)
      .then(response => {
        console.log('✅ API Connection Successful:', response);
      })
      .catch(error => {
        console.warn('⚠️ API Connection Failed:', error.message);
        console.warn('Make sure your backend is running on http://localhost:3000');
      });
  }, []);

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
        dataFields: [{ key: '', value: '' }],
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
        dataFields: [...prev[type].dataFields, { key: '', value: '' }]
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
    const dataObject = {};

    fields.forEach(field => {
      if (field.key.trim() && field.value.trim()) {
        let value = field.value.trim();
        if (!isNaN(value) && value !== '') {
          value = parseFloat(value);
        }
        dataObject[field.key.trim()] = value;
      }
    });

    return Object.keys(dataObject).length > 0 ? [dataObject] : [];
  };

  const handleFileUpload = async (type, file) => {
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      return Array.isArray(jsonData) ? jsonData : [jsonData];
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

      let response;
      
      if (type === 'deploy') {
        const payload = {
          vrfPrivateKey: formData[type].vrfPrivateKey,
          data: jsonData
        };
        response = await apiCall(`${API_BASE_URL}/deploy-and-store`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } else if (type === 'store') {
        const payload = {
          contractAddress: formData[type].contractAddress,
          vrfPrivateKey: formData[type].vrfPrivateKey,
          data: jsonData
        };
        response = await apiCall(`${API_BASE_URL}/store-data`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } else if (type === 'verify') {
        const payload = {
          contractAddress: formData[type].contractAddress,
          data: jsonData
        };
        response = await apiCall(`${API_BASE_URL}/verify`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setResults(prev => ({ ...prev, [type]: { success: true, data: response } }));
      
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        [type]: { 
          success: false, 
          error: error 
        } 
      }));
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const renderDataFields = (type) => {
    return (
      <div className="data-input-section">
        <h4>Data to {type === 'verify' ? 'Verify' : 'Store'}</h4>
        <div className="data-fields">
          {formData[type].dataFields.map((field, index) => (
            <div key={index} className="data-field">
              <input
                type="text"
                className="form-input"
                placeholder="Field name"
                value={field.key}
                onChange={(e) => updateDataField(type, index, 'key', e.target.value)}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Value"
                value={field.value}
                onChange={(e) => updateDataField(type, index, 'value', e.target.value)}
              />
              {formData[type].dataFields.length > 1 && (
                <button
                  type="button"
                  className="remove-field"
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
          className="add-field"
          onClick={() => addDataField(type)}
        >
          + Add Data
        </button>
      </div>
    );
  };

  const renderFileUpload = (type) => {
    return (
      <div className="form-group">
        <label className="form-label">Upload JSON File</label>
        <div 
          className="file-input"
          onClick={() => document.getElementById(`${type}File`).click()}
        >
          <span>
            {formData[type].file ? formData[type].file.name : '📁 Click to select JSON file'}
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
    );
  };

  const renderResult = (type, result) => {
    if (!result) return null;

    if (result.success) {
      if (type === 'deploy') {
        return (
          <div className="result success">
            <h3>✅ Success!</h3>
            <div className="contract-address">
              <strong>📄 Contract Address:</strong><br />
              <code>{result.data.deployment.contractAddress}</code>
            </div>
            <p><strong>Deployment Transaction:</strong> <code>{result.data.deployment.deploymentTx}</code></p>
            <p><strong>Data Stored:</strong> {result.data.storage.summary.successful} items</p>
            <p><strong>Gas Used:</strong> {result.data.storage.results[0]?.gasUsed || 'N/A'}</p>
            <p><strong>Block Number:</strong> {result.data.storage.results[0]?.blockNumber || 'N/A'}</p>
          </div>
        );
      } else if (type === 'store') {
        return (
          <div className="result success">
            <h3>✅ Data Stored Successfully!</h3>
            <p><strong>Contract Address:</strong> <code>{result.data.contractAddress}</code></p>
            <p><strong>Items Stored:</strong> {result.data.summary.successful}</p>
            <p><strong>Transaction Hash:</strong> <code>{result.data.results[0]?.transactionHash || 'N/A'}</code></p>
            <p><strong>Block Number:</strong> {result.data.results[0]?.blockNumber || 'N/A'}</p>
            <p><strong>Gas Used:</strong> {result.data.results[0]?.gasUsed || 'N/A'}</p>
          </div>
        );
      } else if (type === 'verify') {
        return (
          <div className="result success">
            <h3>🔍 Verification Results</h3>
            <p><strong>Contract:</strong> <code>{result.data.contractAddress}</code></p>
            <p><strong>Summary:</strong> {result.data.summary.verified} verified, {result.data.summary.notFound} not found, {result.data.summary.errors} errors</p>
            <hr style={{ margin: '15px 0' }} />
            {result.data.results.map((item, index) => {
              let statusClass = '';
              let statusIcon = '';
              
              if (item.status === 'VERIFIED') {
                statusClass = 'verified';
                statusIcon = '✅';
              } else if (item.status === 'NOT_FOUND') {
                statusClass = 'not-found';
                statusIcon = '⚠️';
              } else {
                statusClass = 'error';
                statusIcon = '❌';
              }

              return (
                <div key={index} className={`verification-result ${statusClass}`}>
                  <strong>{statusIcon} Data Item {index + 1}:</strong><br />
                  <strong>Status:</strong> {item.status}<br />
                  <strong>Message:</strong> {item.message}<br />
                  {item.timestamp && <><strong>Stored:</strong> {new Date(item.timestamp).toLocaleString()}<br /></>}
                  {item.segmentHash && <><strong>Hash:</strong> <code style={{ fontSize: '0.8em' }}>{item.segmentHash}</code><br /></>}
                  <strong>Data:</strong> <code>{JSON.stringify(item.data)}</code>
                </div>
              );
            })}
          </div>
        );
      }
    } else {
      return (
        <div className="result error">
          <h3>❌ Error</h3>
          <p>{result.error.error || result.error.message || result.error}</p>
          {result.error.details && <p><small>{result.error.details}</small></p>}
        </div>
      );
    }
  };

  const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
      <div className="modal" onClick={(e) => e.target.className === 'modal' && onClose()}>
        <div className="modal-content">
          <span className="close" onClick={onClose}>&times;</span>
          <h2>{title}</h2>
          {children}
        </div>
      </div>
    );
  };

  return (
    <div className="vrf-app">
      <div className="container">
        <div className="header">
          <h1>🔐 VRF Blockchain Storage</h1>
          <p>Secure data storage with Verifiable Random Function fingerprints on blockchain</p>
        </div>

        <div className="main-options">
          <div className="option-card">
            <div className="option-header">
              <span className="option-icon">🚀</span>
              <span className="option-title">Deploy & Store</span>
            </div>
            <div className="option-description">
              Create a new smart contract and store your data with VRF fingerprints. Perfect for new projects requiring dedicated blockchain storage.
            </div>
            <button className="btn btn-primary" onClick={() => openModal('deploy')}>
              Deploy & Store Data
            </button>
          </div>

          <div className="option-card">
            <div className="option-header">
              <span className="option-icon">📦</span>
              <span className="option-title">Store Data</span>
            </div>
            <div className="option-description">
              Add data to an existing smart contract. Use this when you have already deployed a contract and want to store additional data.
            </div>
            <button className="btn btn-success" onClick={() => openModal('store')}>
              Store in Existing Contract
            </button>
          </div>

          <div className="option-card">
            <div className="option-header">
              <span className="option-icon">✅</span>
              <span className="option-title">Verify Data</span>
            </div>
            <div className="option-description">
              Verify the integrity of your stored data against the blockchain. Confirm that your data hasn't been tampered with.
            </div>
            <button className="btn btn-warning" onClick={() => openModal('verify')}>
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
          <p>Create a new smart contract and store your data with VRF fingerprints.</p>
          
          <div className="input-method-toggle">
            <button 
              className={`toggle-btn ${inputMethods.deploy === 'form' ? 'active' : ''}`}
              onClick={() => toggleInputMethod('deploy', 'form')}
            >
              Form Input
            </button>
            <button 
              className={`toggle-btn ${inputMethods.deploy === 'file' ? 'active' : ''}`}
              onClick={() => toggleInputMethod('deploy', 'file')}
            >
              Upload JSON
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">VRF Private Key *</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x... (required for VRF fingerprint generation)"
              value={formData.deploy.vrfPrivateKey}
              onChange={(e) => updateFormField('deploy', 'vrfPrivateKey', e.target.value)}
              required
            />
            <small>Required to generate VRF fingerprints for data integrity</small>
          </div>

          {inputMethods.deploy === 'form' ? renderDataFields('deploy') : renderFileUpload('deploy')}

          <button 
            className="btn btn-primary" 
            onClick={() => handleSubmit('deploy')}
            disabled={loading.deploy}
          >
            🚀 Deploy & Store
          </button>

          {loading.deploy && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Deploying contract and storing data... This may take a few minutes.</p>
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
          <p>Add data to an existing smart contract with VRF fingerprints.</p>
          
          <div className="input-method-toggle">
            <button 
              className={`toggle-btn ${inputMethods.store === 'form' ? 'active' : ''}`}
              onClick={() => toggleInputMethod('store', 'form')}
            >
              Form Input
            </button>
            <button 
              className={`toggle-btn ${inputMethods.store === 'file' ? 'active' : ''}`}
              onClick={() => toggleInputMethod('store', 'file')}
            >
              Upload JSON
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Smart Contract Address *</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x..."
              value={formData.store.contractAddress}
              onChange={(e) => updateFormField('store', 'contractAddress', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">VRF Private Key *</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x... (required for VRF fingerprint generation)"
              value={formData.store.vrfPrivateKey}
              onChange={(e) => updateFormField('store', 'vrfPrivateKey', e.target.value)}
              required
            />
            <small>Required to generate VRF fingerprints for data integrity</small>
          </div>

          {inputMethods.store === 'form' ? renderDataFields('store') : renderFileUpload('store')}

          <button 
            className="btn btn-success" 
            onClick={() => handleSubmit('store')}
            disabled={loading.store}
          >
            📦 Store Data
          </button>

          {loading.store && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Storing data with VRF fingerprints...</p>
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
          <p>Verify that your data exists and hasn't been tampered with on the blockchain.</p>
          
          <div className="input-method-toggle">
            <button 
              className={`toggle-btn ${inputMethods.verify === 'form' ? 'active' : ''}`}
              onClick={() => toggleInputMethod('verify', 'form')}
            >
              Form Input
            </button>
            <button 
              className={`toggle-btn ${inputMethods.verify === 'file' ? 'active' : ''}`}
              onClick={() => toggleInputMethod('verify', 'file')}
            >
              Upload JSON
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Smart Contract Address *</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x..."
              value={formData.verify.contractAddress}
              onChange={(e) => updateFormField('verify', 'contractAddress', e.target.value)}
              required
            />
          </div>

          {inputMethods.verify === 'form' ? renderDataFields('verify') : renderFileUpload('verify')}

          <button 
            className="btn btn-warning" 
            onClick={() => handleSubmit('verify')}
            disabled={loading.verify}
          >
            ✅ Verify Data
          </button>

          {loading.verify && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Verifying data integrity...</p>
            </div>
          )}

          {renderResult('verify', results.verify)}
        </Modal>
      </div>
    </div>
  );
};

export default VRFBlockchainApp;