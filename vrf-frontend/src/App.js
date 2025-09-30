import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const App = () => {
  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vrfKeys, setVrfKeys] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [dataToStore, setDataToStore] = useState([{ name: '', value: '' }]);
  const [verificationData, setVerificationData] = useState({ name: '', value: '', contractAddress: '' });
  const [results, setResults] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('store'); // 'store' or 'verify'

  const API_BASE = 'https://vrf-backend.onrender.com';

  // Helper function to add alerts
  const addAlert = (message, type = 'info') => {
    const alert = { id: Date.now(), message, type };
    setAlerts(prev => [...prev, alert]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    }, 5000);
  };

  // Step 1: Generate VRF Keys
  const generateKeys = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/generate-keys`);
      setVrfKeys(response.data.keys);
      addAlert('VRF keys generated successfully! Please save your private key securely.', 'success');
    } catch (error) {
      addAlert(`Error generating keys: ${error.response?.data?.error || error.message}`, 'error');
    }
    setLoading(false);
  };

  // Step 2: Deploy Contract
  const deployContract = async () => {
    if (!vrfKeys?.privateKey) {
      addAlert('Please generate VRF keys first!', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/deploy-contract`, {
        vrfPrivateKey: vrfKeys.privateKey
      });
      
      setContractInfo(response.data);
      addAlert('Smart contract deployed successfully!', 'success');
      setCurrentStep(3);
    } catch (error) {
      addAlert(`Error deploying contract: ${error.response?.data?.error || error.message}`, 'error');
    }
    setLoading(false);
  };

  // Step 3: Store Data
  const storeData = async () => {
    if (!contractInfo?.contractAddress) {
      addAlert('Please deploy a contract first!', 'error');
      return;
    }

    // Validate data
    const validData = dataToStore.filter(item => item.name.trim() && item.value.toString().trim());
    if (validData.length === 0) {
      addAlert('Please enter at least one valid name-value pair!', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/store-data`, {
        contractAddress: contractInfo.contractAddress,
        data: validData
      });
      
      setResults(response.data);
      addAlert(`Data stored successfully! ${response.data.summary.successful} items stored.`, 'success');
      setCurrentStep(4);
    } catch (error) {
      addAlert(`Error storing data: ${error.response?.data?.error || error.message}`, 'error');
    }
    setLoading(false);
  };

  // Verify Data (Independent)
  const verifyData = async () => {
    if (!verificationData.contractAddress.trim()) {
      addAlert('Please enter a contract address for verification!', 'error');
      return;
    }

    if (!verificationData.name.trim() || !verificationData.value.toString().trim()) {
      addAlert('Please enter both name and value for verification!', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/verify`, {
        contractAddress: verificationData.contractAddress,
        name: verificationData.name,
        value: verificationData.value
      });
      
      setResults(response.data);
      
      const verifiedCount = response.data.summary.verified;
      if (verifiedCount > 0) {
        addAlert('Data verification successful! Data integrity confirmed.', 'success');
      } else {
        const notFoundCount = response.data.summary.notFound;
        if (notFoundCount > 0) {
          addAlert('Data not found on the blockchain. It may not have been stored or the details don\'t match.', 'warning');
        } else {
          addAlert('Data verification failed. The data may have been tampered with.', 'error');
        }
      }
    } catch (error) {
      addAlert(`Error verifying data: ${error.response?.data?.error || error.message}`, 'error');
    }
    setLoading(false);
  };

  // Add new data row
  const addDataRow = () => {
    setDataToStore(prev => [...prev, { name: '', value: '' }]);
  };

  // Remove data row
  const removeDataRow = (index) => {
    setDataToStore(prev => prev.filter((_, i) => i !== index));
  };

  // Update data row
  const updateDataRow = (index, field, value) => {
    setDataToStore(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addAlert('Copied to clipboard!', 'info');
  };

  // Reset data when switching tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setResults(null);
    if (tab === 'verify') {
      setVerificationData({ name: '', value: '', contractAddress: '' });
    }
    if (tab === 'store') {
      // Reset store workflow if needed
      setCurrentStep(1);
    }
  };

  return (
    <div className="app">
      {/* Alert System */}
      <div className="alert-container">
        {alerts.map(alert => (
          <div key={alert.id} className={`alert alert-${alert.type}`}>
            <span>{alert.message}</span>
            <button 
              className="alert-close"
              onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="header">
        <div className="container">
          <h1>🔐 VRF Blockchain Data Integrity System</h1>
          <p>Secure, verifiable data storage using blockchain technology and cryptographic fingerprints</p>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <div className="main-tabs">
        <div className="container">
          <div className="tab-buttons">
            <button 
              className={`tab-button ${activeTab === 'store' ? 'active' : ''}`}
              onClick={() => handleTabChange('store')}
            >
              💾 Store Data
              <span className="tab-description">Generate keys → Deploy contract → Store data</span>
            </button>
            <button 
              className={`tab-button ${activeTab === 'verify' ? 'active' : ''}`}
              onClick={() => handleTabChange('verify')}
            >
              🔍 Verify Data
              <span className="tab-description">Verify existing blockchain data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="main">
        <div className="container">
          
          {/* Store Data Tab */}
          {activeTab === 'store' && (
            <>
              {/* Progress Indicator */}
              <div className="progress-bar">
                <div className="progress-steps">
                  {[
                    { step: 1, label: 'Generate Keys', icon: '🔑' },
                    { step: 2, label: 'Deploy Contract', icon: '📄' },
                    { step: 3, label: 'Store Data', icon: '💾' },
                    { step: 4, label: 'Complete', icon: '✅' }
                  ].map(({ step, label, icon }) => (
                    <div key={step} className={`progress-step ${currentStep >= step ? 'active' : ''}`}>
                      <div className="step-circle">
                        {currentStep > step ? '✓' : step}
                      </div>
                      <div className="step-label">
                        <span className="step-icon">{icon}</span>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 1: Generate VRF Keys */}
              <div className={`step-card ${currentStep === 1 ? 'active' : ''}`}>
                <div className="step-header">
                  <div className="step-number">1</div>
                  <div className="step-title">
                    <h2>🔑 Generate VRF Keys</h2>
                    <p>Create unique cryptographic keys for data fingerprinting</p>
                  </div>
                </div>
                <div className="step-content">
                  <div className="step-description">
                    <p>
                      VRF (Verifiable Random Function) keys are used to create unique cryptographic fingerprints for your data. 
                      These keys ensure that your data's integrity can be verified later.
                    </p>
                    <div className="info-box">
                      <strong>🛡️ Security Note:</strong> Your private key is crucial for data verification. Store it securely and never share it!
                    </div>
                  </div>
                  
                  {!vrfKeys ? (
                    <div className="action-section">
                      <button 
                        className="btn btn-primary btn-large"
                        onClick={generateKeys}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="spinner"></span>
                            Generating Keys...
                          </>
                        ) : (
                          <>
                            🔑 Generate VRF Keys
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="keys-display">
                      <div className="alert alert-warning">
                        <strong>⚠️ Critical:</strong> Save your private key immediately! You cannot recover it if lost.
                      </div>
                      
                      <div className="key-section">
                        <div className="key-item">
                          <label>🔐 Private Key (Keep Secret):</label>
                          <div className="key-value">
                            <code className="private-key">{vrfKeys.privateKey}</code>
                            <button 
                              className="btn btn-copy"
                              onClick={() => copyToClipboard(vrfKeys.privateKey)}
                              title="Copy to clipboard"
                            >
                              📋 Copy
                            </button>
                          </div>
                        </div>
                        
                        <div className="key-item">
                          <label>🏠 Wallet Address:</label>
                          <div className="key-value">
                            <code>{vrfKeys.address}</code>
                            <button 
                              className="btn btn-copy"
                              onClick={() => copyToClipboard(vrfKeys.address)}
                              title="Copy to clipboard"
                            >
                              📋 Copy
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="action-section">
                        <button 
                          className="btn btn-success btn-large"
                          onClick={() => setCurrentStep(2)}
                        >
                          ✅ Continue to Deploy Contract
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Deploy Smart Contract */}
              {currentStep >= 2 && (
                <div className={`step-card ${currentStep === 2 ? 'active' : ''}`}>
                  <div className="step-header">
                    <div className="step-number">2</div>
                    <div className="step-title">
                      <h2>📄 Deploy Smart Contract</h2>
                      <p>Deploy your data storage contract to the blockchain</p>
                    </div>
                  </div>
                  <div className="step-content">
                    <div className="step-description">
                      <p>
                        Deploy a smart contract to the Sepolia testnet that will store cryptographic fingerprints of your data. 
                        The contract will be owned by your wallet and only you can store data in it.
                      </p>
                      <div className="info-box">
                        <strong>🌐 Network:</strong> This will deploy to Sepolia Testnet (free test network)
                      </div>
                    </div>
                    
                    {!contractInfo ? (
                      <div className="action-section">
                        <button 
                          className="btn btn-primary btn-large"
                          onClick={deployContract}
                          disabled={loading || !vrfKeys}
                        >
                          {loading ? (
                            <>
                              <span className="spinner"></span>
                              Deploying Contract...
                            </>
                          ) : (
                            <>
                              🚀 Deploy Smart Contract
                            </>
                          )}
                        </button>
                        {!vrfKeys && (
                          <p className="error-text">Please generate VRF keys first!</p>
                        )}
                      </div>
                    ) : (
                      <div className="contract-info">
                        <div className="alert alert-success">
                          <strong>🎉 Smart contract deployed successfully!</strong>
                        </div>
                        
                        <div className="info-grid">
                          <div className="info-item">
                            <label>📍 Contract Address:</label>
                            <div className="info-value">
                              <code>{contractInfo.contractAddress}</code>
                              <button 
                                className="btn btn-copy"
                                onClick={() => copyToClipboard(contractInfo.contractAddress)}
                              >
                                📋
                              </button>
                            </div>
                          </div>
                          
                          <div className="info-item">
                            <label>🔗 Transaction Hash:</label>
                            <div className="info-value">
                              <code>{contractInfo.transactionHash}</code>
                              <button 
                                className="btn btn-copy"
                                onClick={() => copyToClipboard(contractInfo.transactionHash)}
                              >
                                📋
                              </button>
                            </div>
                          </div>
                          
                          <div className="info-item">
                            <label>👑 Contract Owner:</label>
                            <div className="info-value">
                              <code>{contractInfo.owner}</code>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Store Data */}
              {currentStep >= 3 && (
                <div className={`step-card ${currentStep === 3 ? 'active' : ''}`}>
                  <div className="step-header">
                    <div className="step-number">3</div>
                    <div className="step-title">
                      <h2>💾 Store Data</h2>
                      <p>Create cryptographic fingerprints of your data</p>
                    </div>
                  </div>
                  <div className="step-content">
                    <div className="step-description">
                      <p>
                        Store your data by creating cryptographic fingerprints. Each data entry needs a descriptive name and a value. 
                        The system will create a unique fingerprint that proves the data's integrity.
                      </p>
                      <div className="info-box">
                        <strong>📝 Format:</strong> Each entry needs a "name" (description) and "value" (the actual data)
                      </div>
                    </div>
                    
                    <div className="data-input-section">
                      <h3>📊 Enter Data to Store:</h3>
                      
                      <div className="data-examples">
                        <h4>💡 Examples:</h4>
                        <div className="example-grid">
                          <div className="example">
                            <strong>Name:</strong> "Temperature Reading"<br/>
                            <strong>Value:</strong> "25.5"
                          </div>
                          <div className="example">
                            <strong>Name:</strong> "Sensor ID"<br/>
                            <strong>Value:</strong> "SENS001"
                          </div>
                          <div className="example">
                            <strong>Name:</strong> "User Count"<br/>
                            <strong>Value:</strong> "1247"
                          </div>
                        </div>
                      </div>
                      
                      <div className="data-entries">
                        {dataToStore.map((item, index) => (
                          <div key={index} className="data-row">
                            <div className="data-row-header">
                              <span className="entry-number">Entry #{index + 1}</span>
                              {dataToStore.length > 1 && (
                                <button 
                                  className="btn btn-danger btn-small"
                                  onClick={() => removeDataRow(index)}
                                  title="Remove this entry"
                                >
                                  🗑️ Remove
                                </button>
                              )}
                            </div>
                            
                            <div className="input-row">
                              <div className="input-group">
                                <label>📝 Name (Description):</label>
                                <input
                                  type="text"
                                  placeholder="e.g., Temperature Reading"
                                  value={item.name}
                                  onChange={(e) => updateDataRow(index, 'name', e.target.value)}
                                  className="input-field"
                                />
                              </div>
                              
                              <div className="input-group">
                                <label>💾 Value (Data):</label>
                                <input
                                  type="text"
                                  placeholder="e.g., 25.5"
                                  value={item.value}
                                  onChange={(e) => updateDataRow(index, 'value', e.target.value)}
                                  className="input-field"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="data-actions">
                        <button 
                          className="btn btn-secondary"
                          onClick={addDataRow}
                        >
                          ➕ Add Another Entry
                        </button>
                        
                        <button 
                          className="btn btn-primary btn-large"
                          onClick={storeData}
                          disabled={loading || !contractInfo}
                        >
                          {loading ? (
                            <>
                              <span className="spinner"></span>
                              Storing Data...
                            </>
                          ) : (
                            <>
                              🔗 Store Data on Blockchain
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Storage Complete */}
              {currentStep >= 4 && results && (
                <div className="step-card active">
                  <div className="step-header">
                    <div className="step-number">✅</div>
                    <div className="step-title">
                      <h2>🎉 Data Storage Complete!</h2>
                      <p>Your data has been successfully stored on the blockchain</p>
                    </div>
                  </div>
                  <div className="step-content">
                    <div className="info-box">
                      <strong>✅ Success!</strong> Your data is now secured on the blockchain with cryptographic fingerprints. 
                      Save the contract address to verify this data later.
                    </div>
                    
                    <div className="contract-info">
                      <div className="info-item">
                        <label>📍 Your Contract Address (Save This!):</label>
                        <div className="info-value">
                          <code>{contractInfo.contractAddress}</code>
                          <button 
                            className="btn btn-copy"
                            onClick={() => copyToClipboard(contractInfo.contractAddress)}
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="action-section">
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleTabChange('verify')}
                      >
                        🔍 Verify Your Data
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => {
                          setCurrentStep(1);
                          setVrfKeys(null);
                          setContractInfo(null);
                          setDataToStore([{ name: '', value: '' }]);
                          setResults(null);
                        }}
                      >
                        🔄 Store More Data
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Verify Data Tab */}
          {activeTab === 'verify' && (
            <div className="step-card active">
              <div className="step-header">
                <div className="step-number">🔍</div>
                <div className="step-title">
                  <h2>🔍 Verify Data Integrity</h2>
                  <p>Check if data exists on blockchain and verify its authenticity</p>
                </div>
              </div>
              <div className="step-content">
                <div className="step-description">
                  <p>
                    Use this section to verify data that was previously stored on the blockchain. You need to provide:
                  </p>
                  <ul>
                    <li><strong>Contract Address:</strong> The address where the data was stored</li>
                    <li><strong>Name & Value:</strong> The exact name and value as originally stored</li>
                  </ul>
                  <div className="info-box">
                    <strong>💡 Use Case:</strong> Perfect for verifying data authenticity and detecting any tampering
                  </div>
                </div>
                
                <div className="independent-verification-section">
                  <h3>🔍 Enter Verification Details:</h3>
                  
                  <div className="verification-inputs">
                    <div className="input-group">
                      <label>📍 Smart Contract Address:</label>
                      <input
                        type="text"
                        placeholder="0x742d35Cc7665C6C83e86F5E6A5e7e1a7d8A5e1A7"
                        value={verificationData.contractAddress}
                        onChange={(e) => setVerificationData(prev => ({...prev, contractAddress: e.target.value}))}
                        className="input-field"
                      />
                      <small className="input-help">
                        The Ethereum address of the smart contract where the data was stored
                      </small>
                    </div>
                    
                    <div className="input-group">
                      <label>📝 Data Name (Exact match):</label>
                      <input
                        type="text"
                        placeholder="e.g., Temperature Reading"
                        value={verificationData.name}
                        onChange={(e) => setVerificationData(prev => ({...prev, name: e.target.value}))}
                        className="input-field"
                      />
                      <small className="input-help">
                        Enter the exact name/description as it was originally stored
                      </small>
                    </div>
                    
                    <div className="input-group">
                      <label>💾 Data Value (Exact match):</label>
                      <input
                        type="text"
                        placeholder="e.g., 25.5"
                        value={verificationData.value}
                        onChange={(e) => setVerificationData(prev => ({...prev, value: e.target.value}))}
                        className="input-field"
                      />
                      <small className="input-help">
                        Enter the exact value as it was originally stored
                      </small>
                    </div>
                  </div>
                  
                  <div className="verification-examples">
                    <h4>📋 Example Verification:</h4>
                    <div className="example-card">
                      <div><strong>Contract Address:</strong> 0x742d35Cc7665C6C83e86F5E6A5e7e1a7d8A5e1A7</div>
                      <div><strong>Name:</strong> Temperature Reading</div>
                      <div><strong>Value:</strong> 25.5</div>
                    </div>
                  </div>
                  
                  <div className="action-section">
                    <button 
                      className="btn btn-primary btn-large"
                      onClick={verifyData}
                      disabled={loading || !verificationData.contractAddress.trim() || !verificationData.name.trim() || !verificationData.value.trim()}
                    >
                      {loading ? (
                        <>
                          <span className="spinner"></span>
                          Verifying Data...
                        </>
                      ) : (
                        <>
                          🔍 Verify Data on Blockchain
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="verification-info">
                    <h4>🔬 How Verification Works:</h4>
                    <ol>
                      <li>The system retrieves the VRF key associated with the contract address</li>
                      <li>It generates a cryptographic fingerprint using your input data</li>
                      <li>It compares this fingerprint with what's stored on the blockchain</li>
                      <li>If they match, your data is verified as authentic and untampered</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Display */}
          {results && (
            <div className="step-card results-card">
              <div className="step-header">
                <div className="step-number">📊</div>
                <div className="step-title">
                  <h2>📈 {activeTab === 'store' ? 'Storage' : 'Verification'} Results</h2>
                  <p>Operation summary and detailed results</p>
                </div>
              </div>
              <div className="step-content">
                {results.summary && (
                  <div className="results-summary">
                    <h3>📋 Summary:</h3>
                    <div className="summary-grid">
                      <div className="stat-card">
                        <div className="stat-number">{results.summary.total}</div>
                        <div className="stat-label">Total Items</div>
                      </div>
                      
                      {results.summary.successful !== undefined && (
                        <div className="stat-card success">
                          <div className="stat-number">{results.summary.successful}</div>
                          <div className="stat-label">Successfully Stored</div>
                        </div>
                      )}
                      
                      {results.summary.verified !== undefined && (
                        <div className="stat-card success">
                          <div className="stat-number">{results.summary.verified}</div>
                          <div className="stat-label">✅ Verified</div>
                        </div>
                      )}
                      
                      {results.summary.notFound > 0 && (
                        <div className="stat-card warning">
                          <div className="stat-number">{results.summary.notFound}</div>
                          <div className="stat-label">❓ Not Found</div>
                        </div>
                      )}
                      
                      {results.summary.errors > 0 && (
                        <div className="stat-card error">
                          <div className="stat-number">{results.summary.errors}</div>
                          <div className="stat-label">🚨 Errors</div>
                        </div>
                      )}

                      {results.summary.mismatches > 0 && (
                        <div className="stat-card error">
                          <div className="stat-number">{results.summary.mismatches}</div>
                          <div className="stat-label">❌ Mismatches</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {results.results && results.results.length > 0 && (
                  <div className="results-details">
                    <h3>📝 Detailed Results:</h3>
                    <div className="results-list">
                      {results.results.map((result, index) => (
                        <div key={index} className={`result-item ${result.status?.toLowerCase().replace('_', '-')}`}>
                          <div className="result-header">
                            <div className="result-title">
                              <strong>{result.originalData?.name || result.originalInput?.name}</strong>
                              <code className="result-value">{result.originalData?.value || result.originalInput?.value}</code>
                            </div>
                            <div className={`status-badge ${result.status?.toLowerCase().replace('_', '-')}`}>
                              {result.status === 'SUCCESS' && '✅ Success'}
                              {result.status === 'VERIFIED' && '✅ Verified'}
                              {result.status === 'NOT_FOUND' && '❓ Not Found'}
                              {result.status === 'ERROR' && '🚨 Error'}
                              {result.status === 'ALREADY_EXISTS' && '⚠️ Already Exists'}
                              {result.status === 'FINGERPRINT_MISMATCH' && '❌ Tampered'}
                            </div>
                          </div>
                          
                          <div className="result-details">
                            {result.transactionHash && (
                              <div className="detail-item">
                                <strong>🔗 Transaction:</strong> 
                                <code>{result.transactionHash}</code>
                                <button 
                                  className="btn btn-copy btn-small"
                                  onClick={() => copyToClipboard(result.transactionHash)}
                                >
                                  📋
                                </button>
                              </div>
                            )}
                            
                            {result.verified !== undefined && (
                              <div className="detail-item">
                                <strong>🔍 Verification:</strong> 
                                <span className={result.verified ? 'success-text' : 'error-text'}>
                                  {result.verified ? '✅ Data Authentic' : '❌ Data Compromised'}
                                </span>
                              </div>
                            )}
                            
                            {result.existsOnChain !== undefined && (
                              <div className="detail-item">
                                <strong>🔗 Blockchain Status:</strong> 
                                <span className={result.existsOnChain ? 'success-text' : 'warning-text'}>
                                  {result.existsOnChain ? '✅ Found on Chain' : '❓ Not Found on Chain'}
                                </span>
                              </div>
                            )}
                            
                            {result.timestamp && (
                              <div className="detail-item">
                                <strong>📅 Originally Stored:</strong> 
                                {new Date(result.timestamp).toLocaleString()}
                              </div>
                            )}

                            {result.chainTimestamp && (
                              <div className="detail-item">
                                <strong>📅 Blockchain Timestamp:</strong> 
                                {new Date(result.chainTimestamp).toLocaleString()}
                              </div>
                            )}
                            
                            {result.blockNumber && (
                              <div className="detail-item">
                                <strong>📦 Block Number:</strong> 
                                {result.blockNumber}
                              </div>
                            )}
                            
                            {result.gasUsed && (
                              <div className="detail-item">
                                <strong>⛽ Gas Used:</strong> 
                                {result.gasUsed}
                              </div>
                            )}

                            {result.segmentHash && (
                              <div className="detail-item">
                                <strong>🔐 Data Hash:</strong> 
                                <code className="hash-display">{result.segmentHash}</code>
                                <button 
                                  className="btn btn-copy btn-small"
                                  onClick={() => copyToClipboard(result.segmentHash)}
                                >
                                  📋
                                </button>
                              </div>
                            )}

                            {result.error && (
                              <div className="detail-item error-detail">
                                <strong>🚨 Error Details:</strong> 
                                <span className="error-text">{result.error}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Information for Verification */}
                {activeTab === 'verify' && results.contractAddress && (
                  <div className="additional-info">
                    <h3>📋 Contract Information:</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>📍 Contract Address:</label>
                        <div className="info-value">
                          <code>{results.contractAddress}</code>
                          <button 
                            className="btn btn-copy"
                            onClick={() => copyToClipboard(results.contractAddress)}
                          >
                            📋
                          </button>
                        </div>
                      </div>
                      
                      {results.workflow && (
                        <div className="info-item">
                          <label>🔧 Key Source:</label>
                          <div className="info-value">
                            <span className="success-text">{results.workflow.keySource || 'Retrieved from vrf_keys table'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Help Section for Results */}
                <div className="results-help">
                  <h4>❓ Understanding Results:</h4>
                  <div className="help-grid">
                    <div className="help-item">
                      <strong>✅ Verified/Success:</strong> Data found and fingerprints match - data is authentic
                    </div>
                    <div className="help-item">
                      <strong>❓ Not Found:</strong> Data not stored on blockchain with this contract
                    </div>
                    <div className="help-item">
                      <strong>❌ Tampered:</strong> Data found but fingerprints don't match - possible tampering
                    </div>
                    <div className="help-item">
                      <strong>🚨 Error:</strong> Technical error during verification process
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>🔐 VRF Blockchain Data Integrity System - Ensuring data authenticity through cryptographic verification</p>
        </div>
      </footer>
    </div>
  );
};

export default App;