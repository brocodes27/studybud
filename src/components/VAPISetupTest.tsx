import React, { useState } from 'react';
import VAPIService from '../lib/vapiService';

const VAPISetupTest: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const [apiKeyStatus, setApiKeyStatus] = useState<string>('');
  const [testResults, setTestResults] = useState<any>(null);

  const checkApiKey = () => {
    const apiKey = import.meta.env.VITE_VAPI_API_KEY;
    if (!apiKey || apiKey === 'your_vapi_api_key_here') {
      setApiKeyStatus('❌ API key is missing or using placeholder');
      setStatus('Please create a .env file with your actual VAPI API key');
    } else {
      setApiKeyStatus('✅ API key is set');
      setStatus('API key found, ready to test VAPI connection');
    }
  };

  const testVAPIConnection = async () => {
    try {
      setStatus('Testing VAPI connection...');
      const vapiService = VAPIService.getInstance();
      
      // Test basic API call
      const response = await fetch('https://api.vapi.ai/assistant', {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_VAPI_API_KEY}`
        }
      });

      if (response.ok) {
        setStatus('✅ VAPI connection successful!');
        setTestResults({ status: 'success', message: 'VAPI API is accessible' });
      } else {
        const errorData = await response.json();
        setStatus(`❌ VAPI connection failed: ${response.status}`);
        setTestResults({ status: 'error', message: errorData });
      }
    } catch (error) {
      setStatus(`❌ Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTestResults({ status: 'error', message: error });
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-xl border border-gray-700 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">VAPI Setup Test</h2>
      
      <div className="space-y-4">
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">API Key Status</h3>
          <p className="text-gray-300 text-sm mb-2">
            Current API Key: {import.meta.env.VITE_VAPI_API_KEY ? 
              `${import.meta.env.VITE_VAPI_API_KEY.substring(0, 10)}...` : 
              'Not set'
            }
          </p>
          <p className="text-sm">{apiKeyStatus}</p>
          <button
            onClick={checkApiKey}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Check API Key
          </button>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">VAPI Connection Test</h3>
          <button
            onClick={testVAPIConnection}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Test VAPI Connection
          </button>
        </div>

        {status && (
          <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Status</h3>
            <p className="text-gray-300">{status}</p>
          </div>
        )}

        {testResults && (
          <div className={`p-4 rounded-lg ${
            testResults.status === 'success' 
              ? 'bg-green-600 text-white' 
              : 'bg-red-600 text-white'
          }`}>
            <h3 className="text-lg font-semibold mb-2">
              {testResults.status === 'success' ? '✅ Test Results' : '❌ Test Results'}
            </h3>
            <p className="text-sm">
              {typeof testResults.message === 'string' 
                ? testResults.message 
                : JSON.stringify(testResults.message, null, 2)
              }
            </p>
          </div>
        )}

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">Setup Instructions</h3>
          <ol className="text-gray-300 text-sm space-y-1">
            <li>1. Create a .env file in the elevenfolks directory</li>
            <li>2. Add your VAPI API key: VITE_VAPI_API_KEY=your_actual_key</li>
            <li>3. Restart the development server</li>
            <li>4. Test the connection</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default VAPISetupTest; 