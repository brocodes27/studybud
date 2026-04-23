import React, { useRef, useEffect } from 'react';
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
    isSystemAlert?: boolean;
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
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change or loading state toggles
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
    }, [messages.length, isLoading]);

    return (
        <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', minHeight: 0, scrollbarWidth: 'none' as any }}
            className="scroll-smooth flex flex-col"
        >
            {/* Spacer absorbs available space so messages start from the bottom */}
            <div className="flex-1 min-h-0" />

            {/* Centered content column like ChatGPT / Manus */}
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 w-full">
                {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {/* Role Label */}
                            <div className={`mb-1 px-1 text-[11px] font-semibold tracking-wide ${message.role === 'user' ? 'text-[#B5AEA5]' : 'text-[#8A8279]'}`}>
                                {message.role === 'user' ? 'You' : 'Atlas'}
                            </div>

                            {/* System Alert Style */}
                            {message.isSystemAlert ? (
                                <div className="px-5 py-4 rounded-2xl bg-[#F5F0E8] border border-[#E8E2D9] text-sm leading-relaxed text-[#B87B6B]">
                                    <div className="prose prose-sm max-w-none prose-amber font-medium">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                        >
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ) : (
                                /* Bubble */
                                <div className={`px-5 py-4 rounded-2xl text-sm leading-relaxed ${message.role === 'user'
                                    ? 'bg-[#2D2A26] text-white'
                                    : 'bg-white border border-[#E8E2D9] text-[#2D2A26] shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
                                    }`}>
                                    <div className={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : 'prose-slate'} font-[450]`}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            components={{
                                                strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                                                h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-3 mt-1" {...props} />,
                                                h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2 mt-1" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-sm font-bold mb-2 mt-1" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-3 space-y-1" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-3 space-y-1" {...props} />,
                                                p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                                code: ({ node, inline, ...props }: any) =>
                                                    inline
                                                        ? <code className="bg-[#F5F0E8] text-[#2D2A26] px-1.5 py-0.5 rounded-md font-mono text-xs" {...props} />
                                                        : <code className="block bg-[#2D2A26] text-[#F5F0E8] p-4 rounded-xl font-mono text-xs overflow-x-auto my-3" {...props} />
                                            }}
                                        >
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            {/* Timestamp */}
                            <div className="mt-1.5 px-1 text-[10px] font-medium text-[#B5AEA5]">
                                {formatTime(message.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="max-w-[85%]">
                            <div className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-[#8A8279]">Atlas</div>
                            <div className="bg-white border border-[#E8E2D9] shadow-sm px-5 py-4 rounded-2xl flex items-center gap-3">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-[#D4CFC7] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-[#D4CFC7] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-[#D4CFC7] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-xs font-medium text-[#B5AEA5]">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};
