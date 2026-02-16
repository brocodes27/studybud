import React, { useEffect, useRef } from 'react';
import SmilesDrawer from 'smiles-drawer';
import { MediaSpec } from '../../lib/lectureSchema';

export const ChemStructure: React.FC<{ media: MediaSpec }> = ({ media }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        if (media.type !== 'chemistry') return;
        const svg = svgRef.current;
        if (!svg) return;

        const drawer = new SmilesDrawer.Drawer({
            width: 360,
            height: 360,
            bondThickness: 2,
            fontSizeLarge: 14,
            fontSizeSmall: 12
        });

        SmilesDrawer.parse(
            media.data.smiles,
            (tree: any) => {
                while (svg.firstChild) svg.removeChild(svg.firstChild);
                drawer.draw(tree, svg, 'light', false);
            },
            () => {
                // ignore parse errors
            }
        );
    }, [media]);

    if (media.type !== 'chemistry') return null;

    return (
        <div className="relative bg-white p-6 rounded-3xl shadow-xl border border-slate-100 flex items-center justify-center">
            <svg ref={svgRef} width={360} height={360} />
            {media.data.label && (
                <div className="absolute bottom-4 text-xs font-semibold text-slate-500">{media.data.label}</div>
            )}
        </div>
    );
};
