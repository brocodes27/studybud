/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'neo-bg': '#FFFFFF',
        'neo-ink': '#0A192F',
        'neo-accent': '#00D1FF',
        'electric-cyan': '#00D1FF',
        'neo-secondary': '#112240',
        'neo-muted': '#64748B',
        'neo-white': '#FFFFFF',
        'mint-green': '#34D399',
        'bubblegum-pink': '#F472B6',
        'playful-gold': '#FBBF24',
        border: "rgba(10, 25, 47, 0.1)",
        input: "rgba(10, 25, 47, 0.05)",
        ring: "#00D1FF",
        background: "#FFFFFF",
        foreground: "#0A192F",
        primary: {
          DEFAULT: "#00D1FF",
          foreground: "#0A192F",
        },
        secondary: {
          DEFAULT: "#0A192F",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#F472B6",
          foreground: "#FFFFFF",
        },
        warning: {
          400: '#F59E0B',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        }
      },
      fontFamily: {
        sans: ['Bricolage Grotesque', 'Quicksand', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'Quicksand', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'none': '0px',
        'full': '9999px',
        DEFAULT: '24px',
        '4xl': '40px',
        'pill': '9999px',
      },
      borderWidth: {
        'default': '2px',
        '2': '2px',
        '4': '4px',
      },
      boxShadow: {
        'neo-sm': '0 4px 0px 0px rgba(0, 209, 255, 0.2)',
        'neo': '0 8px 0px 0px rgba(0, 209, 255, 0.2)',
        'neo-lg': '0 12px 0px 0px rgba(0, 209, 255, 0.2)',
        'neo-xl': '0 16px 0px 0px rgba(0, 209, 255, 0.2)',
        'float-cyan': '0 16px 32px -8px rgba(0, 209, 255, 0.3)',
        'float-pink': '0 16px 32px -8px rgba(244, 114, 182, 0.3)',
        'float-mint': '0 16px 32px -8px rgba(52, 211, 153, 0.3)',
      },
      animation: {
        'spin-slow': 'spin 10s linear infinite',
        'marquee': 'marquee 25s linear infinite',
        'bounce-snappy': 'bounce 0.5s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};
