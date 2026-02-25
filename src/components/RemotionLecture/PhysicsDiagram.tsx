import React from 'react';
import { MediaSpec } from '../../lib/lectureSchema';

export const PhysicsDiagram: React.FC<{ media: MediaSpec }> = ({ media }) => {
    if (media.type !== 'diagram') return null;
    const { vectors = [], points = [], axes } = media.data || {};

    const width = 360;
    const height = 360;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="bg-slate-800 rounded-3xl shadow-xl border border-slate-100">
            {/* Axes */}
            {axes?.show && (
                <>
                    <line x1={20} y1={height - 20} x2={width - 20} y2={height - 20} stroke="#0F172A" strokeWidth={2} />
                    <line x1={20} y1={height - 20} x2={20} y2={20} stroke="#0F172A" strokeWidth={2} />
                    {axes?.xLabel && <text x={width - 24} y={height - 28} fontSize={10} textAnchor="end" fill="#64748B">{axes.xLabel}</text>}
                    {axes?.yLabel && <text x={28} y={24} fontSize={10} textAnchor="start" fill="#64748B">{axes.yLabel}</text>}
                </>
            )}

            {/* Points */}
            {points.map((p, i) => (
                <g key={`p-${i}`}>
                    <circle cx={p.x} cy={p.y} r={4} fill="#0F172A" />
                    {p.label && <text x={p.x + 8} y={p.y - 8} fontSize={10} fill="#64748B">{p.label}</text>}
                </g>
            ))}

            {/* Vectors */}
            {vectors.map((v, i) => (
                <g key={`v-${i}`}>
                    <line x1={v.x} y1={v.y} x2={v.x + v.dx} y2={v.y + v.dy} stroke={v.color || '#3B82F6'} strokeWidth={3} />
                    <circle cx={v.x + v.dx} cy={v.y + v.dy} r={4} fill={v.color || '#3B82F6'} />
                    {v.label && <text x={v.x + v.dx + 8} y={v.y + v.dy} fontSize={10} fill={v.color || '#3B82F6'}>{v.label}</text>}
                </g>
            ))}
        </svg>
    );
};
