// eslint.config.js — «вартовий» для Flins (ESLint 9, flat config)
// Філософія конфігу: ловимо РЕАЛЬНІ помилки (хуки поза компонентами, сліпі uses),
// а не заважаємо існувати ідіомам кодової бази. Для хобі-проєкту тиша > фанатизм.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src-tauri/target', 'src-tauri/gen', 'scripts'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // ← той самий вбивця білих квадратів: useState/useEffect поза компонентом = блок-помилка
      'react-hooks/rules-of-hooks': 'error',
      // deps у useEffect — це питання стилю/гігієни, поки що лише підказка
      'react-hooks/exhaustive-deps': 'warn',

      // Ідіоми проєкту: any використовується svідомо (BlockNote-блоки, JSON з БД)
      '@typescript-eslint/no-explicit-any': 'off',
      // unused-змінні вже ловить tsc при білді; тут лише warn з розумним винятком _-префіксу
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // порожній catch {} — свідомий fallback-патерн (МІ, звук), а не забува
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
