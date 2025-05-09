import { useState, useRef, useEffect } from 'react'
import './App.css'
import ibmCloudLogo from './assets/IBM_Cloud_Logo.png'

interface VSIConfig {
  about: {
    location: string;
    resource_name: string;
    config_type: string;
  };
  config: {
    resource_id: string;
    vm_image_name?: string;
    vpc_id: string;
    created_at?: string;
    account_id?: string; // Added account_id
  };
}

interface VSIData {
  configs: VSIConfig[];
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expiration: number;
}

interface ServiceOption {
  value: string;
  label: string;
}

const serviceOptions: ServiceOption[] = [
  { value: 'is.instance', label: 'Virtual Server Instances' },
  { value: 'containers-kubernetes', label: 'Kubernetes Clusters' }
];

function App() {
  const [vsiData, setVsiData] = useState<VSIData | null>(null);
  const [configGuid, setConfigGuid] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>(serviceOptions[0].value);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load default data when component mounts
  useEffect(() => {
    loadDefaultData();
  }, []);

  useEffect(() => {
    if (configGuid && apiKey) {
      loadFromAPI();
    }
  }, [selectedService]);

  const loadDefaultData = async () => {
    try {
      const response = await fetch('/generated/sample.json');
      const data = await response.json();
      setVsiData(data);
      setErrorMessage('');
    } catch (error) {
      console.error('Error loading default VSI data:', error);
      setErrorMessage('Error loading default data');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedJson = JSON.parse(content);
        setVsiData(parsedJson);
        setErrorMessage('');
      } catch (error) {
        setErrorMessage('Invalid JSON file format');
        // Reload default data if there's an error
        loadDefaultData();
      }
    };
    reader.readAsText(file);
  };

  const getIAMToken = async (apiKey: string): Promise<string> => {
    try {
      console.log('Getting IAM token...');
      const response = await fetch('/iam/identity/token', { // Updated to use full URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
          'apikey': apiKey
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('IAM token error response:', errorText);
        throw new Error(`IAM token error: ${response.status} - ${errorText}`);
      }

      const data: TokenResponse = await response.json();
      console.log('IAM token received successfully');
      return data.access_token;
    } catch (error) {
      console.error('Detailed IAM token error:', error);
      if (error instanceof TypeError) {
        console.error('This might be a network issue or an invalid endpoint.');
      }
      throw new Error(`IAM token error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadFromAPI = async () => {
    if (!configGuid || !apiKey) {
      setErrorMessage('Please enter both Config GUID and API Key');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      console.log('Starting API call process...');
      const token = await getIAMToken(apiKey);
      console.log('Token received, calling API...');

      const url = `/api/apprapp/config_aggregator/v1/instances/${configGuid}/configs?service_name=${selectedService}`; // Updated to use full URL
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Data received successfully');
      setVsiData(data);
      setErrorMessage('');
      setSuccessMessage('API loaded successfully!');
    } catch (error) {
      console.error('Detailed API error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <img 
          src={ibmCloudLogo}
          alt="IBM Cloud Logo"
          className="ibm-cloud-logo"
        />
        <h1>Resources Viewer</h1>
        <div className="controls">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="upload-button"
          >
            Upload JSON File
          </button>
          <button 
            onClick={loadDefaultData}
            className="default-button"
          >
            Load JSON Sample
          </button>
        </div>
      </div>

      <div className="api-controls">
        <div className="input-group">
          <input
            type="text"
            placeholder="Enter the App Configuration GUID"
            value={configGuid}
            onChange={(e) => setConfigGuid(e.target.value)}
            className="api-input"
          />
          <input
            type="password"
            placeholder="Enter IBM Cloud API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="api-input"
          />
          <button 
            onClick={loadFromAPI}
            className="api-button"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load from API'}
          </button>
        </div>
        {errorMessage && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
        <div className="filter-group">
          <label htmlFor="service-select">Filter by service:</label>
          <select
            id="service-select"
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="service-select"
          >
            {serviceOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="table-container">
        {vsiData ? (
          <table className="vsi-table">
            <thead>
              <tr>
                <th>Account ID</th> {/* New column */}
                <th>Name</th>
                <th>AZ</th>
                <th>Type</th>
                <th>Resource ID</th>
                <th>Image Name</th>
                <th>Profile</th>
                <th>Number of Volume</th> {/* New column */}
              </tr>
            </thead>
            <tbody>
              {vsiData.configs
                .filter(config => config.about.config_type === 'instance')
                .map((config, index) => (
                  <tr key={index}>
                    <td>{config.about.account_id || 'N/A'}</td> {/* New column for account_id */}
                    <td>{config.about.resource_name || 'N/A'}</td>
                    <td>{config.config_v2.zone}</td>
                    <td>{config.about.config_type}</td>
                    <td>{config.config.resource_id}</td>
                    <td>{config.config.vm_image_name || 'N/A'}</td>
                    <td>{config.config_v2.profile || 'N/A'}</td>
                    <td>{config.config_v2?.boot_volume?.length || 0}</td> {/* Display boot_volume count */}
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <p>Loading data...</p>
        )}
      </div>
    </div>
  );
}

export default App