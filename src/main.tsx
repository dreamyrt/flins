// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Локальні автономні шрифти (працюють 100% офлайн на Windows та macOS)
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';

import '@fontsource/lora/400.css';
import '@fontsource/lora/500.css';
import '@fontsource/lora/600.css';
import '@fontsource/lora/400-italic.css';

import '@fontsource/caveat/500.css';
import '@fontsource/caveat/600.css';

import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
