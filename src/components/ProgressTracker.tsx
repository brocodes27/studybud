import React from 'react';

interface ProgressTrackerProps {
  totalXP: number;
  currentStreak: number;
  level: number;
  xpToNextLevel: number;
  totalXpForLevel: number;
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    isUnlocked: boolean;
    unlockedAt?: Date;
  }>;
  weeklyGoal: number;
  weeklyProgress: number;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  totalXP,
  currentStreak,
  level,
  xpToNextLevel,
  totalXpForLevel,
  achievements,
  weeklyGoal,
  weeklyProgress
}) => {
  const levelProgress = ((totalXpForLevel - xpToNextLevel) / totalXpForLevel) * 100;
  const weeklyProgressPercentage = (weeklyProgress / weeklyGoal) * 100;

  const getStreakColor = () => {
    if (currentStreak >= 7) return 'text-neo-accent';
    if (currentStreak >= 3) return 'text-cyan-400';
    return 'text-blue-500';
  };

  const getWeeklyProgressColor = () => {
    if (weeklyProgressPercentage >= 100) return 'bg-green-500';
    if (weeklyProgressPercentage >= 75) return 'bg-blue-500';
    if (weeklyProgressPercentage >= 50) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Learning Journey</h2>

      {/* Level and XP Section */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Level Progress */}
        <div className="bg-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray">Level {level}</h3>
            <span className="text-2xl">🏆</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-300">
              <span>Progress</span>
              <span>{Math.round(levelProgress)}%</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${levelProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400">
              {xpToNextLevel} XP to next level
            </p>
          </div>
        </div>

        {/* Total XP */}
        <div className="bg-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Total XP</h3>
            <span className="text-2xl">⭐</span>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-1">
              {totalXP.toLocaleString()}
            </div>
            <p className="text-sm text-gray-300">Experience Points</p>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Streak</h3>
            <span className="text-2xl">🔥</span>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${getStreakColor()} mb-1`}>
              {currentStreak}
            </div>
            <p className="text-sm text-gray-300">days</p>
          </div>
        </div>
      </div>

      {/* Weekly Goal */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Weekly Goal</h3>
          <span className="text-sm text-gray-300">
            {weeklyProgress}/{weeklyGoal} XP
          </span>
        </div>
        <div className="w-full bg-gray-600 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${getWeeklyProgressColor()}`}
            style={{ width: `${Math.min(weeklyProgressPercentage, 100)}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-sm text-gray-300 mt-2">
          <span>This week</span>
          <span>{Math.round(weeklyProgressPercentage)}%</span>
        </div>
      </div>

      {/* Recent Achievements */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h3>
        <div className="space-y-3">
          {achievements.slice(0, 3).map((achievement) => (
            <div
              key={achievement.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${achievement.isUnlocked
                  ? 'border-green-500 bg-green-900/20'
                  : 'border-gray-600 bg-gray-700 opacity-60'
                }`}
            >
              <span className="text-xl">{achievement.icon}</span>
              <div className="flex-1">
                <h4 className={`font-medium ${achievement.isUnlocked ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                  {achievement.title}
                </h4>
                <p className={`text-sm ${achievement.isUnlocked ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  {achievement.description}
                </p>
              </div>
              {achievement.isUnlocked && (
                <span className="text-green-400 text-lg">✓</span>
              )}
            </div>
          ))}
        </div>

        {achievements.length > 3 && (
          <button className="w-full mt-4 py-2 text-blue-400 hover:text-blue-300 font-medium">
            View all achievements ({achievements.length})
          </button>
        )}
      </div>
    </div>
  );
};

export default ProgressTracker; 