import React, { useState } from 'react';
import VAPIService from '../lib/vapiService';
import GeminiService from '../lib/geminiService';

const VAPITestComponent: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready');
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [voices, setVoices] = useState<any[]>([]);
  const [assistants, setAssistants] = useState<any[]>([]);

  const vapiService = VAPIService.getInstance();
  const geminiService = GeminiService.getInstance();

  const testCallCreation = async () => {
    try {
      setStatus('Creating call...');
      const call = await vapiService.initializeCall('physics', 'friendly');
      setCallId(call.id);
      setStatus(`Call created: ${call.id}`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testGetVoices = async () => {
    try {
      setStatus('Fetching voices...');
      const voicesList = await vapiService.getAvailableVoices();
      setVoices(voicesList);
      setStatus(`Found ${voicesList.length} voices`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testGetAssistants = async () => {
    try {
      setStatus('Fetching assistants...');
      const assistantsList = await vapiService.getAssistants();
      setAssistants(assistantsList);
      setStatus(`Found ${assistantsList.length} assistants`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testGetTranscript = async () => {
    if (!callId) {
      setStatus('No call ID available');
      return;
    }

    try {
      setStatus('Getting transcript...');
      const transcriptText = await vapiService.getCallTranscript(callId);
      setTranscript(transcriptText);
      setStatus('Transcript retrieved');
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testEndCall = async () => {
    if (!callId) {
      setStatus('No call ID available');
      return;
    }

    try {
      setStatus('Ending call...');
      await vapiService.endCall(callId);
      setStatus('Call ended');
      setCallId(null);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testConversationAnalysis = async () => {
    try {
      setStatus('Analyzing conversation with Gemini...');
      const analysis = await geminiService.analyzeConversation(
        "Student: I think motion is when something moves. AI: That's correct! Motion is the change in position of an object over time.",
        'physics'
      );
      setStatus(`Analysis complete - Accuracy: ${analysis.accuracy}%, Learning Style: ${analysis.learningStyle}, Confidence: ${analysis.confidenceLevel}`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testPersonalizedFeedback = async () => {
    try {
      setStatus('Generating personalized feedback...');
      const analysis = await geminiService.analyzeConversation(
        "Student: I think motion is when something moves. AI: That's correct! Motion is the change in position of an object over time.",
        'physics'
      );
      const feedback = await geminiService.generatePersonalizedFeedback(analysis, 'physics');
      setStatus(`Feedback generated: ${feedback.substring(0, 100)}...`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testAdaptiveQuestions = async () => {
    try {
      setStatus('Generating adaptive questions...');
      const questions = await geminiService.generateAdaptiveQuestions('physics', 'intermediate', 'auditory');
      setStatus(`Generated ${questions.length} adaptive questions`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testEmotionalDetection = async () => {
    try {
      setStatus('Detecting emotional state...');
      const emotionalState = await geminiService.detectEmotionalState(
        "Student: I'm not sure about this topic, it's a bit confusing. AI: Let me help you understand it better."
      );
      setStatus(`Emotional state detected: ${emotionalState}`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-6">VAPI Integration Test</h2>

      <div className="space-y-4">
        <div className="bg-gray-700 p-4 rounded-lg">
          <p className="text-gray-300 mb-2">Status: <span className="text-blue-400">{status}</span></p>
          {callId && (
            <p className="text-gray-300">Call ID: <span className="text-green-400">{callId}</span></p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={testCallCreation}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Test Call Creation
          </button>

          <button
            onClick={testGetVoices}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Test Get Voices
          </button>

          <button
            onClick={testGetAssistants}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
          >
            Test Get Assistants
          </button>

          <button
            onClick={testConversationAnalysis}
            className="bg-neo-accent text-slate-900 px-4 py-2 rounded hover:bg-cyan-400 transition-colors"
          >
            Test Gemini Analysis
          </button>

          <button
            onClick={testPersonalizedFeedback}
            className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 transition-colors"
          >
            Test Personalized Feedback
          </button>

          <button
            onClick={testAdaptiveQuestions}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
          >
            Test Adaptive Questions
          </button>

          <button
            onClick={testEmotionalDetection}
            className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 transition-colors"
          >
            Test Emotional Detection
          </button>

          {callId && (
            <>
              <button
                onClick={testGetTranscript}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
              >
                Get Transcript
              </button>

              <button
                onClick={testEndCall}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                End Call
              </button>
            </>
          )}
        </div>

        {voices.length > 0 && (
          <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Available Voices</h3>
            <div className="grid grid-cols-2 gap-2">
              {voices.slice(0, 6).map((voice, index) => (
                <div key={index} className="text-sm text-gray-300">
                  {voice.name || voice.id}
                </div>
              ))}
            </div>
          </div>
        )}

        {assistants.length > 0 && (
          <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Available Assistants</h3>
            <div className="grid grid-cols-2 gap-2">
              {assistants.slice(0, 6).map((assistant, index) => (
                <div key={index} className="text-sm text-gray-300">
                  {assistant.name || assistant.id}
                </div>
              ))}
            </div>
          </div>
        )}

        {transcript && (
          <div className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Transcript</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{transcript}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VAPITestComponent; 