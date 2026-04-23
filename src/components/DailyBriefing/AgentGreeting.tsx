import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface AgentGreetingProps {
  greeting: string;
  userName: string;
  streak: number;
}

export function AgentGreeting({ greeting, userName, streak }: AgentGreetingProps) {
  const [displayedText, setDisplayedText] = useState('');
  const fullText = `${greeting}, ${userName}! I'm your study coach. Ready to crush today's goals?`;

  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 28);
    return () => clearInterval(interval);
  }, [fullText]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-start gap-4"
    >
      {/* Agent Avatar */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366F1] to-[#00D1FF] flex items-center justify-center shadow-glow-cyan">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#34D399] border-2 border-white rounded-full animate-pulse" />
      </div>

      {/* Speech Bubble */}
      <div className="relative bg-white border border-[#0A192F]/[0.06] rounded-2xl rounded-tl-sm px-5 py-4 shadow-neo-sm max-w-xl">
        <div className="text-[11px] font-bold text-[#6366F1] uppercase tracking-wider mb-1">
          Your Study Coach
        </div>
        <p className="text-[15px] font-medium text-[#0A192F] leading-relaxed">
          {displayedText}
          <span className="inline-block w-0.5 h-4 bg-[#00D1FF] ml-0.5 align-middle animate-pulse" />
        </p>
        {streak > 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FEF3C7] rounded-full"
          >
            <span className="text-xs">🔥</span>
            <span className="text-[11px] font-bold text-[#92400E]">{streak}-day streak</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
