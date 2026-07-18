import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Anatomy Museum ecosystem accent color (temporary — align with the design system later)
        brand: {
          DEFAULT: '#0f6e56',
          light: '#1d9e75',
        },
      },
    },
  },
  plugins: [],
};

export default config;
