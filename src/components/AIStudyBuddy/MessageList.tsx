import React from 'react';
import { Loader2 } from 'lucide-react';
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
    messagesEndRef,
    formatTime
}) => {
    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-transparent scroll-smooth custom-scrollbar">
            {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Bubble */}
                        <div className={`px-6 py-4 rounded-[2rem] text-sm leading-relaxed shadow-sm ${message.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-white text-slate-900 rounded-tl-sm'
                            }`}>

                            <div className={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : 'prose-slate'} font-medium`}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={{
                                        strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                                        h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-4" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-3" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-4" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-4" {...props} />,
                                        p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                                        code: ({ node, inline, ...props }: any) =>
                                            inline
                                                ? <code className="bg-slate-200/50 px-1 rounded font-mono text-xs" {...props} />
                                                : <code className="block bg-slate-100 text-slate-900 p-4 rounded-xl font-mono text-xs overflow-x-auto my-4 border border-slate-200" {...props} />
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                            </div>
                        </div>

                        {/* Meta Info */}
                        <div className={`mt-2 px-2 flex items-center gap-2 text-[10px] font-medium text-slate-500`}>
                            <span>{formatTime(message.timestamp)}</span>
                            {message.role === 'assistant' && (
                                <>
                                    <span>•</span>
                                    <span>Atlas Brain</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {isLoading && (
                <div className="flex gap-3">
                    <div className="bg-white border border-slate-200 shadow-sm px-6 py-4 rounded-[2rem] rounded-tl-sm flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-xs font-semibold text-slate-900">Studying Neural Node...</span>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};

