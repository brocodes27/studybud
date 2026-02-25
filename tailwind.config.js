/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'neo-bg': '#0F172A',
        'neo-ink': '#F8FAFC',
        'neo-accent': '#00EAFF',
        'electric-blue': '#00EAFF',
        'neo-secondary': '#1E293B',
        'neo-muted': '#94A3B8',
        'neo-white': '#1E293B',
        border: "rgba(255, 255, 255, 0.1)",
        input: "rgba(255, 255, 255, 0.05)",
        ring: "#3680f7",
        background: "#0F172A",
        foreground: "#F8FAFC",
        primary: {
          DEFAULT: "#3680f7",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#1E293B",
          foreground: "#F8FAFC",
        },
        accent: {
          DEFAULT: "#3680f7",
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'none': '0px',
        'full': '9999px',
        DEFAULT: '12px',
      },
      borderWidth: {
        'default': '1px',
        '2': '2px',
        '4': '4px',
      },
      boxShadow: {
        'neo-sm': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'neo': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        'neo-lg': '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        'neo-xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
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
