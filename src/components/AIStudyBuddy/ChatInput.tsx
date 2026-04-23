import React from 'react';
import { Mic, MicOff, Loader2, ArrowUp, Paperclip, X } from 'lucide-react';

interface ChatInputProps {
    inputMessage: string;
    setInputMessage: (v: string) => void;
    isLoading: boolean;
    isRecording: boolean;
    isListening: boolean;
    isMentor: boolean;
    onSubmit: (e: React.FormEvent) => void;
    startVoiceRecording: () => void;
    stopVoiceRecording: () => void;
    onImageSelect?: (file: File | null) => void;
    selectedImage?: File | null;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputMessage,
    setInputMessage,
    isLoading,
    isRecording,
    isListening,
    onSubmit,
    startVoiceRecording,
    stopVoiceRecording,
    onImageSelect,
    selectedImage,
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImageSelect?.(e.target.files[0]);
        }
    };

    // Auto-resize textarea
    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
        }
    }, [inputMessage]);

    return (
        <div className="bg-[#FAF8F5] px-4 pt-2 pb-4">
            <div className="max-w-3xl mx-auto">
                {/* Image Preview */}
                {selectedImage && (
                    <div className="mb-3 flex items-center gap-3 bg-white border border-[#E8E2D9] p-2.5 rounded-2xl w-fit">
                        <div className="h-10 w-10 rounded-xl bg-[#F5F0E8] flex items-center justify-center overflow-hidden">
                            <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="h-full w-full object-cover" />
                        </div>
                        <div className="text-xs font-medium text-[#8A8279] max-w-[150px] truncate">{selectedImage.name}</div>
                        <button
                            type="button"
                            onClick={() => onImageSelect?.(null)}
                            className="p-1 hover:bg-[#F5F0E8] rounded-full transition-colors"
                        >
                            <X className="h-3.5 w-3.5 text-[#B5AEA5]" />
                        </button>
                    </div>
                )}

                {/* Input Bar */}
                <form onSubmit={onSubmit}>
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />

                    <div className="bg-white rounded-[20px] border border-[#E8E2D9] shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-2 transition-all focus-within:border-[#8B7355]/30 focus-within:shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Message Atlas..."
                            className="w-full resize-none focus:outline-none px-3 py-2.5 text-[#2D2A26] placeholder-[#B5AEA5] font-sans text-[15px] leading-relaxed bg-transparent"
                            disabled={isLoading}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onSubmit(e);
                                }
                            }}
                        />

                        <div className="flex items-center justify-between px-1 pt-1">
                            {/* Left tools */}
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#B5AEA5] hover:bg-[#F5F0E8] hover:text-[#8A8279] transition-colors"
                                    title="Attach Image"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                                    disabled={isLoading}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isRecording || isListening
                                        ? 'bg-red-50 text-red-500'
                                        : 'text-[#B5AEA5] hover:bg-[#F5F0E8] hover:text-[#8A8279]'
                                        }`}
                                >
                                    {isListening ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : isRecording ? (
                                        <MicOff className="h-4 w-4" />
                                    ) : (
                                        <Mic className="h-4 w-4" />
                                    )}
                                </button>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={(!inputMessage.trim() && !selectedImage) || isLoading}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2D2A26] text-white hover:bg-[#3D3833] disabled:opacity-20 disabled:bg-[#E8E2D9] disabled:text-[#8A8279] transition-all"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </form>

                <p className="text-center text-[10px] text-[#B5AEA5] mt-3 font-sans">
                    Atlas may make mistakes. Verify important information.
                </p>
            </div>
        </div>
    );
};
