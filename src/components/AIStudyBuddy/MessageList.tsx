import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ActionEvent } from '@openuidev/react-lang';
import { AtlasOpenUIMessage } from '../../openui/AtlasOpenUIMessage';
import 'katex/dist/katex.min.css';

interface Message {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    subject?: string;
    topic?: string;
    isSystemAlert?: boolean;
    format?: 'markdown' | 'openui';
    fallbackContent?: string;
}

interface MessageListProps {
    messages: Message[];
    isLoading: boolean;
    isMentor: boolean;
    title: string;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    formatTime: (date: Date) => string;
    onOpenUIAction: (event: ActionEvent) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    isLoading,
    messagesEndRef,
    formatTime,
    onOpenUIAction,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loadingMessage, setLoadingMessage] = useState('Thinking…');

    useEffect(() => {
        if (!isLoading) {
            setLoadingMessage('Thinking…');
            return;
        }

        setLoadingMessage('Thinking…');
        const contextTimer = window.setTimeout(
            () => setLoadingMessage('Using your study context…'),
            1200,
        );
        const clarityTimer = window.setTimeout(
            () => setLoadingMessage('Shaping a clear next step…'),
            4000,
        );
        return () => {
            window.clearTimeout(contextTimer);
            window.clearTimeout(clarityTimer);
        };
    }, [isLoading]);

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

            {/* Wide reading column — ChatGPT-style flat prose */}
            <div className="max-w-4xl mx-auto px-8 py-10 w-full">
                {messages.map((message, idx) => {
                    const isUser = message.role === 'user';
                    const prev = messages[idx - 1];
                    const isNewGroup = !prev || prev.role !== message.role;
                    return (
                        <div key={message.id} className={`group ${isNewGroup ? 'mt-8 first:mt-0' : 'mt-3'}`}>
                            {/* Role label only on new group */}
                            {isNewGroup && (
                                <div className={`mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase ${isUser ? 'text-[#B5AEA5]' : 'text-[#8B7355]'}`}>
                                    {isUser ? 'You' : 'Atlas'}
                                </div>
                            )}

                            {message.isSystemAlert ? (
                                <div className="border-l-2 border-[#B87B6B] pl-4 py-1 text-sm leading-relaxed text-[#B87B6B]">
                                    <div className="prose prose-sm max-w-none prose-amber font-medium">
                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ) : isUser ? (
                                /* User: subtle quote-style block, no heavy bubble */
                                <div className="text-[15px] leading-relaxed text-[#2D2A26] font-medium pl-4 border-l-2 border-[#2D2A26]/15">
                                    <div className="prose prose-slate max-w-none font-[500]">
                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ) : message.format === 'openui' ? (
                                <AtlasOpenUIMessage
                                    content={message.content}
                                    fallbackContent={message.fallbackContent}
                                    onAction={onOpenUIAction}
                                />
                            ) : (
                                /* Atlas: flat prose, no bubble */
                                <div className="text-[15px] leading-[1.75] text-[#2D2A26]">
                                    <div className="prose prose-slate max-w-none font-[450] prose-p:my-3 prose-headings:mt-4">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            components={{
                                                strong: ({ node, ...props }) => <strong className="font-bold text-[#1a1815]" {...props} />,
                                                h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-3 mt-5" {...props} />,
                                                h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2 mt-4" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-sm font-bold mb-2 mt-3" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-3 space-y-1.5" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-3 space-y-1.5" {...props} />,
                                                p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                                code: ({ node, inline, ...props }: any) =>
                                                    inline
                                                        ? <code className="bg-[#F5F0E8] text-[#2D2A26] px-1.5 py-0.5 rounded-md font-mono text-[13px]" {...props} />
                                                        : <code className="block bg-[#2D2A26] text-[#F5F0E8] p-4 rounded-xl font-mono text-[13px] overflow-x-auto my-3" {...props} />
                                            }}
                                        >
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            {/* Timestamp — only on hover */}
                            <div className="mt-1.5 text-[10px] font-medium text-[#B5AEA5] opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatTime(message.timestamp)}
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="mt-8" role="status" aria-live="polite">
                        <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8B7355]">Atlas</div>
                        <div className="flex items-center gap-3 text-sm text-[#8A8279]">
                            <span>{loadingMessage}</span>
                            <span className="flex items-center gap-1.5" aria-hidden="true">
                            <div className="w-1.5 h-1.5 bg-[#8B7355] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-[#8B7355] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-[#8B7355] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};
