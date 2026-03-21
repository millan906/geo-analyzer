import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#5B35D5',
          cyan: '#00C8E8',
          lavender: '#EEEAF8',
        },
      },
      keyframes: {
        rowIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'row-in': 'rowIn 0.38s ease forwards',
      },
      boxShadow: {
        card: '0 2px 16px rgba(91,53,213,0.06), 0 1px 3px rgba(91,53,213,0.04)',
        'card-hover': '0 4px 20px rgba(91,53,213,0.12), 0 2px 6px rgba(91,53,213,0.06)',
        cta: '0 4px 14px rgba(91,53,213,0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
