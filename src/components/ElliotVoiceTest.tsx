import React, { useState } from 'react';
import VAPIService from '../lib/vapiService';

interface TestResults {
  callId: string;
  status: 'active' | 'fallback';
  message?: string;
}

const ElliotVoiceTest: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const [callId, setCallId] = useState<string>('');
  const [isCallActive, setIsCallActive] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);
  const vapiService = VAPIService.getInstance();

  const testElliotVoice = async () => {
    try {
      setStatus('Initializing Elliot voice with Gemini 2.5 Flash...');
      
      const call = await vapiService.initializeCall('Physics Basics', 'friendly');
      setCallId(call.id);
      
      // Check if this is a real call or fallback
      if (call.id.startsWith('mock-call') || call.id.startsWith('fallback-call')) {
        setIsCallActive(false);
        setStatus('❌ Voice service unavailable - using fallback mode');
        setResults({
          callId: call.id,
          status: 'fallback',
          message: 'VAPI API key may be missing or invalid'
        });
      } else {
        setIsCallActive(true);
        setStatus(`✅ Elliot voice call created! Call ID: ${call.id}`);
        setStatus('🎤 Speak to Elliot now - he should respond with his voice!');
        setResults({
          callId: call.id,
          status: 'active'
        });
      }
      
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Elliot Voice Test Error:', error);
    }
  };

  const endCall = async () => {
    if (callId) {
      try {
        await vapiService.endCall(callId);
        setIsCallActive(false);
        setStatus('✅ Call ended successfully');
      } catch (error) {
        setStatus(`❌ Error ending call: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-xl border border-gray-700 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Elliot Voice + Gemini 2.5 Flash Test</h2>
      
      <div className="space-y-4">
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">Configuration</h3>
          <p className="text-gray-300 text-sm">
            Voice: <span className="text-green-400">Elliot</span><br/>
            Model: <span className="text-green-400">Gemini 2.5 Flash</span><br/>
            API Key: {import.meta.env.VITE_VAPI_API_KEY ? '✅ Set' : '❌ Missing'}
          </p>
        </div>

        <div className="space-y-2">
          {!isCallActive ? (
            <button
              onClick={testElliotVoice}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              🎤 Start Elliot Voice Call
            </button>
          ) : (
            <button
              onClick={endCall}
              className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              🔴 End Call
            </button>
          )}
        </div>

                 {status && (
           <div className="bg-gray-700 p-4 rounded-lg">
             <h3 className="text-lg font-semibold text-white mb-2">Status</h3>
             <p className="text-gray-300">{status}</p>
           </div>
         )}

         {results && (
           <div className={`p-4 rounded-lg ${
             results.status === 'active' 
               ? 'bg-green-600 text-white' 
               : 'bg-yellow-600 text-white'
           }`}>
             <h3 className="text-lg font-semibold mb-2">
               {results.status === 'active' ? '🎤 Call Active' : '⚠️ Fallback Mode'}
             </h3>
             <p className="text-sm">
               {results.status === 'active' 
                 ? 'Speak to Elliot now! He should respond with his voice.'
                 : results.message || 'Voice service unavailable'
               }
             </p>
             <p className="text-sm mt-2">Call ID: {results.callId}</p>
           </div>
         )}

         {isCallActive && !results && (
           <div className="bg-green-600 text-white p-4 rounded-lg">
             <h3 className="text-lg font-semibold mb-2">🎤 Call Active</h3>
             <p>Speak to Elliot now! He should respond with his voice.</p>
             <p className="text-sm mt-2">Call ID: {callId}</p>
           </div>
         )}

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">How to Test</h3>
          <ol className="text-gray-300 text-sm space-y-1">
            <li>1. Click "Start Elliot Voice Call"</li>
            <li>2. Allow microphone access when prompted</li>
            <li>3. Speak to Elliot about any topic</li>
            <li>4. Elliot should respond with his voice</li>
            <li>5. Click "End Call" when done</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ElliotVoiceTest; 