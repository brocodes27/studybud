import React from 'react';
import { Mic, MicOff, Loader2, Send, Paperclip, X } from 'lucide-react';

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImageSelect?.(e.target.files[0]);
        }
    };

    return (
        <div className="p-6 bg-slate-900 border-t border-white/5 relative z-40">
            {selectedImage && (
                <div className="mb-4 flex items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-2xl w-fit">
                    <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden">
                        <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="text-xs font-medium text-slate-300 max-w-[150px] truncate">{selectedImage.name}</div>
                    <button
                        type="button"
                        onClick={() => onImageSelect?.(null)}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="h-4 w-4 text-slate-400" />
                    </button>
                </div>
            )}
            <form onSubmit={onSubmit} className="flex gap-4 items-center">
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />

                <div className="flex-1 relative group">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-2 pl-4 transition-all focus-within:border-blue-500/50 focus-within:bg-white/10">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                            title="Attach Image"
                        >
                            <Paperclip className="h-5 w-5" />
                        </button>

                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Ask Atlas AI..."
                            className="flex-1 bg-transparent text-white placeholder-slate-500 px-4 py-3 focus:outline-none text-base"
                            disabled={isLoading}
                        />

                        <button
                            type="button"
                            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                            disabled={isLoading}
                            className={`p-2 rounded-full transition-all ${isRecording || isListening
                                ? 'bg-red-500/20 text-red-400 animate-pulse'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {isListening ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : isRecording ? (
                                <MicOff className="h-5 w-5" />
                            ) : (
                                <Mic className="h-5 w-5" />
                            )}
                        </button>

                        <button
                            type="submit"
                            disabled={(!inputMessage.trim() && !selectedImage) || isLoading}
                            className="ml-2 p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-20 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

