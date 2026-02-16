import React from 'react';
import { MediaSpec } from '../../lib/lectureSchema';

export const BioDiagram: React.FC<{ media: MediaSpec }> = ({ media }) => {
    if (media.type !== 'biology') return null;
    const { nodes = [], connections = [] } = media.data || {};

    const width = 360;
    const height = 360;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="bg-white rounded-3xl shadow-xl border border-slate-100">
            {/* Connections */}
            {connections.map((c: any, i: number) => (
                <line key={`c-${i}`} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="#CBD5E1" strokeWidth={2} />
            ))}

            {/* Nodes */}
            {nodes.map((n: any, i: number) => (
                <g key={`n-${i}`}>
                    <circle cx={n.x} cy={n.y} r={n.r || 26} fill={n.fill || '#E2E8F0'} stroke="#0F172A" strokeWidth={2} />
                    {n.label && (
                        <text x={n.x} y={n.y + 4} fontSize={10} textAnchor="middle" fill="#0F172A">
                            {n.label}
                        </text>
                    )}
                </g>
            ))}
        </svg>
    );
};
