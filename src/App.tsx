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
  { value: 'is.instance', label: 'VSI' },
  { value: 'containers-kubernetes', label: 'Clusters' }
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
  const [lastApiOutput, setLastApiOutput] = useState<any>(null);

  // Load default data when component mounts
  // useEffect(() => {
  //   if (configGuid && apiKey) {
  //     loadFromAPI();
  //   }
  // }, [selectedService, configGuid, apiKey]);

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

  const getVSIConfig = async (token: string, crn: string): Promise<VSIConfig | null> => {
    try {
      const url = `/api/apprapp/config_aggregator/v1/instances/${configGuid}/configs?service_name=is.instance&config_type=instance`;
      console.log('Fetching VSI configs from:', url);
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
      // Remove the call to getResourceGroups and related logic
      // You may want to add your new logic here for loading resource instances
      setResourceInstances([]);
      setVsiConfigs({});
      setResourceGroups([]);
      // ...
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

  const fetchAllConfigs = async (token, configGuid) => {
    let allConfigs = [];
    let start = undefined;
    let hasNext = true;

    while (hasNext) {
      let url = `/api/apprapp/config_aggregator/v1/instances/${configGuid}/configs?limit=100`;
      if (start) url += `&start=${encodeURIComponent(start)}`;

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
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      allConfigs = allConfigs.concat(data.configs || []);

      // The IBM API typically returns a 'next' object with a 'start' property for pagination
      if (data.next && data.next.start) {
        start = data.next.start;
      } else {
        hasNext = false;
      }
    }

    return allConfigs;
  };

  const handleLoadFromVSI = async () => {
    if (!configGuid || !apiKey) {
      setErrorMessage('Please enter both Config GUID and API Key');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const token = await getIAMToken(apiKey);
      const allConfigs = await fetchAllConfigs(token, configGuid);
      // Map configs to the table format, filtering out invalid entries
      const mapped = (allConfigs || [])
        .filter(cfg => cfg && cfg.config && cfg.about)
        .map(cfg => ({
          name: cfg.about.resource_name,
          resource_id: cfg.config.resource_id,
          resource_group_name: cfg.about.location,
          region_id: cfg.config.vpc_id,
          created_at: cfg.config.created_at,
          crn: cfg.config.resource_id,
          config_v2: cfg.config_v2,
          config: cfg.config,
          about: cfg.about
        }));
      setResourceInstances(mapped);
      setSuccessMessage('All configs loaded successfully!');
      setLastApiOutput({ configs: allConfigs });
      await fetch('/save-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: allConfigs })
      });
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

  console.log(resourceInstances.map(i => i.about));

  const downloadJSON = (data: any, filename: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  function renderTable() {
    if (selectedService === 'is.instance') {
      // VSI Table Layout
      return (
        <table className="vsi-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Service Name</th>
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
                    ? instance.about?.service_name === 'is.instance' && instance.about?.config_type === 'instance'
                    : instance.about?.service_name === selectedService
              )
              .map((instance, idx) => (
                <tr key={idx}>
                  <td>{instance.name || 'N/A'}</td>
                  <td>{instance.about?.service_name || 'N/A'}</td>
                  <td>{instance.about?.location || 'N/A'}</td>
                  <td>
                    {instance?.about?.last_config_refresh_time
                      ? new Date(instance.about.last_config_refresh_time).toISOString().split('T')[0]
                      : 'N/A'}
                  </td>
                  <td>{instance.config_v2 && instance.config_v2.zone ? instance.config_v2.zone : 'N/A'}</td>
                  <td>{instance.config && instance.config.vm_image_name ? instance.config.vm_image_name : 'N/A'}</td>
                  <td>{instance.config_v2 && instance.config_v2.profile ? instance.config_v2.profile : 'N/A'}</td>
                  <td>{instance.config_v2 && Array.isArray(instance.config_v2.boot_volume) ? instance.config_v2.boot_volume.length : 0}</td>
                </tr>
              ))}
          </tbody>
        </table>
      );
    } else if (selectedService === 'containers-kubernetes') {
      // Filter for worker configs
      const workerInstances = resourceInstances.filter(
        instance => instance?.about?.config_type === 'worker'
      );
      return (
        <table className="vsi-table">
          <thead>
            <tr>
              <th>Cluster</th>
              <th>Type</th>
              <th>Worker</th>
              <th>Flavor</th>
              <th>Service</th>
              <th>Zone</th>
              <th>Version</th>
              <th>OS</th>
              <th>Last Refresh</th>
            </tr>
          </thead>
          <tbody>
            {workerInstances.map((instance, idx) => (
              <tr key={idx}>
                <td>{instance?.name || 'N/A'}</td>
                <td>{instance?.about?.type || 'N/A'}</td>
                <td>{instance?.config?.id || 'N/A'}</td>
                <td>{instance?.config?.flavor || 'N/A'}</td>
                <td>{instance?.about?.service_name || 'N/A'}</td>
                <td>{instance?.about?.location || 'N/A'}</td>
                <td>{instance?.config?.kubeVersion?.actual || 'N/A'}</td>
                <td>{instance?.config?.lifecycle?.actualOperatingSystem || 'N/A'}</td>
                <td>
                  {instance?.about?.last_config_refresh_time
                    ? new Date(instance.about.last_config_refresh_time).toISOString().split('T')[0]
                    : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      // Default/All Table Layout
      return (
        <table className="vsi-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Service Name</th>
              <th>Region</th>
              <th>Created At</th>
              {/* Add more columns as needed */}
            </tr>
          </thead>
          <tbody>
            {resourceInstances
              .filter(instance =>
                selectedService === 'all'
                  ? true
                  : selectedService === 'is.instance'
                    ? instance.about?.service_name === 'is.instance' && instance.about?.config_type === 'instance'
                    : instance.about?.service_name === selectedService
              )
              .map((instance, idx) => (
                <tr key={idx}>
                  <td>{instance.name || 'N/A'}</td>
                  <td>{instance.about?.service_name || 'N/A'}</td>
                  <td>{instance.about?.location || 'N/A'}</td>
                  <td>
                    {instance?.about?.last_config_refresh_time
                      ? new Date(instance.about.last_config_refresh_time).toISOString().split('T')[0]
                      : 'N/A'}
                  </td>
                  {/* Add more cells as needed */}
                </tr>
              ))}
          </tbody>
        </table>
      );
    }
  }

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
              onClick={handleLoadFromVSI}
              className="api-button"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load Configs'}
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
        <>
          <div style={{ margin: '16px 0', fontWeight: 500 }}>
            {resourceInstances.filter(instance =>
              selectedService === 'all'
                ? true
                : selectedService === 'is.instance'
                  ? instance.about?.service_name === 'is.instance' && instance.about?.config_type === 'instance'
                  : instance.about?.service_name === selectedService
            ).length} results loaded
          </div>
          <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto', overflowX: 'auto', marginTop: 24 }}>
            {renderTable()}
          </div>
        </>
      )}
    </div>
  );
}

export default App