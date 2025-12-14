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
        <div className="p-4 border-t border-white/10 glass-card backdrop-blur-sm rounded-b-2xl">
            {selectedImage && (
                <div className="mb-3 flex items-center gap-2 bg-white/5 p-2 rounded-lg w-fit border border-white/10">
                    <div className="h-10 w-10 rounded bg-gray-800 flex items-center justify-center overflow-hidden relative">
                        <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="text-xs text-gray-300 max-w-[150px] truncate">{selectedImage.name}</div>
                    <button
                        type="button"
                        onClick={() => onImageSelect?.(null)}
                        className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}
            <form onSubmit={onSubmit} className="flex gap-3 items-end">
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 border border-white/5 hover:border-white/10 flex-shrink-0"
                    title="Attach Image"
                >
                    <Paperclip className="h-5 w-5" />
                </button>
                <div className="flex-1 relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 rounded-xl opacity-0 group-focus-within:opacity-100 transition duration-300 blur-sm"></div>
                    <div className="relative flex items-center bg-black/40 border border-white/10 rounded-xl focus-within:border-neon-blue/50 focus-within:ring-1 focus-within:ring-neon-blue/50 transition-all duration-200 backdrop-blur-sm">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Ask anything..."
                            className="w-full bg-transparent text-white placeholder-white/30 px-4 py-3.5 focus:outline-none rounded-xl"
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                            disabled={isLoading}
                            className={`mr-2 p-2 rounded-lg transition-all duration-200 ${isRecording || isListening
                                ? 'bg-red-500/20 text-red-400 animate-pulse'
                                : 'hover:bg-white/10 text-gray-400 hover:text-white'
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
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={(!inputMessage.trim() && !selectedImage) || isLoading}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white shadow-lg shadow-neon-blue/20 hover:shadow-neon-blue/40 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 transition-all duration-200"
                >
                    <Send className="h-5 w-5" />
                </button>
            </form>
        </div>
    );
};
