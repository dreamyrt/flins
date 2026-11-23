// src/components/common/RecoveryCodeCard.tsx
// Фаза 6.4.2 — екран показу recovery-коду: «лише один раз», Копіювати / Зберегти .txt / Я зберіг.
// Код не зберігається в стані застосунку після закриття — у БД лежить тільки його хеш.
import { useState } from 'react';
import { Copy, Download, CheckCircle2 } from 'lucide-react';
import { Lang, t } from '../../services/i18n';
import { saveRecoveryFile } from '../../services/passwordService';
import { cozySound } from '../../services/sound';

interface RecoveryCodeCardProps {
  code: string;
  lang: Lang;
  onClose: () => void;
}

export default function RecoveryCodeCard({ code, lang, onClose }: RecoveryCodeCardProps) {
  const s = t[lang].recovery;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // фолбек для WebView без дозволу на clipboard API
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* юзер може виділити код вручну — він вибірковий */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    cozySound.playClickChime();
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveFile = async () => {
    const content = `${s.fileHeader}\n${code}\n${s.fileNote}\n`;
    try {
      await saveRecoveryFile(content);
    } catch {
      /* скасований діалог — нічого критичного */
    }
  };

  return (
    <div className="rounded-2xl border border-cozy-accent/40 dark:border-night-accent/40 bg-cozy-bg/50 dark:bg-night-bg/50 p-5 space-y-3 animate-[cozyPopIn_0.4s_ease-out]">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className="text-cozy-accent dark:text-night-accent" />
        <h3 className="text-sm font-serif font-bold text-cozy-text dark:text-night-text">
          {s.title}
        </h3>
      </div>

      <p className="text-xs text-cozy-muted dark:text-night-muted">{s.warning}</p>

      <p
        className="select-text cursor-text rounded-xl border border-dashed border-cozy-accent/50 dark:border-night-accent/50 bg-cozy-card dark:bg-night-card px-3 py-2.5 text-center font-mono text-sm tracking-wider text-cozy-text dark:text-night-text"
        title={s.selectHint}
      >
        {code}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border hover:border-cozy-accent text-xs font-medium transition-colors cursor-pointer"
        >
          <Copy size={12} />
          {copied ? s.copied : s.copy}
        </button>
        <button
          type="button"
          onClick={handleSaveFile}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border hover:border-cozy-accent text-xs font-medium transition-colors cursor-pointer"
        >
          <Download size={12} />
          {s.saveFile}
        </button>
      </div>

      <p className="text-[10px] text-cozy-muted dark:text-night-muted/80 leading-relaxed">{s.note}</p>

      <button
        type="button"
        onClick={() => {
          cozySound.playClickChime();
          onClose();
        }}
        className="w-full rounded-xl bg-cozy-accent dark:bg-night-accent text-white dark:text-night-card py-2 text-sm font-semibold transition-transform duration-200 hover:scale-[1.02]"
      >
        {s.confirmBtn}
      </button>
    </div>
  );
}
