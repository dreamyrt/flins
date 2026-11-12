import { useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { isMac } from '../../services/platform';

export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  // На macOS нічого не рендеримо — там працюють нативні "світлофори" Apple ліворуч!
  if (isMac) return null;

  const handleMinimize = () => {
    invoke('window_minimize').catch(console.error);
  };

  const handleToggleMaximize = () => {
    invoke('window_toggle_maximize').then(() => {
      setIsMaximized(!isMaximized);
    }).catch(console.error);
  };

  const handleClose = () => {
    invoke('window_close').catch(console.error);
  };

  return (
    <div className="flex items-center h-full select-none ml-2 border-l border-cozy-border/60 dark:border-night-border/60 pl-1.5">
      {/* Згорнути */}
      <button
        onClick={handleMinimize}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-cozy-muted hover:text-cozy-text hover:bg-cozy-surface dark:hover:bg-night-card transition-colors cursor-pointer"
        title="Згорнути"
      >
        <Minus size={13} />
      </button>

      {/* Розгорнути / Відновити */}
      <button
        onClick={handleToggleMaximize}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-cozy-muted hover:text-cozy-text hover:bg-cozy-surface dark:hover:bg-night-card transition-colors cursor-pointer"
        title={isMaximized ? "Відновити" : "Розгорнути"}
      >
        {isMaximized ? <Copy size={11} className="rotate-180" /> : <Square size={11} />}
      </button>

      {/* Закрити з червоним підсвічуванням */}
      <button
        onClick={handleClose}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-cozy-muted hover:text-white hover:bg-red-500 transition-colors cursor-pointer"
        title="Закрити"
      >
        <X size={14} />
      </button>
    </div>
  );
}
