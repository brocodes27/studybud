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
        <div className="p-4 border-t-2 border-black bg-neo-bg relative z-40">
            {selectedImage && (
                <div className="mb-3 flex items-center gap-2 bg-white border-2 border-black p-1.5 shadow-[2px_2px_0px_0px_#000] w-fit -rotate-1">
                    <div className="h-10 w-10 border-2 border-black bg-neo-muted flex items-center justify-center overflow-hidden">
                        <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-tight max-w-[120px] truncate">{selectedImage.name}</div>
                    <button
                        type="button"
                        onClick={() => onImageSelect?.(null)}
                        className="p-1 hover:bg-neo-accent hover:text-white border-2 border-transparent hover:border-black transition-all"
                    >
                        <X className="h-3.5 w-3.5 stroke-[3px]" />
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
                    className="p-3 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:bg-neo-secondary active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex-shrink-0"
                    title="Attach Image"
                >
                    <Paperclip className="h-5 w-5 stroke-[3px]" />
                </button>

                <div className="flex-1 relative">
                    <div className="relative flex items-center bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] focus-within:translate-x-[-1px] focus-within:translate-y-[-1px] focus-within:shadow-[3px_3px_0px_0px_#000] transition-all">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="ASK ANYTHING..."
                            className="w-full bg-transparent text-black placeholder-black/30 px-4 py-3 focus:outline-none font-black uppercase tracking-tight text-base"
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                            disabled={isLoading}
                            className={`mr-2 p-1.5 border-2 border-transparent transition-all ${isRecording || isListening
                                ? 'bg-neo-accent text-white border-black animate-pulse'
                                : 'hover:bg-neo-muted text-black'
                                }`}
                        >
                            {isListening ? (
                                <Loader2 className="h-5 w-5 animate-spin stroke-[3px]" />
                            ) : isRecording ? (
                                <MicOff className="h-5 w-5 stroke-[3px]" />
                            ) : (
                                <Mic className="h-5 w-5 stroke-[3px]" />
                            )}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={(!inputMessage.trim() && !selectedImage) || isLoading}
                    className="p-3 bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:bg-neo-accent hover:shadow-[2px_2px_0px_0px_#000] disabled:opacity-20 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 active:shadow-none active:translate-x-[1px] active:translate-y-[1px] flex-shrink-0 transition-all"
                >
                    <Send className="h-5 w-5 stroke-[3px]" />
                </button>
            </form>
        </div>
    );
};

