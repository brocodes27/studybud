/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'neo-bg': '#FFFDF5',
        'neo-ink': '#000000',
        'neo-accent': '#FF6B6B',
        'neo-secondary': '#FFD93D',
        'neo-muted': '#C4B5FD',
        'neo-white': '#FFFFFF',
        border: "#000000",
        input: "#000000",
        ring: "#000000",
        background: "#FFFDF5",
        foreground: "#000000",
        primary: {
          DEFAULT: "#FF6B6B",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#FFD93D",
          foreground: "#000000",
        },
        accent: {
          DEFAULT: "#C4B5FD",
          foreground: "#000000",
        },
        warning: {
          400: '#FFD93D',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'none': '0px',
        'full': '9999px',
      },
      borderWidth: {
        'default': '4px',
        '2': '2px',
        '4': '4px',
        '8': '8px',
      },
      boxShadow: {
        'neo-sm': '4px 4px 0px 0px #000',
        'neo': '8px 8px 0px 0px #000',
        'neo-lg': '12px 12px 0px 0px #000',
        'neo-xl': '16px 16px 0px 0px #000',
        'neo-active': '2px 2px 0px 0px #000',
      },
      animation: {
        'spin-slow': 'spin 10s linear infinite',
        'marquee': 'marquee 25s linear infinite',
        'bounce-snappy': 'bounce 0.5s ease-out',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        }
      }
    },
  },
  plugins: [],
};
