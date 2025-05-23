import { useState, useRef, useEffect } from 'react'
import './App.css'
import ibmCloudLogo from './assets/IBM_Cloud_Logo.png'

interface VSIConfig {
  about: {
    location: string;
    resource_name: string;
    config_type: string;
    account_id?: string;
    service_name?: string;
  };
  config: {
    resource_id: string;
    vm_image_name?: string;
    vpc_id: string;
    created_at?: string;
  };
  config_v2?: {
    zone?: string;
    profile?: string;
    boot_volume?: unknown[];
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

interface ResourceGroup {
  id: string;
  name: string;
  account_id: string;
  state: string;
}

interface ResourceGroupsResponse {
  resources: ResourceGroup[];
}

interface VSIConfigResponse {
  configs: VSIConfig[];
}

const serviceOptions: ServiceOption[] = [
  { value: 'all', label: 'All resources' },
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
  const [resourceInstances, setResourceInstances] = useState<any[]>([]);
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);
  const [vsiConfigs, setVsiConfigs] = useState<{ [key: string]: VSIConfig }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load default data when component mounts
  useEffect(() => {
    if (configGuid && apiKey) {
      loadFromAPI();
    }
  }, [selectedService, configGuid, apiKey]);

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
      } catch {
        setErrorMessage('Invalid JSON file format');
      }
    };
    reader.readAsText(file);
  };

  const getIAMToken = async (apiKey: string): Promise<string> => {
    try {
      console.log('Getting IAM token...');
      const response = await fetch('/iam/identity/token', {
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

  const getResourceGroups = async (token: string): Promise<ResourceGroup[]> => {
    try {
      const url = '/resources/v2/resource_groups';
      console.log('Fetching resource groups from:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Resource groups error response:', errorText);
        throw new Error(`Resource groups API error: ${response.status} - ${errorText}`);
      }

      const data: ResourceGroupsResponse = await response.json();
      console.log('Resource groups loaded:', data.resources?.length ?? 0);
      return data.resources || [];
    } catch (error) {
      console.error('Resource groups fetch error:', error);
      throw error;
    }
  };

  const getVSIConfig = async (token: string, crn: string): Promise<VSIConfig | null> => {
    try {
      const url = `/api/apprapp/config_aggregator/v1/instances/${configGuid}/configs?resource_crn=${encodeURIComponent(crn)}`;
      console.log('Fetching VSI config from:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('VSI config error response:', errorText);
        return null;
      }

      const data: VSIConfigResponse = await response.json();
      return data.configs?.[0] || null;
    } catch (error) {
      console.error('VSI config fetch error:', error);
      return null;
    }
  };

  const loadResourceInstances = async (token: string) => {
    if (!configGuid || !apiKey) {
      setErrorMessage('Please enter both Config GUID and API Key');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // First, get all resource groups
      const groups = await getResourceGroups(token);
      setResourceGroups(groups);
      
      // Then, fetch resources for each group
      const allResources = [];
      const vsiConfigsMap: { [key: string]: VSIConfig } = {};
      
      for (const group of groups) {
        const url = `/resources/v2/resource_instances?resource_group_id=${group.id}`;
        console.log(`Fetching resources for group ${group.name} from:`, url);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Resource instances error response for group ${group.name}:`, errorText);
          continue;
        }

        const data = await response.json();
        const resources = data.resources || [];
        
        // Add resource group name to each resource
        resources.forEach((resource: any) => {
          resource.resource_group_name = group.name;
        });
        
        // For VSI resources, fetch their config
        for (const resource of resources) {
          if (resource.resource_id === 'is.instance') {
            const config = await getVSIConfig(token, resource.crn);
            if (config) {
              vsiConfigsMap[resource.crn] = config;
            }
          }
        }
        
        allResources.push(...resources);
      }

      setResourceInstances(allResources);
      setVsiConfigs(vsiConfigsMap);
      console.log('Total resources loaded:', allResources.length);
      console.log('VSI configs loaded:', Object.keys(vsiConfigsMap).length);
    } catch (error) {
      console.error('Resource instances fetch error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
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
      const token = await getIAMToken(apiKey);

      // Existing API call
      let url = `/api/apprapp/config_aggregator/v1/instances/${configGuid}/configs`;
      console.log('Fetching configs from:', url);
      if (selectedService !== 'all') {
        url += `?service_name=${selectedService}`;
      }
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
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setVsiData(data);
      setErrorMessage('');
      setSuccessMessage('API loaded successfully!');

      // NEW: Load resource instances as well
      await loadResourceInstances(token);

    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const shortenCRN = (crn: string): string => {
    if (!crn) return 'N/A';
    const parts = crn.split(':');
    if (parts.length < 7) return crn;
    return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${parts[4]}:${parts[5]}...`;
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
        </div>
      </div>

      <div className="api-controls">
        <div className="input-group">
          <input
            type="text"
            placeholder="App Configuration GUID"
            value={configGuid}
            onChange={(e) => setConfigGuid(e.target.value)}
            className="api-input"
          />
          <input
            type="password"
            placeholder="IBM Cloud API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="api-input"
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <button 
              onClick={loadFromAPI}
              className="api-button"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load from API'}
            </button>
          </div>
        </div>
        <div className="filter-api-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <div className="filter-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center' }}>
            <label htmlFor="service-select" style={{ marginRight: 8 }}>Filter by service:</label>
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
          <div style={{ minWidth: 220, marginLeft: 24, display: 'flex', alignItems: 'center', height: '32px' }}>
            {errorMessage && (
              <div className="error-message" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="success-message" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                {successMessage}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {resourceInstances.length > 0 && (
        <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto', overflowX: 'auto', marginTop: 24 }}>
          <table className="vsi-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Service Name</th>
                <th>Resource Group</th>
                <th>Region</th>
                <th>Created At</th>
                <th>Zone</th>
                <th>Image Name</th>
                <th>Profile</th>
                <th>Number of Volumes</th>
              </tr>
            </thead>
            <tbody>
              {resourceInstances
                .filter(instance => 
                  selectedService === 'all' 
                    ? true 
                    : selectedService === 'is.instance' 
                      ? instance.resource_id === 'is.instance'
                      : instance.resource_id === selectedService
                )
                .map((instance, idx) => (
                <tr key={idx}>
                  <td>{instance.name || 'N/A'}</td>
                  <td>{instance.resource_id || 'N/A'}</td>
                  <td>{instance.resource_group_name || 'N/A'}</td>
                  <td>{instance.region_id || 'N/A'}</td>
                  <td>{instance.created_at ? new Date(instance.created_at).toISOString().split('T')[0] : 'N/A'}</td>
                  {instance.resource_id === 'is.instance' && vsiConfigs[instance.crn] ? (
                    <>
                      <td>{vsiConfigs[instance.crn]?.config_v2?.zone || 'N/A'}</td>
                      <td>{vsiConfigs[instance.crn]?.config?.vm_image_name || 'N/A'}</td>
                      <td>{vsiConfigs[instance.crn]?.config_v2?.profile || 'N/A'}</td>
                      <td>{Array.isArray(vsiConfigs[instance.crn]?.config_v2?.boot_volume) ? vsiConfigs[instance.crn]?.config_v2?.boot_volume.length : 0}</td>
                    </>
                  ) : (
                    <>
                      <td>N/A</td>
                      <td>N/A</td>
                      <td>N/A</td>
                      <td>N/A</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App