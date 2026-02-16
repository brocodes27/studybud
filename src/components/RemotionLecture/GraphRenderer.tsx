import React from 'react';
import { MediaSpec } from '../../lib/lectureSchema';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const GraphRenderer: React.FC<{ media: MediaSpec }> = ({ media }) => {
    if (media.type !== 'graph') return null;
    const { x, y, series } = media.data;

    const width = 360;
    const height = 360;
    const padding = 48;
    const plotW = width - padding * 2;
    const plotH = height - padding * 2;

    const xMin = x.min;
    const xMax = x.max;
    const yMin = y.min;
    const yMax = y.max;

    const xDen = xMax - xMin || 1;
    const yDen = yMax - yMin || 1;
    const xScale = (val: number) => padding + ((val - xMin) / xDen) * plotW;
    const yScale = (val: number) => padding + plotH - ((val - yMin) / yDen) * plotH;

    const xTicks = x.ticks ?? 5;
    const yTicks = y.ticks ?? 5;

    const xTickVals = Array.from({ length: xTicks + 1 }, (_, i) => xMin + ((xMax - xMin) * i) / xTicks);
    const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="bg-white rounded-3xl shadow-xl border border-slate-100">
            {/* Grid */}
            {xTickVals.map((v, i) => {
                const xPos = xScale(v);
                return <line key={`xg-${i}`} x1={xPos} y1={padding} x2={xPos} y2={height - padding} stroke="#E5E7EB" strokeWidth={1} />;
            })}
            {yTickVals.map((v, i) => {
                const yPos = yScale(v);
                return <line key={`yg-${i}`} x1={padding} y1={yPos} x2={width - padding} y2={yPos} stroke="#E5E7EB" strokeWidth={1} />;
            })}

            {/* Axes */}
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#0F172A" strokeWidth={2} />
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#0F172A" strokeWidth={2} />

            {/* Ticks + Labels */}
            {xTickVals.map((v, i) => {
                const xPos = xScale(v);
                return (
                    <g key={`xt-${i}`}>
                        <line x1={xPos} y1={height - padding} x2={xPos} y2={height - padding + 6} stroke="#0F172A" />
                        <text x={xPos} y={height - padding + 20} fontSize={10} textAnchor="middle" fill="#64748B">
                            {Number(v.toFixed(2))}
                        </text>
                    </g>
                );
            })}
            {yTickVals.map((v, i) => {
                const yPos = yScale(v);
                return (
                    <g key={`yt-${i}`}>
                        <line x1={padding - 6} y1={yPos} x2={padding} y2={yPos} stroke="#0F172A" />
                        <text x={padding - 10} y={yPos + 3} fontSize={10} textAnchor="end" fill="#64748B">
                            {Number(v.toFixed(2))}
                        </text>
                    </g>
                );
            })}

            {/* Axis Labels */}
            {x.label && (
                <text x={width / 2} y={height - 10} fontSize={12} textAnchor="middle" fill="#0F172A">
                    {x.label}{x.unit ? ` (${x.unit})` : ''}
                </text>
            )}
            {y.label && (
                <text x={16} y={height / 2} fontSize={12} textAnchor="middle" fill="#0F172A" transform={`rotate(-90 16 ${height / 2})`}>
                    {y.label}{y.unit ? ` (${y.unit})` : ''}
                </text>
            )}

            {/* Series */}
            {series.map((s, si) => {
                const color = s.color || ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][si % 4];
                const pathD = s.points
                    .map((p, i) => {
                        const px = clamp(xScale(p.x), padding, width - padding);
                        const py = clamp(yScale(p.y), padding, height - padding);
                        return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
                    })
                    .join(' ');

                return (
                    <g key={`series-${si}`}>
                        <path d={pathD} stroke={color} strokeWidth={3} fill="none" />
                        {s.points.map((p, pi) => (
                            <circle
                                key={`pt-${si}-${pi}`}
                                cx={clamp(xScale(p.x), padding, width - padding)}
                                cy={clamp(yScale(p.y), padding, height - padding)}
                                r={3}
                                fill={color}
                            />
                        ))}
                    </g>
                );
            })}
        </svg>
    );
};
