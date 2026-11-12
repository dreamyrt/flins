/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Світла тема: Теплий льон (Beige Linen)
        cozy: {
          bg: '#FAF7F2',        // Основний фон (теплий пергамент)
          surface: '#F4EFEB',   // Сайдбар, панелі меню
          card: '#FFFFFF',      // Аркуш запису щоденника
          border: '#E8E1D7',    // М'які спокійні лінії
          text: '#3C3836',      // Теплий темний еспресо замість чорного
          muted: '#8C827A',     // Другорядний текст, підказки
          accent: '#C87D55',    // Затишна тепла теракота
        },
        // Темна тема: Пастельна ніч (Pastel Night)
        night: {
          bg: '#181920',        // Глибокий нічний серпанок
          surface: '#20222C',   // Сайдбар
          card: '#272A37',      // Темний пастельний аркуш
          border: '#323646',    // Делікатні межі
          text: '#E2E4E9',      // М'який білий
          muted: '#8B90A0',     // Лавандово-сірий
          accent: '#A78BFA',    // Пастельний бузковий
        }
      },
      fontFamily: {
        serif: ['New York', 'Georgia', 'serif'],
        sans: ['SF Pro Text', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
