/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#FBFAF6',
          100: '#F5F2EA',
          200: '#EAE6DC',
          300: '#EDE8DC',
          400: '#F1EEE6',
          500: '#E7E2D6',
          600: '#D8D3C4',
          700: '#C7C2B4',
          800: '#B0AA9B',
          900: '#9C978A',
        },
        ink: {
          900: '#2C2A26',
          800: '#3D3A34',
          700: '#4A453D',
          600: '#6B675E',
          500: '#7A756A',
          400: '#8A8578',
          300: '#ADA89A',
          200: '#B0AA9B',
        },
        terracotta: {
          DEFAULT: '#8A6352',
          light: '#E7D9C9',
          tint: '#F3E9E3',
          dark: '#6E4D3E',
        },
        sage: {
          DEFAULT: '#6B7E5C',
          light: '#EDF0E6',
          dark: '#4A5540',
          muted: '#8FA383',
        },
        lavender: {
          DEFAULT: '#7A5FA0',
          light: '#E3D9EE',
          tint: '#F0EBF7',
        },
        ochre: {
          DEFAULT: '#C9A05C',
          light: '#F8F1E2',
        },
        slateSubtle: {
          DEFAULT: '#8A93B0',
          light: '#E6EBF5',
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 8px 24px rgba(0, 0, 0, 0.08)',
        'modal': '0 12px 32px rgba(44, 42, 38, 0.16)',
        'float': '0 4px 16px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
