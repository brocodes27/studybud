import React from 'react';
import { Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

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
    formatTime: (date: Date) => string;
}

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    isLoading,
    isMentor,
    title,
    messagesEndRef,
    formatTime
}) => {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-neo-bg scrollbar-thin scrollbar-thumb-black scrollbar-track-transparent">
            {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 border-2 border-black flex items-center justify-center ${message.role === 'user'
                        ? 'bg-black -rotate-6'
                        : 'bg-white rotate-6'
                        }`}>
                        {message.role === 'user' ? (
                            <User className="h-4 w-4 text-white stroke-[3px]" />
                        ) : (
                            <Bot className="h-4 w-4 text-black stroke-[3px]" />
                        )}
                    </div>

                    {/* Message Bubble Container */}
                    <div className={`max-w-[85%] flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Label (Mobile/Optional) */}
                        <div className="mb-1 flex items-center gap-2">
                            <span className="text-[8px] font-black uppercase tracking-widest bg-black text-white px-1.5 py-0.5">
                                {message.role === 'user' ? 'STUDENT' : (isMentor ? title.toUpperCase() : 'ELEVENFOLKS AI')}
                            </span>
                        </div>

                        {/* Bubble */}
                        <div className={`p-3 border-2 border-black shadow-[3px_3px_0px_0px_#000] relative ${message.role === 'user'
                            ? 'bg-neo-secondary text-black'
                            : 'bg-white text-black'
                            }`}>
                            {message.role === 'user' && (
                                <div className="absolute top-0 right-[-8px] w-0 h-0 border-t-[8px] border-t-black border-l-[8px] border-l-transparent" />
                            )}
                            {message.role === 'assistant' && (
                                <div className="absolute top-0 left-[-8px] w-0 h-0 border-t-[8px] border-t-black border-r-[8px] border-r-transparent" />
                            )}

                            <div className="prose prose-xs max-w-none leading-relaxed font-bold text-black overflow-hidden">
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={{
                                        strong: ({ node, ...props }) => <strong className="font-black" {...props} />,
                                        h1: ({ node, ...props }) => <h1 className="text-lg font-black uppercase mb-2" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-base font-black uppercase mb-1" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2" {...props} />,
                                        p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                        code: ({ node, inline, ...props }: any) =>
                                            inline
                                                ? <code className="bg-black/10 px-1 rounded font-mono text-[10px]" {...props} />
                                                : <code className="block bg-black text-white p-2 rounded font-mono text-[10px] overflow-x-auto my-1" {...props} />
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                            </div>
                        </div>

                        {/* Meta Info */}
                        <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[8px] font-black uppercase tracking-tighter ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <span className="bg-black/10 px-1.5 py-0.5">{formatTime(message.timestamp)}</span>
                            {message.subject && !isMentor && (
                                <>
                                    <span className="bg-neo-accent text-white px-1.5 py-0.5 border border-black">{message.subject}</span>
                                    {message.topic && <span className="bg-white border border-black px-1.5 py-0.5 text-black italic">{message.topic}</span>}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {isLoading && (
                <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-white border-2 border-black rotate-6 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-black stroke-[3px]" />
                    </div>
                    <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000] px-4 py-3 flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-neo-accent stroke-[3px]" />
                        <span className="text-xs font-black uppercase tracking-widest italic animate-pulse">THINKING...</span>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};

