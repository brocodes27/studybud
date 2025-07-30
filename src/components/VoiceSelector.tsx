import React, { useState, useEffect } from 'react';
import VAPIService from '../lib/vapiService';

interface Voice {
  id: string;
  name: string;
  provider: string;
  preview_url?: string;
}

const VoiceSelector: React.FC = () => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const vapiService = VAPIService.getInstance();

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    try {
      setLoading(true);
      const availableVoices = await vapiService.getAvailableVoices();
      setVoices(availableVoices);
      setLoading(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load voices');
      setLoading(false);
    }
  };

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
    // Copy to clipboard
    navigator.clipboard.writeText(voiceId);
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-800 rounded-xl border border-gray-700 max-w-2xl mx-auto">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-white">Loading voices...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-gray-800 rounded-xl border border-gray-700 max-w-2xl mx-auto">
        <div className="text-red-400 mb-4">
          <h3 className="text-lg font-semibold">Error Loading Voices</h3>
          <p>{error}</p>
        </div>
        <button
          onClick={loadVoices}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-800 rounded-xl border border-gray-700 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Available VAPI Voices</h2>
      
      <div className="mb-4">
        <p className="text-gray-300 mb-2">
          Click on any voice to copy its ID to clipboard:
        </p>
        {selectedVoice && (
          <div className="bg-green-600 text-white p-3 rounded-lg mb-4">
            ✅ Copied Voice ID: <code className="bg-green-700 px-2 py-1 rounded">{selectedVoice}</code>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {voices.map((voice) => (
          <div
            key={voice.id}
            onClick={() => handleVoiceSelect(voice.id)}
            className="bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors border border-gray-600 hover:border-blue-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">{voice.name || voice.id}</h3>
                <p className="text-gray-400 text-sm">ID: {voice.id}</p>
                <p className="text-gray-400 text-sm">Provider: {voice.provider}</p>
              </div>
              <div className="text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">How to Use:</h3>
        <ol className="text-gray-300 text-sm space-y-1">
          <li>1. Click on any voice above to copy its ID</li>
          <li>2. Add it to your <code className="bg-gray-600 px-1 rounded">.env</code> file:</li>
          <li>3. <code className="bg-gray-600 px-1 rounded">VITE_VAPI_VOICE_ID=your_copied_voice_id</code></li>
          <li>4. Restart your development server</li>
        </ol>
      </div>
    </div>
  );
};

export default VoiceSelector; 