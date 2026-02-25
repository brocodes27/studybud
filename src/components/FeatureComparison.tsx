import React from 'react';

export function FeatureComparison() {
  const rows = [
    {
      label: 'Question plan days/month',
      free: '7',
      premium: 'Unlimited',
    },
    {
      label: 'Subjects',
      free: '1',
      premium: 'Multiple',
    },
    {
      label: 'Question types',
      free: 'MCQ, Short-answer',
      premium: 'All types',
    },
    {
      label: 'AI Study Buddy',
      free: false,
      premium: true,
    },
    {
      label: 'Advanced analytics',
      free: false,
      premium: true,
    },
    {
      label: 'Smart notifications',
      free: false,
      premium: true,
    },
    {
      label: 'Social/group features',
      free: false,
      premium: true,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto my-8 bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200">
      <h2 className="text-3xl font-extrabold mb-6 text-center text-gray-900">Compare Plans</h2>
      {/* Table for md+ screens */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-center border-separate border-spacing-y-1">
          <thead>
            <tr>
              <th className="text-lg font-semibold text-gray-700 py-3"></th>
              <th className="text-lg font-bold text-blue-700 py-3">Free</th>
              <th className="text-lg font-bold py-3 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-xl shadow">Premium</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.label} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-slate-800'}>
                <td className="text-left px-4 py-3 font-medium text-gray-800 border-b border-gray-200">{row.label}</td>
                <td className="px-4 py-3 border-b border-gray-200">
                  {typeof row.free === 'boolean' ? (
                    row.free ? (
                      <span className="text-green-600 text-xl" title="Included">✔️</span>
                    ) : (
                      <span className="text-red-400 text-xl" title="Not included">❌</span>
                    )
                  ) : (
                    <span className="text-gray-700">{row.free}</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-gray-200 font-semibold">
                  {typeof row.premium === 'boolean' ? (
                    row.premium ? (
                      <span className="text-green-600 text-xl" title="Included">✔️</span>
                    ) : (
                      <span className="text-red-400 text-xl" title="Not included">❌</span>
                    )
                  ) : (
                    <span className="text-yellow-700 font-bold">{row.premium}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Cards for mobile screens */}
      <div className="md:hidden flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label} className="bg-gray-50 rounded-lg shadow p-4 flex flex-col gap-2 border border-gray-200">
            <div className="font-semibold text-gray-800 text-base mb-1">{row.label}</div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-blue-700">Free:</span>
              <span>
                {typeof row.free === 'boolean' ? (
                  row.free ? (
                    <span className="text-green-600 text-xl" title="Included">✔️</span>
                  ) : (
                    <span className="text-red-400 text-xl" title="Not included">❌</span>
                  )
                ) : (
                  <span className="text-gray-700">{row.free}</span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-yellow-700">Premium:</span>
              <span>
                {typeof row.premium === 'boolean' ? (
                  row.premium ? (
                    <span className="text-green-600 text-xl" title="Included">✔️</span>
                  ) : (
                    <span className="text-red-400 text-xl" title="Not included">❌</span>
                  )
                ) : (
                  <span className="text-yellow-700 font-bold">{row.premium}</span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 