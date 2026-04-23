import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileImage, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadTestResult } from '../../lib/dailyBriefing';

interface TestUploadModalProps {
  userId: string;
  roadmapId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TestUploadModal({ userId, roadmapId, isOpen, onClose, onSuccess }: TestUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [testName, setTestName] = useState('');
  const [scoreObtained, setScoreObtained] = useState('');
  const [scoreTotal, setScoreTotal] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!roadmapId) {
      setResult({ success: false, message: 'No active roadmap found. Please set up your study plan first.' });
      return;
    }
    if (!testName.trim()) {
      setResult({ success: false, message: 'Please enter a test name.' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let base64Image: string | undefined;
      if (preview) {
        base64Image = preview;
      }

      const manualWeaknesses = weaknesses
        .split('\n')
        .filter((w) => w.trim())
        .map((w) => ({ topic: w.trim(), subject: '', severity: 'medium' }));

      const res = await uploadTestResult(userId, roadmapId, {
        test_name: testName,
        base64_image: base64Image,
        manual_weaknesses: manualWeaknesses.length > 0 ? manualWeaknesses : undefined,
        score_obtained: scoreObtained ? parseInt(scoreObtained) : undefined,
        score_total: scoreTotal ? parseInt(scoreTotal) : undefined,
      });

      if (res.error) {
        setResult({ success: false, message: res.error });
      } else {
        setResult({ success: true, message: 'Test analysed! A correction sprint has been generated.' });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (e: any) {
      setResult({ success: false, message: e?.message || 'Upload failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A192F]/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-neo-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#0A192F]">Upload Test Result</h3>
                <p className="text-xs text-[#64748B]">Ranjan Sir will analyse and create a repair plan.</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#F8FAFC] rounded-xl transition-colors">
                <X className="w-5 h-5 text-[#64748B]" />
              </button>
            </div>

            {/* Test Name */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                Test Name
              </label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g., Phase Test 3 — Physics"
                className="w-full px-4 py-2.5 bg-[#FAFBFF] border border-[#0A192F]/[0.06] rounded-xl text-sm text-[#0A192F] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#6366F1]/30 transition-colors"
              />
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  Score
                </label>
                <input
                  type="number"
                  value={scoreObtained}
                  onChange={(e) => setScoreObtained(e.target.value)}
                  placeholder="120"
                  className="w-full px-4 py-2.5 bg-[#FAFBFF] border border-[#0A192F]/[0.06] rounded-xl text-sm text-[#0A192F] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#6366F1]/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  Out of
                </label>
                <input
                  type="number"
                  value={scoreTotal}
                  onChange={(e) => setScoreTotal(e.target.value)}
                  placeholder="300"
                  className="w-full px-4 py-2.5 bg-[#FAFBFF] border border-[#0A192F]/[0.06] rounded-xl text-sm text-[#0A192F] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#6366F1]/30 transition-colors"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                Answer Sheet Photo (optional)
              </label>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {!preview ? (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 bg-[#FAFBFF] border-2 border-dashed border-[#0A192F]/[0.08] rounded-xl hover:border-[#6366F1]/30 transition-colors"
                >
                  <FileImage className="w-8 h-8 text-[#94A3B8]" />
                  <span className="text-xs font-medium text-[#64748B]">Click to upload marked answer sheet</span>
                </button>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-[#0A192F]/[0.06]">
                  <img src={preview} alt="Preview" className="w-full h-40 object-cover" />
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Manual Weaknesses */}
            <div className="mb-6">
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                Weak Topics (one per line, optional)
              </label>
              <textarea
                value={weaknesses}
                onChange={(e) => setWeaknesses(e.target.value)}
                placeholder="Rotational Mechanics&#10;Chemical Bonding&#10;Integration by Parts"
                rows={3}
                className="w-full px-4 py-2.5 bg-[#FAFBFF] border border-[#0A192F]/[0.06] rounded-xl text-sm text-[#0A192F] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#6366F1]/30 transition-colors resize-none"
              />
            </div>

            {/* Result Message */}
            {result && (
              <div
                className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-xs font-medium ${
                  result.success ? 'bg-[#34D399]/10 text-[#059669]' : 'bg-[#FB7185]/10 text-[#E11D48]'
                }`}
              >
                {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {result.message}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || !testName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#1E293B] disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm py-3.5 px-6 rounded-xl shadow-neo transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analysing with Ranjan Sir...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Analyse & Create Sprint</span>
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
