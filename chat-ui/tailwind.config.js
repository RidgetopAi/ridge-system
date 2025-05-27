export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: {
            DEFAULT: '#8B5CF6', // A vibrant purple
            50: '#F5F3FF',
            100: '#EDE9FE',
            200: '#DDD6FE',
            300: '#C4B5FD',
            400: '#A78BFA',
            500: '#8B5CF6',
            600: '#7C3AED',
            700: '#6D28D9',
            800: '#5B21B6',
            900: '#4C1D95',
            950: '#2F1060',
          },
          secondary: {
            DEFAULT: '#6B7280', // A neutral grey
            50: '#F9FAFB',
            100: '#F3F4F6',
            200: '#E5E7EB',
            300: '#D1D5DB',
            400: '#9CA3AF',
            500: '#6B7280',
            600: '#4B5563',
            700: '#374151',
            800: '#1F2937',
            900: '#111827',
            950: '#030712',
          },
          dark: {
            DEFAULT: '#1A1A1A', // A dark black/grey for backgrounds
            light: '#2C2C2C',
            medium: '#1A1A1A',
            dark: '#0D0D0D',
          },
        },
      },
    },
    plugins: [],
  }