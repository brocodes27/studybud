import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileImage, FileText, Loader2, CheckCircle2, AlertCircle, Camera, Type } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';

interface TaskOutputUploadProps {
  userId: string;
  prescriptionId: string;
  taskOrder: number;
  taskTitle: string;
  subject?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function TaskOutputUpload({
  userId,
  prescriptionId,
  taskOrder,
  taskTitle,
  subject,
  onSuccess,
  onClose,
}: TaskOutputUploadProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'select' | 'text' | 'image' | 'pdf'>('select');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; analysis?: any } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
      setMode('image');
    } else {
      setMode('pdf');
    }
    setResult(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);

    try {
      let outputType = mode;
      let textData = textContent;
      let fileUrl: string | null = null;
      let analysisSucceeded = false;

      // If image, convert to base64
      if (mode === 'image' && preview) {
        textData = ''; // Not text
      }

      // Upload file if PDF
      if (mode === 'pdf' && file) {
        const filePath = `task-outputs/${userId}/${prescriptionId}/${taskOrder}_${Date.now()}.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from('task-outputs')
          .upload(filePath, file);
        if (uploadErr) {
          // If bucket doesn't exist, store as text note
          fileUrl = `file_upload_pending_${file.name}`;
        } else {
          const { data: urlData } = supabase.storage.from('task-outputs').getPublicUrl(filePath);
          fileUrl = urlData?.publicUrl || null;
        }
      }

      // Save to task_outputs table
      const { data: insertData, error: insertErr } = await supabase.from('task_outputs').insert({
        user_id: userId,
        prescription_id: prescriptionId,
        task_order: taskOrder,
        output_type: outputType === 'select' ? 'text' : outputType,
        text_content: mode === 'text' ? textData : (mode === 'image' ? preview : null),
        file_url: fileUrl,
        ai_analysis: null,
      }).select().single();

      if (insertErr) throw insertErr;

      // Invoke edge function to analyze
      let analysisErrorMsg: string | null = null;
      try {
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyse-task-output', {
          body: {
            output_id: insertData?.id,
            task_title: taskTitle,
            subject: subject || null,
            output_type: outputType === 'select' ? 'text' : outputType,
            text_content: mode === 'text' ? textData : (mode === 'image' ? preview : null),
          }
        });
        if (analysisError) {
          analysisErrorMsg = analysisError.message || 'Edge function returned error';
          console.error('analyse-task-output error:', analysisError);
        } else if (!analysisData?.success) {
          analysisErrorMsg = analysisData?.error || 'Analysis did not complete successfully';
          console.error('analyse-task-output returned non-success:', analysisData);
        }
        analysisSucceeded = !analysisErrorMsg;
      } catch (err: any) {
        analysisErrorMsg = err?.message || 'Failed to invoke analysis';
        console.error('Failed to invoke analyse-task-output:', err);
      }

      // Update user_knowledge with the fact that they worked on this topic.
      try {
        await supabase.from('user_knowledge').insert({
          user_id: userId,
          topic: taskTitle,
          subject: subject || 'General',
          knowledge_type: 'task_output',
          content: mode === 'text' ? textData.slice(0, 500) : `Submitted ${outputType} output for: ${taskTitle}`,
          source_type: 'task_output',
          source: 'task_output_upload',
          confidence: 0.6,
          metadata: {
            prescription_id: prescriptionId,
            task_order: taskOrder,
            output_type: outputType === 'select' ? 'text' : outputType,
          },
        });
      } catch {
        // user_knowledge insert is best-effort
      }

      void supabase.rpc('refresh_behavioral_profile', { p_user_id: userId });

      setResult({
        success: true,
        message: analysisSucceeded
          ? 'Output submitted and analyzed. Your task memory is now updated.'
          : 'Output submitted. Analysis is still pending, but your submission was saved.',
      });

      showToast('+15 XP — Task output submitted!', 'success');

      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (e: any) {
      setResult({ success: false, message: e?.message || 'Upload failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-[#FAF8F5] rounded-2xl border border-[#E8E2D9] p-4 mt-3">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-[#2D2A26] uppercase tracking-wider">Submit Your Work</h4>
          <button onClick={onClose} className="p-1 hover:bg-white rounded-lg transition-colors">
            <X className="w-3.5 h-3.5 text-[#8A8279]" />
          </button>
        </div>

        {/* Mode Selection */}
        {mode === 'select' && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              onClick={() => setMode('text')}
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-[#E8E2D9] hover:border-[#8B7355]/30 hover:shadow-sm transition-all"
            >
              <Type className="w-5 h-5 text-[#8B7355]" />
              <span className="text-[10px] font-semibold text-[#2D2A26]">Type It</span>
            </button>
            <button
              onClick={() => { inputRef.current?.setAttribute('accept', 'image/*'); inputRef.current?.click(); }}
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-[#E8E2D9] hover:border-[#8B7355]/30 hover:shadow-sm transition-all"
            >
              <Camera className="w-5 h-5 text-[#8B7355]" />
              <span className="text-[10px] font-semibold text-[#2D2A26]">Photo</span>
            </button>
            <button
              onClick={() => { inputRef.current?.setAttribute('accept', '.pdf'); inputRef.current?.click(); }}
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-[#E8E2D9] hover:border-[#8B7355]/30 hover:shadow-sm transition-all"
            >
              <FileText className="w-5 h-5 text-[#8B7355]" />
              <span className="text-[10px] font-semibold text-[#2D2A26]">PDF</span>
            </button>
          </div>
        )}

        <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />

        {/* Text Input */}
        {mode === 'text' && (
          <div className="mb-3">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Write your notes, solutions, or summary here..."
              rows={5}
              className="w-full px-3 py-2.5 bg-white border border-[#E8E2D9] rounded-xl text-sm text-[#2D2A26] placeholder:text-[#B5AEA5] focus:outline-none focus:border-[#8B7355]/40 transition-colors resize-none"
            />
          </div>
        )}

        {/* Image Preview */}
        {mode === 'image' && preview && (
          <div className="relative rounded-xl overflow-hidden border border-[#E8E2D9] mb-3">
            <img src={preview} alt="Preview" className="w-full h-32 object-cover" />
            <button
              onClick={() => { setFile(null); setPreview(null); setMode('select'); }}
              className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* PDF Selected */}
        {mode === 'pdf' && file && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-[#E8E2D9] mb-3">
            <FileText className="w-5 h-5 text-[#8B7355]" />
            <span className="text-xs font-medium text-[#2D2A26] truncate flex-1">{file.name}</span>
            <button onClick={() => { setFile(null); setMode('select'); }} className="text-[#8A8279] hover:text-[#2D2A26]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`flex items-center gap-2 p-2.5 rounded-xl mb-3 text-xs font-medium ${
            result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {result.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {result.message}
          </div>
        )}

        {/* Submit */}
        {mode !== 'select' && !result?.success && (
          <button
            onClick={handleSubmit}
            disabled={loading || (mode === 'text' && !textContent.trim()) || (mode === 'image' && !preview) || (mode === 'pdf' && !file)}
            className="w-full flex items-center justify-center gap-2 bg-[#2D2A26] hover:bg-[#3D3833] disabled:opacity-40 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing...</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> Submit & Update Knowledge Base</>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
