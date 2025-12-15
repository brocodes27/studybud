import React from 'react';
import { Loader2, Bot, User } from 'lucide-react';

interface Message {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    subject?: string;
    topic?: string;
}

interface MessageListProps {
    messages: Message[];
    isLoading: boolean;
    isMentor: boolean;
    title: string;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    renderMarkdownLite: (content: string) => { __html: string };
    formatTime: (date: Date) => string;
}

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    isLoading,
    isMentor,
    title,
    messagesEndRef,
    renderMarkdownLite,
    formatTime
}) => {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {messages.map((message) => (
                <div key={message.id} className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-white/10 ${message.role === 'user'
                            ? 'bg-gradient-to-br from-neon-blue to-blue-600'
                            : 'bg-black/40'
                        }`}>
                        {message.role === 'user' ? (
                            <User className="h-4 w-4 text-white" />
                        ) : (
                            <Bot className="h-4 w-4 text-neon-purple" />
                        )}
                    </div>

                    {/* Message Bubble */}
                    <div className={`max-w-[85%] space-y-1 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`px-5 py-3.5 rounded-2xl backdrop-blur-sm border shadow-lg ${message.role === 'user'
                                ? 'bg-neon-blue/20 border-neon-blue/30 text-white rounded-tr-none'
                                : 'bg-[#0a0b14]/80 border-neon-purple/20 text-gray-100 rounded-tl-none backdrop-blur-md'
                            }`}>
                            {isMentor && message.role === 'assistant' && (
                                <div className="text-[10px] font-bold text-neon-blue uppercase mb-2 flex items-center gap-2 tracking-wider">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-neon-blue shadow-[0_0_5px_rgba(0,243,255,0.8)]" />
                                    {title}
                                </div>
                            )}
                            <div
                                className="prose prose-invert prose-sm max-w-none leading-relaxed"
                                dangerouslySetInnerHTML={renderMarkdownLite(message.content)}
                            />
                        </div>

                        {/* Meta Info */}
                        <div className={`flex items-center gap-2 text-[10px] text-gray-500 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <span>{formatTime(message.timestamp)}</span>
                            {message.subject && !isMentor && (
                                <>
                                    <span>•</span>
                                    <span className="text-neon-blue">{message.subject}</span>
                                    {message.topic && <span className="text-gray-400">({message.topic})</span>}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {isLoading && (
                <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black/40 border border-white/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-neon-purple" />
                    </div>
                    <div className="bg-neon-purple/10 border border-neon-purple/20 rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-3">
                        <div className="flex gap-1">
                            <span className="w-2 h-2 bg-neon-blue rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-2 h-2 bg-neon-purple rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 bg-neon-green rounded-full animate-bounce"></span>
                        </div>
                        <span className="text-xs text-gray-400 font-medium animate-pulse">Thinking...</span>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};
