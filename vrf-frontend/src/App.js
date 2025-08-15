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
  const [independentVerification, setIndependentVerification] = useState(false);

  // API base URL - adjust this to your backend URL
  const API_BASE = 'http://localhost:3000';

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

  // Step 4: Verify Data (Updated to support independent verification)
  const verifyData = async () => {
    const contractAddress = independentVerification 
      ? verificationData.contractAddress 
      : contractInfo?.contractAddress;

    if (!contractAddress) {
      addAlert(independentVerification 
        ? 'Please enter a contract address for verification!' 
        : 'Please deploy a contract first!', 'error');
      return;
    }

    if (!verificationData.name.trim() || !verificationData.value.toString().trim()) {
      addAlert('Please enter both name and value for verification!', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/verify`, {
        contractAddress: contractAddress,
        name: verificationData.name,
        value: verificationData.value
      });
      
      setResults(response.data);
      
      const verifiedCount = response.data.summary.verified;
      if (verifiedCount > 0) {
        addAlert('Data verification successful! Data integrity confirmed.', 'success');
      } else {
        addAlert('Data not found or verification failed.', 'warning');
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

      {/* Main Content */}
      <main className="main">
        <div className="container">
          
          {/* Progress Indicator */}
          <div className="progress-bar">
            <div className="progress-steps">
              {[
                { step: 1, label: 'Generate Keys', icon: '🔑' },
                { step: 2, label: 'Deploy Contract', icon: '📄' },
                { step: 3, label: 'Store Data', icon: '💾' },
                { step: 4, label: 'Verify Data', icon: '✅' }
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
                      ✅ I've Saved My Keys - Continue to Deploy Contract
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

          {/* Step 4: Verify Data */}
          {currentStep >= 4 && (
            <div className={`step-card ${currentStep === 4 ? 'active' : ''}`}>
              <div className="step-header">
                <div className="step-number">4</div>
                <div className="step-title">
                  <h2>✅ Verify Data</h2>
                  <p>Check data integrity and authenticity</p>
                </div>
              </div>
              <div className="step-content">
                <div className="step-description">
                  <p>
                    Verify the integrity of previously stored data by providing the exact name and value. 
                    The system will check if the data exists on the blockchain and hasn't been tampered with.
                  </p>
                  <div className="info-box">
                    <strong>🔍 Important:</strong> Enter the exact name and value as originally stored for accurate verification
                  </div>
                </div>
                
                <div className="verification-section">
                  <h3>🔍 Enter Data to Verify:</h3>
                  
                  <div className="verification-inputs">
                    <div className="input-group">
                      <label>📝 Name (Exact match):</label>
                      <input
                        type="text"
                        placeholder="Enter exact name as stored"
                        value={verificationData.name}
                        onChange={(e) => setVerificationData(prev => ({...prev, name: e.target.value}))}
                        className="input-field"
                      />
                    </div>
                    
                    <div className="input-group">
                      <label>💾 Value (Exact match):</label>
                      <input
                        type="text"
                        placeholder="Enter exact value as stored"
                        value={verificationData.value}
                        onChange={(e) => setVerificationData(prev => ({...prev, value: e.target.value}))}
                        className="input-field"
                      />
                    </div>
                  </div>
                  
                  <div className="action-section">
                    <button 
                      className="btn btn-primary btn-large"
                      onClick={verifyData}
                      disabled={loading || !contractInfo}
                    >
                      {loading ? (
                        <>
                          <span className="spinner"></span>
                          Verifying...
                        </>
                      ) : (
                        <>
                          🔍 Verify Data Integrity
                        </>
                      )}
                    </button>
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
                  <h2>📈 Results</h2>
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
                          <div className="stat-label">Verified</div>
                        </div>
                      )}
                      
                      {results.summary.notFound > 0 && (
                        <div className="stat-card warning">
                          <div className="stat-number">{results.summary.notFound}</div>
                          <div className="stat-label">Not Found</div>
                        </div>
                      )}
                      
                      {results.summary.errors > 0 && (
                        <div className="stat-card error">
                          <div className="stat-number">{results.summary.errors}</div>
                          <div className="stat-label">Errors</div>
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
                              {result.status === 'NOT_FOUND' && '❌ Not Found'}
                              {result.status === 'ERROR' && '🚨 Error'}
                              {result.status === 'ALREADY_EXISTS' && '⚠️ Already Exists'}
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
                                  {result.verified ? '✅ Verified' : '❌ Failed'}
                                </span>
                              </div>
                            )}
                            
                            {result.chainTimestamp && (
                              <div className="detail-item">
                                <strong>📅 Stored:</strong> 
                                {new Date(result.chainTimestamp).toLocaleString()}
                              </div>
                            )}
                            
                            {result.blockNumber && (
                              <div className="detail-item">
                                <strong>📦 Block:</strong> 
                                {result.blockNumber}
                              </div>
                            )}
                            
                            {result.gasUsed && (
                              <div className="detail-item">
                                <strong>⛽ Gas Used:</strong> 
                                {result.gasUsed}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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