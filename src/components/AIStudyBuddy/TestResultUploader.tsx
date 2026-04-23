import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, X, Loader2, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';

interface TestResultUploaderProps {
  roadmapId: string;
  onAnalysisComplete: (result: any, sprint: any) => void;
  onCancel: () => void;
}

export function TestResultUploader({ roadmapId, onAnalysisComplete, onCancel }: TestResultUploaderProps) {
  const { session } = useAuth() as any;
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testName, setTestName] = useState('Mock Test');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!previewUrl) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyse-test-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          roadmap_id: roadmapId,
          test_name: testName,
          base64_image: previewUrl
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze test result');
      }

      const data = await response.json();
      showToast('Test analyzed and Correction Sprint generated.', 'success');
      onAnalysisComplete(data.testResult, data.sprint);
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Error parsing test', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden animate-fade-in-up">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-slate-800">Upload Test Result</h3>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 focus:outline-none">Test Name</label>
          <input
            type="text"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="e.g. Aakash Fortnightly Test 3"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all font-medium"
          />
        </div>

        {!selectedFile ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-brand-300 transition-all group"
          >
            <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-6 h-6 text-brand-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Click or drag image to upload</p>
            <p className="text-xs text-slate-400">Supported: JPG, PNG of your marked OMR or test sheet</p>
          </div>
        ) : (
          <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-100">
            <button 
              onClick={clearSelection}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full backdrop-blur-sm transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={previewUrl!} alt="Preview" className="w-full h-48 object-cover opacity-90" />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-white" />
              <span className="text-xs font-medium text-white truncate">{selectedFile.name}</span>
            </div>
          </div>
        )}
        
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="pt-2 flex gap-3">
          <button 
            onClick={onCancel}
            disabled={isAnalyzing}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleAnalyze}
            disabled={!selectedFile || isAnalyzing}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:bg-slate-300 flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Scan...</span>
              </>
            ) : (
              <span>Analyze Weaknesses</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
