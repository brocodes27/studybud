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
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-neo-bg scrollbar-thin scrollbar-thumb-black scrollbar-track-transparent">
            {messages.map((message) => (
                <div key={message.id} className={`flex gap-5 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-10 h-10 border-4 border-black flex items-center justify-center ${message.role === 'user'
                        ? 'bg-black -rotate-6'
                        : 'bg-white rotate-6'
                        }`}>
                        {message.role === 'user' ? (
                            <User className="h-6 w-6 text-white stroke-[3px]" />
                        ) : (
                            <Bot className="h-6 w-6 text-black stroke-[3px]" />
                        )}
                    </div>

                    {/* Message Bubble Container */}
                    <div className={`max-w-[80%] flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Label (Mobile/Optional) */}
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-2 py-0.5">
                                {message.role === 'user' ? 'STUDENT' : (isMentor ? title.toUpperCase() : 'ELEVENFOLKS AI')}
                            </span>
                        </div>

                        {/* Bubble */}
                        <div className={`p-5 border-4 border-black shadow-[6px_6px_0px_0px_#000] relative ${message.role === 'user'
                            ? 'bg-neo-secondary text-black'
                            : 'bg-white text-black'
                            }`}>
                            {message.role === 'user' && (
                                <div className="absolute top-0 right-[-12px] w-0 h-0 border-t-[12px] border-t-black border-l-[12px] border-l-transparent" />
                            )}
                            {message.role === 'assistant' && (
                                <div className="absolute top-0 left-[-12px] w-0 h-0 border-t-[12px] border-t-black border-r-[12px] border-r-transparent" />
                            )}

                            <div
                                className="prose prose-sm max-w-none leading-relaxed font-bold text-black"
                                dangerouslySetInnerHTML={renderMarkdownLite(message.content)}
                            />
                        </div>

                        {/* Meta Info */}
                        <div className={`mt-3 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-tighter ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <span className="bg-black/10 px-2 py-0.5">{formatTime(message.timestamp)}</span>
                            {message.subject && !isMentor && (
                                <>
                                    <span className="bg-neo-accent text-white px-2 py-0.5 border border-black">{message.subject}</span>
                                    {message.topic && <span className="bg-white border border-black px-2 py-0.5 text-black italic">{message.topic}</span>}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {isLoading && (
                <div className="flex gap-5">
                    <div className="flex-shrink-0 w-10 h-10 bg-white border-4 border-black rotate-6 flex items-center justify-center">
                        <Bot className="h-6 w-6 text-black stroke-[3px]" />
                    </div>
                    <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] px-5 py-4 flex items-center gap-4">
                        <Loader2 className="h-6 w-6 animate-spin text-neo-accent stroke-[3px]" />
                        <span className="text-sm font-black uppercase tracking-widest italic animate-pulse">THINKING...</span>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};

