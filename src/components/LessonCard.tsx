import React from 'react';

interface LessonCardProps {
  id: string;
  title: string;
  description: string;
  type: 'theory' | 'exercise' | 'quiz' | 'review' | 'challenge';
  isLocked: boolean;
  isCompleted: boolean;
  xpReward: number;
  estimatedTime: number; // in minutes
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' | 'master';
  accuracy?: number; // 0-100, only for completed lessons
  onLessonClick: (lessonId: string) => void;
}

const LessonCard: React.FC<LessonCardProps> = ({
  id,
  title,
  description,
  type,
  isLocked,
  isCompleted,
  xpReward,
  estimatedTime,
  difficulty,
  accuracy,
  onLessonClick
}) => {
  const getTypeIcon = () => {
    switch (type) {
      case 'theory':
        return '🗣️';
      case 'exercise':
        return '🎮';
      case 'quiz':
        return '🎯';
      case 'review':
        return '🔄';
      case 'challenge':
        return '⚡';
      default:
        return '📝';
    }
  };

  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-orange-100 text-orange-800';
      case 'expert':
        return 'bg-red-100 text-red-800';
      case 'master':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressStars = () => {
    if (!isCompleted) return null;
    
    const starCount = accuracy ? Math.ceil(accuracy / 20) : 5;
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <span key={i} className={`text-lg ${i < starCount ? 'text-yellow-400' : 'text-gray-300'}`}>
            ⭐
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`relative rounded-xl border transition-all duration-200 cursor-pointer ${
        isLocked
          ? 'border-gray-600 bg-gray-800 opacity-60'
          : isCompleted
          ? 'border-green-500 bg-gray-800 hover:border-green-400'
          : 'border-gray-600 bg-gray-800 hover:border-blue-400 hover:shadow-lg'
      }`}
      onClick={() => !isLocked && onLessonClick(id)}
    >
      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 bg-gray-900/50 rounded-xl flex items-center justify-center">
          <div className="bg-gray-700 rounded-full p-2">
            <span className="text-xl">🔒</span>
          </div>
        </div>
      )}

      {/* Completed checkmark */}
      {isCompleted && (
        <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
          <span className="text-white text-sm">✓</span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{getTypeIcon()}</span>
            <div>
              <h3 className={`font-semibold ${isLocked ? 'text-gray-400' : 'text-white'}`}>
                {title}
              </h3>
              <p className={`text-sm ${isLocked ? 'text-gray-500' : 'text-gray-300'}`}>
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Progress and stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* XP Reward */}
            <div className="flex items-center gap-1">
              <span className="text-yellow-400 text-lg">⭐</span>
              <span className={`text-sm font-medium ${isLocked ? 'text-gray-400' : 'text-gray-300'}`}>
                +{xpReward} XP
              </span>
            </div>

            {/* Time estimate */}
            <div className="flex items-center gap-1">
              <span className="text-blue-400">⏱️</span>
              <span className={`text-sm ${isLocked ? 'text-gray-400' : 'text-gray-300'}`}>
                {estimatedTime}m
              </span>
            </div>

            {/* Difficulty badge */}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor()}`}>
              {difficulty}
            </span>
          </div>

          {/* Stars for completed lessons */}
          {isCompleted && getProgressStars()}
        </div>

        {/* Progress bar for completed lessons */}
        {isCompleted && accuracy && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Accuracy</span>
              <span>{accuracy}%</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${accuracy}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonCard; 