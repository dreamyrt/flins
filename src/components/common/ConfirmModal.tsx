import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Видалити',
  cancelText = 'Скасувати',
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  // Закриття на Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose} // Закриття при кліку на фон поза вікном
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()} // Запобігаємо закриттю при кліку всередині картки
        className="w-full max-w-sm bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-2xl p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle size={18} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-cozy-text dark:text-night-text">
              {title}
            </h3>
            <p className="text-xs text-cozy-muted leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-cozy-border/60 dark:border-night-border/60">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-cozy-card dark:bg-night-card hover:bg-cozy-border border border-cozy-border dark:border-night-border text-cozy-text dark:text-night-text transition-colors"
          >
            {cancelText} <span className="opacity-50 text-[10px] ml-1">(Esc)</span>
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-xs transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
