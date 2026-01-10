import React from 'react';
import { Clock, BookOpen, CheckCircle, Play, Target } from 'lucide-react';

interface LessonCardProps {
  title: string;
  description: string;
  duration: string;
  progress: number;
  completed: boolean;
  onClick: () => void;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  category?: string;
  estimatedTime?: string;
}

const difficultyStyles = {
  beginner: 'bg-neo-secondary',
  intermediate: 'bg-neo-muted',
  advanced: 'bg-neo-accent',
};

export const LessonCard: React.FC<LessonCardProps> = ({
  title,
  description,
  duration,
  progress,
  completed,
  onClick,
  difficulty = 'beginner',
  category,
  estimatedTime,
}) => {
  return (
    <div
      onClick={onClick}
      className="neo-card cursor-pointer group flex flex-col h-full bg-white"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="p-2 bg-neo-ink border-2 border-black">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            {category && (
              <span className="sticker border-2 bg-white text-[10px]">
                {category.toUpperCase()}
              </span>
            )}
            <span className={`sticker border-2 ${difficultyStyles[difficulty]} text-[10px]`}>
              {difficulty.toUpperCase()}
            </span>
          </div>
          <h3 className="text-xl font-black text-black uppercase tracking-tight line-clamp-2 leading-[1.1] group-hover:text-neo-accent transition-colors">
            {title}
          </h3>
        </div>
        {completed && (
          <div className="flex-shrink-0 w-10 h-10 bg-green-400 border-4 border-black flex items-center justify-center -rotate-6 shadow-[2px_2px_0px_0px_#000]">
            <CheckCircle className="w-6 h-6 text-black" />
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-black/70 text-sm font-bold leading-snug mb-6 flex-1 line-clamp-3">
        {description}
      </p>

      {/* Progress Section */}
      <div className="mb-6 bg-black/5 p-3 border-2 border-black border-dashed">
        <div className="flex items-center justify-between text-[10px] font-black uppercase mb-2">
          <span>PROGRESS</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-white border-4 border-black h-4 overflow-hidden">
          <div
            className={`h-full border-r-4 border-black transition-all duration-500 ${completed ? 'bg-green-400' : 'bg-neo-accent'
              }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t-2 border-black border-dashed">
        <div className="flex items-center gap-4 text-xs font-black text-black/60">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 stroke-[3px]" />
            <span>{duration.toUpperCase()}</span>
          </div>
          {estimatedTime && (
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4 stroke-[3px]" />
              <span>{estimatedTime.toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {completed ? (
            <span className="text-[10px] font-black bg-green-400 px-2 py-1 border-2 border-black">DONE</span>
          ) : (
            <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
              <span className="text-[10px] font-black uppercase">START</span>
              <Play className="w-4 h-4 fill-black text-black" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
