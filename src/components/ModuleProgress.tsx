import React from 'react';

interface ModuleProgressProps {
  id: string;
  title: string;
  description: string;
  totalLessons: number;
  completedLessons: number;
  isLocked: boolean;
  isCompleted: boolean;
  xpReward: number;
  onModuleClick: (moduleId: string) => void;
}

const ModuleProgress: React.FC<ModuleProgressProps> = ({
  id,
  title,
  description,
  totalLessons,
  completedLessons,
  isLocked,
  isCompleted,
  xpReward,
  onModuleClick
}) => {
  const progressPercentage = (completedLessons / totalLessons) * 100;
  const isPartiallyCompleted = completedLessons > 0 && completedLessons < totalLessons;

  const getProgressColor = () => {
    if (isCompleted) return 'bg-green-500';
    if (isPartiallyCompleted) return 'bg-blue-500';
    return 'bg-gray-300';
  };

  const getProgressText = () => {
    if (isCompleted) return 'Completed!';
    if (isPartiallyCompleted) return `${completedLessons}/${totalLessons} lessons`;
    return `${totalLessons} lessons`;
  };

  return (
    <div
      className={`relative rounded-xl border transition-all duration-200 cursor-pointer ${
        isLocked
          ? 'border-gray-600 bg-gray-800 opacity-60'
          : isCompleted
          ? 'border-green-500 bg-gray-800 hover:border-green-400'
          : isPartiallyCompleted
          ? 'border-blue-500 bg-gray-800 hover:border-blue-400'
          : 'border-gray-600 bg-gray-800 hover:border-gray-500'
      }`}
      onClick={() => !isLocked && onModuleClick(id)}
    >
      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 bg-gray-900/50 rounded-xl flex items-center justify-center">
          <div className="bg-gray-700 rounded-full p-3">
            <span className="text-2xl">🔒</span>
          </div>
        </div>
      )}

      {/* Completed badge */}
      {isCompleted && (
        <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-2">
          <span className="text-white text-sm font-bold">✓</span>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className={`text-xl font-bold mb-2 ${isLocked ? 'text-gray-400' : 'text-white'}`}>
              {title}
            </h3>
            <p className={`text-sm ${isLocked ? 'text-gray-500' : 'text-gray-300'}`}>
              {description}
            </p>
          </div>
          
          {/* XP Reward */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-yellow-400 text-xl">⭐</span>
            <span className={`text-lg font-bold ${isLocked ? 'text-gray-400' : 'text-gray-300'}`}>
              +{xpReward} XP
            </span>
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="relative">
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getProgressColor()}`}
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            
            {/* Progress indicators */}
            <div className="flex justify-between mt-2">
              {[...Array(totalLessons)].map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full border ${
                    index < completedLessons
                      ? 'bg-green-500 border-green-500'
                      : 'bg-gray-600 border-gray-500'
                  }`}
                ></div>
              ))}
            </div>
          </div>

          {/* Progress Text */}
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${isLocked ? 'text-gray-400' : 'text-gray-300'}`}>
              {getProgressText()}
            </span>
            
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              {isCompleted && (
                <span className="text-green-400 text-sm font-medium">🎉 Mastered!</span>
              )}
              {isPartiallyCompleted && (
                <span className="text-blue-400 text-sm font-medium">🔥 In Progress</span>
              )}
              {!isLocked && completedLessons === 0 && (
                <span className="text-gray-400 text-sm font-medium">📚 Ready to Start</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        {!isLocked && (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-blue-400">📊</span>
                <span className="text-gray-300">
                  {Math.round(progressPercentage)}% Complete
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">⏱️</span>
                <span className="text-gray-300">
                  ~{Math.round(totalLessons * 15)} min total
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleProgress; 