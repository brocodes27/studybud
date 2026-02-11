import React from 'react';
import { Lock, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePayment } from '../hooks/usePayment';

interface FeatureGateProps {
    children: React.ReactNode;
    fallback?: 'blur' | 'lock' | 'hidden';
    featureName?: string;
}

export function FeatureGate({ children, fallback = 'lock', featureName = 'Premium Feature' }: FeatureGateProps) {
    const { isPremium, loading } = useAuth() as any;
    const { initiatePayment } = usePayment();

    if (loading) return null;

    if (isPremium) {
        return <>{children}</>;
    }

    if (fallback === 'hidden') {
        return null;
    }

    if (fallback === 'blur') {
        return (
            <div className="relative overflow-hidden group">
                {/* Blurred Content */}
                <div className="filter blur-sm select-none pointer-events-none opacity-50 transition-all duration-300">
                    {children}
                </div>

                {/* Lock Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/10 backdrop-blur-[2px] p-4">
                    <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000] text-center max-w-sm rotate-1">
                        <div className="bg-neo-secondary border-2 border-black p-3 rounded-none inline-block mb-4 -rotate-12">
                            <Lock className="h-6 w-6 text-black" />
                        </div>
                        <h3 className="text-xl font-black text-black mb-2 uppercase italic tracking-tighter">Unlock {featureName}</h3>
                        <p className="font-bold text-black/60 text-xs mb-6 uppercase tracking-widest leading-tight">
                            NEURAL_ACCESS_DENIED. UPGRADE_PROTOCOL_REQUIRED_FOR_ADVANCED_INSIGHTS.
                        </p>
                        <button
                            onClick={() => initiatePayment()}
                            className="w-full bg-black text-white px-5 py-3 border-2 border-black font-black text-sm uppercase italic tracking-widest hover:bg-neo-accent transition-all shadow-[4px_4px_0px_0px_#FF6B6B] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
                        >
                            <Zap className="h-4 w-4" />
                            AUTHORIZE_UPGRADE
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Default 'lock' state
    return (
        <div className="flex flex-col items-center justify-center p-12 bg-white border-8 border-black text-center min-h-[300px] shadow-[16px_16px_0px_0px_#000] -rotate-1">
            <div className="bg-neo-accent border-4 border-black p-6 rounded-none mb-6 rotate-12 shadow-[6px_6px_0px_0px_#000]">
                <Lock className="h-10 w-10 text-white stroke-[3px]" />
            </div>
            <h3 className="text-3xl font-black text-black mb-4 uppercase italic tracking-tighter">
                {featureName} IS_LOCKED
            </h3>
            <p className="font-bold text-black/40 text-sm mb-10 max-w-md uppercase tracking-[0.1em] leading-relaxed">
                CRITICAL_RESTRICTION: THIS_MODULE_IS_RESERVED_FOR_PREMIUM_OPERATIVES.
                INITIALIZE_SUBSCRIPTION_SEQUENCE_TO_BYPASS_ENCRYPTION.
            </p>
            <button
                onClick={() => initiatePayment()}
                className="px-10 py-5 bg-black text-white font-black border-4 border-black uppercase italic tracking-tighter text-2xl hover:bg-neo-secondary hover:text-black transition-all shadow-[8px_8px_0px_0px_#4D96FF] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center gap-4"
            >
                <Zap className="h-6 w-6" />
                INIT_UPGRADE_SYNC
            </button>
        </div>
    );
}
