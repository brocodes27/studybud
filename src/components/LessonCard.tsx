import React from 'react';
import { Clock, BookOpen, CheckCircle, Play, Target, TrendingUp } from 'lucide-react';

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

const difficultyColors = {
  beginner: 'from-success-500 to-success-600',
  intermediate: 'from-warning-500 to-warning-600',
  advanced: 'from-accent-500 to-accent-600',
};

const difficultyLabels = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
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
      className="card-elevated cursor-pointer group relative overflow-hidden"
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-accent-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Header */}
      <div className="relative z-10 flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-5 h-5 text-primary-400" />
            {category && (
              <span className="text-xs font-medium text-gray-400 bg-gray-700/50 px-2 py-1 rounded-lg">
                {category}
              </span>
            )}
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg bg-gradient-to-r ${difficultyColors[difficulty]} text-white`}>
              {difficultyLabels[difficulty]}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary-300 transition-colors duration-200">
            {title}
          </h3>
        </div>
        {completed && (
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-success-500 to-success-600 rounded-full flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Description */}
      <p className="relative z-10 text-gray-300 text-sm leading-relaxed mb-4 line-clamp-2">
        {description}
      </p>

      {/* Progress bar */}
      <div className="relative z-10 mb-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completed
                ? 'bg-gradient-to-r from-success-500 to-success-600'
                : 'bg-gradient-to-r from-primary-500 to-accent-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{duration}</span>
          </div>
          {estimatedTime && (
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              <span>{estimatedTime}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {completed ? (
            <div className="flex items-center gap-1 text-success-400 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>Completed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-primary-400 text-sm font-medium group-hover:text-primary-300 transition-colors duration-200">
              <Play className="w-4 h-4" />
              <span>Start</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-accent-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}; 