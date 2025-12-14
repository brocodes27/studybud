// Paper Structure Blueprints based on actual CBSE PYQs
// This defines the exact number and type of questions for each subject

export interface QuestionBlueprint {
    type: 'mcq' | 'short' | 'long';
    marks: number;
    count: number;
    notes?: string;
}

export interface PaperBlueprint {
    totalMarks: number;
    structure: QuestionBlueprint[];
}

export const PAPER_BLUEPRINTS: Record<string, PaperBlueprint> = {
    // Class 10
    '10-Mathematics': {
        totalMarks: 80,
        structure: [
            { type: 'mcq', marks: 1, count: 20, notes: 'Include 2 Assertion-Reasoning questions at the end' },
        ]
    },

    '10-Science': {
        totalMarks: 80,
        structure: [
            { type: 'mcq', marks: 1, count: 20, notes: 'Include 2 Assertion-Reasoning questions' },
            { type: 'short', marks: 2, count: 8 },
            { type: 'short', marks: 3, count: 2 },
            { type: 'long', marks: 4, count: 3 },
            { type: 'long', marks: 5, count: 2 },
        ]
    },

    '10-Social': {
        totalMarks: 80,
        structure: [
            { type: 'mcq', marks: 1, count: 20, notes: 'Include 2 Assertion-Reasoning questions' },
            { type: 'short', marks: 3, count: 5 },
            { type: 'long', marks: 5, count: 4 },
            { type: 'long', marks: 6, count: 3 },
        ]
    },

    // Class 12 Science
    '12-Physics': {
        totalMarks: 70,
        structure: [
            { type: 'mcq', marks: 1, count: 16, notes: 'Include 4 Assertion-Reasoning questions (questions 13-16)' },
            { type: 'short', marks: 2, count: 5 },
            { type: 'short', marks: 3, count: 7 },
            { type: 'long', marks: 5, count: 3 },
        ]
    },

    '12-Chemistry': {
        totalMarks: 70,
        structure: [
            { type: 'mcq', marks: 1, count: 16, notes: 'Include 4 Assertion-Reasoning questions (questions 13-16)' },
            { type: 'short', marks: 2, count: 5 },
            { type: 'short', marks: 3, count: 7 },
            { type: 'long', marks: 5, count: 3 },
        ]
    },

    '12-Mathematics': {
        totalMarks: 80,
        structure: [
            { type: 'mcq', marks: 1, count: 20, notes: 'Include 2 Assertion-Reasoning questions' },
            { type: 'short', marks: 2, count: 5 },
            { type: 'short', marks: 3, count: 6 },
            { type: 'long', marks: 5, count: 4 },
        ]
    },

    '12-Biology': {
        totalMarks: 70,
        structure: [
            { type: 'mcq', marks: 1, count: 16, notes: 'Include 4 Assertion-Reasoning questions (questions 13-16)' },
            { type: 'short', marks: 2, count: 5 },
            { type: 'short', marks: 3, count: 7 },
            { type: 'long', marks: 5, count: 3 },
        ]
    },

    // Class 12 Commerce
    '12-Accountancy': {
        totalMarks: 80,
        structure: [
            { type: 'mcq', marks: 1, count: 20 },
            { type: 'short', marks: 3, count: 6 },
            { type: 'short', marks: 4, count: 4 },
            { type: 'long', marks: 6, count: 4 },
        ]
    },

    '12-Business': {
        totalMarks: 80,
        structure: [
            { type: 'mcq', marks: 1, count: 20 },
            { type: 'short', marks: 3, count: 6 },
            { type: 'short', marks: 4, count: 4 },
            { type: 'long', marks: 6, count: 4 },
        ]
    },

    '12-Economics': {
        totalMarks: 80,
        structure: [
            { type: 'mcq', marks: 1, count: 20 },
            { type: 'short', marks: 3, count: 6 },
            { type: 'short', marks: 4, count: 4 },
            { type: 'long', marks: 6, count: 4 },
        ]
    },
};

/**
 * Get the paper blueprint for a given class and subject
 */
export function getPaperBlueprint(classLevel: string, subject: string): PaperBlueprint | null {
    // Normalize subject name (e.g., "English Language & Literature" -> "English")
    const normalizedSubject = subject.split(/[\s\&]/)[0];

    const key = `${classLevel}-${normalizedSubject}`;
    return PAPER_BLUEPRINTS[key] || null;
}

/**
 * Generate a detailed prompt section based on the blueprint
 */
export function generateBlueprintPrompt(blueprint: PaperBlueprint): string {
    const lines: string[] = [
        '\nSTRICT PAPER STRUCTURE (FOLLOW EXACTLY):'
    ];

    let questionNumber = 1;
    blueprint.structure.forEach((item, index) => {
        const typeLabel = item.type === 'mcq' ? 'Multiple Choice Questions (MCQs)' :
            item.marks === 2 ? 'Short Answer Questions (SA-I)' :
                item.marks === 3 ? 'Short Answer Questions (SA-II)' :
                    item.marks === 4 ? 'Long Answer Questions (LA-I)' :
                        item.marks === 5 ? 'Long Answer Questions (LA-II)' :
                            `${item.marks}-mark Questions`;

        lines.push(`\nSection ${String.fromCharCode(65 + index)}: ${typeLabel}`);
        lines.push(`- Generate EXACTLY ${item.count} questions`);
        lines.push(`- Each question carries ${item.marks} mark${item.marks > 1 ? 's' : ''}`);
        lines.push(`- Question numbers: ${questionNumber} to ${questionNumber + item.count - 1}`);

        if (item.type === 'mcq') {
            lines.push(`- Each MCQ must have exactly 4 options (A, B, C, D)`);
        }

        if (item.notes) {
            lines.push(`- Note: ${item.notes}`);
        }

        questionNumber += item.count;
    });

    lines.push(`\nTotal Questions: ${blueprint.structure.reduce((sum, item) => sum + item.count, 0)}`);
    lines.push(`Total Marks: ${blueprint.totalMarks}`);

    return lines.join('\n');
}
