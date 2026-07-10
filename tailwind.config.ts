import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warna aksen ekosistem Museum Anatomi (sementara — samakan dgn design system nanti)
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
