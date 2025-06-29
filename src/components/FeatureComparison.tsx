import React from 'react';

export function FeatureComparison() {
  return (
    <div className="max-w-2xl mx-auto my-8 bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-center">Compare Plans</h2>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div></div>
        <div className="font-bold text-blue-700">Free</div>
        <div className="font-bold text-yellow-600">Premium</div>
      </div>
      <div className="grid grid-cols-3 gap-4 py-2 border-b">
        <div>Question plan days/month</div>
        <div>7</div>
        <div>Unlimited</div>
      </div>
      <div className="grid grid-cols-3 gap-4 py-2 border-b">
        <div>Subjects</div>
        <div>1</div>
        <div>Multiple</div>
      </div>
      <div className="grid grid-cols-3 gap-4 py-2 border-b">
        <div>Question types</div>
        <div>MCQ, Short-answer</div>
        <div>All types</div>
      </div>
      <div className="grid grid-cols-3 gap-4 py-2 border-b">
        <div>AI Study Buddy</div>
        <div>—</div>
        <div>✔</div>
      </div>
      <div className="grid grid-cols-3 gap-4 py-2 border-b">
        <div>Advanced analytics</div>
        <div>—</div>
        <div>✔</div>
      </div>
      <div className="grid grid-cols-3 gap-4 py-2 border-b">
        <div>Smart notifications</div>
        <div>—</div>
        <div>✔</div>
      </div>
      <div className="grid grid-cols-3 gap-4 py-2">
        <div>Social/group features</div>
        <div>—</div>
        <div>✔</div>
      </div>
    </div>
  );
} 