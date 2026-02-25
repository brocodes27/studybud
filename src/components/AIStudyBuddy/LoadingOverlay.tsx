import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    isLoading: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading }) => {
    if (!isLoading) return null;
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
            <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
        </div>
    );
};
