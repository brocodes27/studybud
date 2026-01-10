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
        <div className="p-6 border-t-4 border-black bg-neo-bg relative z-40">
            {selectedImage && (
                <div className="mb-4 flex items-center gap-3 bg-white border-2 border-black p-2 shadow-[4px_4px_0px_0px_#000] w-fit -rotate-1">
                    <div className="h-12 w-12 border-2 border-black bg-neo-muted flex items-center justify-center overflow-hidden">
                        <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-tight max-w-[150px] truncate">{selectedImage.name}</div>
                    <button
                        type="button"
                        onClick={() => onImageSelect?.(null)}
                        className="p-1 hover:bg-neo-accent hover:text-white border-2 border-transparent hover:border-black transition-all"
                    >
                        <X className="h-4 w-4 stroke-[3px]" />
                    </button>
                </div>
            )}
            <form onSubmit={onSubmit} className="flex gap-4 items-end">
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
                    className="p-4 bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:bg-neo-secondary active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex-shrink-0"
                    title="Attach Image"
                >
                    <Paperclip className="h-6 w-6 stroke-[3px]" />
                </button>

                <div className="flex-1 relative">
                    <div className="relative flex items-center bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] focus-within:translate-x-[-2px] focus-within:translate-y-[-2px] focus-within:shadow-[6px_6px_0px_0px_#000] transition-all">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="ASK ANYTHING..."
                            className="w-full bg-transparent text-black placeholder-black/30 px-5 py-4 focus:outline-none font-black uppercase tracking-tight text-lg"
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                            disabled={isLoading}
                            className={`mr-3 p-2 border-2 border-transparent transition-all ${isRecording || isListening
                                ? 'bg-neo-accent text-white border-black animate-pulse'
                                : 'hover:bg-neo-muted text-black'
                                }`}
                        >
                            {isListening ? (
                                <Loader2 className="h-6 w-6 animate-spin stroke-[3px]" />
                            ) : isRecording ? (
                                <MicOff className="h-6 w-6 stroke-[3px]" />
                            ) : (
                                <Mic className="h-6 w-6 stroke-[3px]" />
                            )}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={(!inputMessage.trim() && !selectedImage) || isLoading}
                    className="p-4 bg-black text-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:bg-neo-accent hover:shadow-[4px_4px_0px_0px_#000] disabled:opacity-20 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] flex-shrink-0 transition-all"
                >
                    <Send className="h-6 w-6 stroke-[3px]" />
                </button>
            </form>
        </div>
    );
};

