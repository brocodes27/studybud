// Dark mode color palette matching web app
export const Colors = {
    dark: {
        background: '#0a0a0f',
        backgroundSecondary: '#1a1a2e',
        surface: '#16162a',
        primary: '#00f3ff', // neon cyan
        secondary: '#ff00ff', // neon purple
        accent: '#39ff14', // neon green
        text: '#ffffff',
        textSecondary: '#9ca3af',
        border: 'rgba(255, 255, 255, 0.1)',
        error: '#ef4444',
        success: '#10b981',
    },
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const Typography = {
    sizes: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 24,
        xxl: 32,
    },
    weights: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
    },
};
