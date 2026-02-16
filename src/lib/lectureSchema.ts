export type GraphAxis = {
    min: number;
    max: number;
    ticks?: number;
    label?: string;
    unit?: string;
};

export type GraphSeries = {
    name?: string;
    color?: string;
    points: { x: number; y: number }[];
};

export type GraphSpec = {
    type: 'graph';
    data: {
        x: GraphAxis;
        y: GraphAxis;
        series: GraphSeries[];
    };
};

export type EquationSpec = {
    type: 'equation';
    data: string; // LaTeX
};

export type ShapeSpec = {
    type: 'shape';
    data: { type: 'circle' | 'rect' };
};

export type ChemistrySpec = {
    type: 'chemistry';
    data: {
        smiles: string;
        label?: string;
    };
};

export type DiagramSpec = {
    type: 'diagram';
    data: {
        vectors?: { x: number; y: number; dx: number; dy: number; label?: string; color?: string }[];
        points?: { x: number; y: number; label?: string }[];
        axes?: { show?: boolean; xLabel?: string; yLabel?: string };
    };
};

export type BiologySpec = {
    type: 'biology';
    data: {
        nodes?: { x: number; y: number; r?: number; label?: string; fill?: string }[];
        connections?: { x1: number; y1: number; x2: number; y2: number }[];
    };
};

export type MediaSpec = GraphSpec | EquationSpec | ShapeSpec | ChemistrySpec | DiagramSpec | BiologySpec;

export type LectureSegmentSchema = {
    title: string;
    content: string[];
    duration: number;
    tts?: string;
    media?: MediaSpec;
};

export type LectureConfigSchema = {
    topic: string;
    subject: string;
    voiceId?: string;
    segments: LectureSegmentSchema[];
};

const isNumber = (v: any) => typeof v === 'number' && Number.isFinite(v);

const validateGraph = (media: any, errors: string[]) => {
    const data = media?.data;
    if (!data?.x || !data?.y) errors.push('graph.data.x/y required');
    if (!isNumber(data?.x?.min) || !isNumber(data?.x?.max)) errors.push('graph.x.min/max must be numbers');
    if (!isNumber(data?.y?.min) || !isNumber(data?.y?.max)) errors.push('graph.y.min/max must be numbers');
    if (!Array.isArray(data?.series) || data.series.length === 0) errors.push('graph.series required');
    data?.series?.forEach((s: any, i: number) => {
        if (!Array.isArray(s?.points) || s.points.length === 0) errors.push(`graph.series[${i}].points required`);
        s?.points?.forEach((p: any, j: number) => {
            if (!isNumber(p?.x) || !isNumber(p?.y)) errors.push(`graph.series[${i}].points[${j}] x/y must be numbers`);
        });
    });
};

const validateMedia = (media: any, errors: string[]) => {
    if (!media?.type) return;
    switch (media.type) {
        case 'graph':
            validateGraph(media, errors);
            break;
        case 'equation':
            if (typeof media.data !== 'string' || media.data.length === 0) errors.push('equation.data must be LaTeX string');
            break;
        case 'shape':
            if (!['circle', 'rect'].includes(media?.data?.type)) errors.push('shape.data.type must be circle|rect');
            break;
        case 'chemistry':
            if (typeof media?.data?.smiles !== 'string' || media.data.smiles.length === 0) errors.push('chemistry.data.smiles required');
            break;
        case 'diagram':
            // no strict checks for now
            break;
        case 'biology':
            // no strict checks for now
            break;
        default:
            errors.push(`unknown media.type: ${media.type}`);
    }
};

export const validateLectureConfig = (cfg: LectureConfigSchema) => {
    const errors: string[] = [];
    if (!cfg?.topic) errors.push('topic required');
    if (!cfg?.subject) errors.push('subject required');
    if (!Array.isArray(cfg?.segments) || cfg.segments.length === 0) errors.push('segments required');

    cfg?.segments?.forEach((seg, i) => {
        if (!seg.title) errors.push(`segments[${i}].title required`);
        if (!Array.isArray(seg.content)) errors.push(`segments[${i}].content must be array`);
        if (!isNumber(seg.duration)) errors.push(`segments[${i}].duration must be number`);
        if (seg.media) validateMedia(seg.media, errors);
    });

    return {
        ok: errors.length === 0,
        errors
    };
};
