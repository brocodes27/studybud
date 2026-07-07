import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = 'text-[#8B7355]', size = 40 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} transition-transform duration-300 hover:scale-105`}
      style={{ overflow: 'visible' }}
    >
      <style>{`
        @keyframes nodePulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
            filter: drop-shadow(0 0 2px currentColor);
          }
          50% {
            transform: scale(1.35);
            opacity: 0.85;
            filter: drop-shadow(0 0 6px currentColor);
          }
        }
        
        .logo-node {
          transform-origin: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        svg:hover .logo-node {
          animation: nodePulse 1.8s ease-in-out infinite;
        }

        svg:hover .logo-node-1 { animation-delay: 0s; }
        svg:hover .logo-node-2 { animation-delay: 0.3s; }
        svg:hover .logo-node-3 { animation-delay: 0.6s; }
        svg:hover .logo-node-4 { animation-delay: 0.9s; }
        
        .logo-stroke {
          transition: stroke-width 0.3s ease, stroke 0.3s ease;
        }
        
        svg:hover .logo-stroke {
          stroke-width: 3px;
        }
      `}</style>

      {/* Left Pillar (representing the first '1' in '11') */}
      <path
        d="M12 12V28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="logo-stroke logo-pillar-1"
      />
      
      {/* Right Pillar + F Branches (representing the second '1' and letter 'F') */}
      <path
        d="M20 12V28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="logo-stroke logo-pillar-2"
      />
      <path
        d="M20 16H28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="logo-stroke logo-branch-1"
      />
      <path
        d="M20 22H26"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="logo-stroke logo-branch-2"
      />
      
      {/* Neural Nodes (at the vertices) */}
      <circle
        cx="12"
        cy="12"
        r="2.2"
        fill="currentColor"
        className="logo-node logo-node-1"
        style={{ transformOrigin: '12px 12px' }}
      />
      <circle
        cx="20"
        cy="12"
        r="2.2"
        fill="currentColor"
        className="logo-node logo-node-2"
        style={{ transformOrigin: '20px 12px' }}
      />
      <circle
        cx="28"
        cy="16"
        r="1.8"
        fill="currentColor"
        className="logo-node logo-node-3"
        style={{ transformOrigin: '28px 16px' }}
      />
      <circle
        cx="26"
        cy="22"
        r="1.8"
        fill="currentColor"
        className="logo-node logo-node-4"
        style={{ transformOrigin: '26px 22px' }}
      />
    </svg>
  );
};
