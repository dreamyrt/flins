// src/components/common/LockScreen.tsx
// Фаза 6.3.3 — екран блокування: показується при старті, якщо встановлено пароль.
// Контент БД до розблокування не рендериться.
import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Lock, KeyRound, ArrowLeft } from 'lucide-react';
import { Lang, t } from '../../services/i18n';
import {
  unlockApp, resetPasswordWithRecovery, recoveryCodeExists,
} from '../../services/passwordService';
import RecoveryCodeCard from './RecoveryCodeCard';
import { cozySound } from '../../services/sound';

interface LockScreenProps {
  lang: Lang;
  onUnlocked: () => void;
}

export default function LockScreen({ lang, onUnlocked }: LockScreenProps) {
  const s = t[lang].lock;
  const r = t[lang].recovery;
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  // 6.4.3 — flow відновлення: null = вхід, 'forgot' = введення коду, 'saved' = показ нового коду
  const [mode, setMode] = useState<'unlock' | 'forgot' | 'saved'>('unlock');
  const [hasRecovery, setHasRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  // Плавний вихід: fade+scale перед тим, як App зніме LockScreen
  const [leaving, setLeaving] = useState(false);

  const exit = () => {
    setLeaving(true);
    window.setTimeout(onUnlocked, 220);
  };

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    getCurrentWindow()
      .startDragging()
      .catch(() => {});
  };

  // Чи є recovery-код (для старих паролів без коду посилання ховаємо чесно)
  useEffect(() => {
    recoveryCodeExists().then(setHasRecovery);
  }, []);

  const goForgot = () => {
    cozySound.playHoverChime();
    setMode('forgot');
    setError(false);
  };

  const handleRecover = async () => {
    if (busy) return;
    if (newPw !== newPw2 || newPw.trim().length < 4) {
      setError(true);
      return;
    }
    setBusy(true);
    try {
      const issued = await resetPasswordWithRecovery(code, newPw);
      if (issued) {
        setIssuedCode(issued);
        setMode('saved');
        setError(false);
        cozySound.playClickChime();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const tryUnlock = async () => {
    if (!value || busy) return;
    setBusy(true);
    try {
      const ok = await unlockApp(value);
      if (ok) {
        setValue('');
        setError(false);
        cozySound.playClickChime();
        exit();
      } else {
        setValue('');
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-cozy-border dark:border-night-border bg-cozy-bg/40 dark:bg-night-bg/40 px-4 py-2.5 text-center text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-cozy-accent/50 dark:focus:ring-night-accent/50';

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      className="flex h-screen w-screen overflow-hidden items-center justify-center bg-cozy-bg dark:bg-night-bg text-cozy-text dark:text-night-text"
    >
      {/* Аркуш: з'їжджає cozyPopIn, з'їжджає назад — розчин (лише картка, фон solid) */}
      <div
        className={`relative w-full max-w-sm rounded-2xl border border-cozy-border dark:border-night-border bg-cozy-card dark:bg-night-card shadow-lg px-8 pt-10 pb-8 transition-all duration-200 ease-out ${
          leaving
            ? 'scale-[0.95] opacity-0 blur-[2px]'
            : 'scale-100 opacity-100 blur-0 animate-[cozyPopIn_0.5s_ease-out]'
        }`}
      >
        {/* Washi tape */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 -rotate-2 h-6 w-24 rounded-sm bg-cozy-accent/25 dark:bg-night-accent/25" />

        <div className="flex flex-col items-center text-center">
          <span className="star-glyph text-[40px] leading-none text-cozy-accent dark:text-night-accent select-none">
            ✦
          </span>

          {mode === 'saved' ? (
            <div className="w-full">
              <h1 className="font-serif text-lg font-bold">{r.title}</h1>
              <div className="mt-4">
                <RecoveryCodeCard code={issuedCode} lang={lang} onClose={exit} />
              </div>
            </div>
          ) : mode === 'forgot' ? (
            <div className="w-full space-y-2">
              <h1 className="font-serif text-lg font-bold flex items-center justify-center gap-2">
                <KeyRound size={15} className="text-cozy-accent dark:text-night-accent" />
                {s.forgot}
              </h1>
              <p className="text-xs text-cozy-muted dark:text-night-muted">{r.warning}</p>
              <input
                autoFocus
                value={code}
                placeholder={s.codePlaceholder}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(false);
                }}
                className={`${inputCls} font-mono text-xs tracking-wider`}
              />
              <input
                type="password"
                value={newPw}
                placeholder={t[lang].security.newPw}
                onChange={(e) => {
                  setNewPw(e.target.value);
                  setError(false);
                }}
                className={inputCls}
              />
              <input
                type="password"
                value={newPw2}
                placeholder={t[lang].security.confirm}
                onChange={(e) => {
                  setNewPw2(e.target.value);
                  setError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRecover();
                }}
                className={inputCls}
              />
              <div className="h-5">
                {error && (
                  <p className="text-[11px] text-red-500 dark:text-red-400 animate-[cozyPopIn_0.3s_ease-out]">
                    {newPw !== newPw2 || newPw.trim().length < 4
                      ? t[lang].security.mismatch
                      : s.codeWrong}
                  </p>
                )}
              </div>
              <button
                onClick={handleRecover}
                disabled={!code || !newPw || !newPw2 || busy}
                className="w-full rounded-xl bg-cozy-accent dark:bg-night-accent text-white dark:text-night-card py-2 text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {busy ? s.checking : s.resetBtn}
              </button>
              <button
                onClick={() => {
                  setMode('unlock');
                  setError(false);
                  setCode('');
                  setNewPw('');
                  setNewPw2('');
                }}
                className="mx-auto flex items-center gap-1 text-[11px] text-cozy-muted dark:text-night-muted hover:text-cozy-accent dark:hover:text-night-accent transition-colors"
              >
                <ArrowLeft size={12} />
                {s.backToUnlock}
              </button>
            </div>
          ) : (
            <>
              <h1 className="mt-2 font-serif text-lg font-bold flex items-center gap-2">
                <Lock size={15} className="text-cozy-accent dark:text-night-accent" />
                {s.title}
              </h1>
              <p className="mt-1.5 text-xs text-cozy-muted dark:text-night-muted max-w-[240px]">
                {s.hint}
              </p>

              <input
                type="password"
                autoFocus
                value={value}
                placeholder={s.inputPlaceholder}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') tryUnlock();
                }}
                className={`mt-5 ${inputCls} ${
                  error ? '!border-red-400 dark:!border-red-500' : ''
                }`}
              />

              <div className="h-5 mt-2">
                {error && (
                  <p className="text-[11px] text-red-500 dark:text-red-400 animate-[cozyPopIn_0.3s_ease-out]">
                    {s.wrong}
                  </p>
                )}
              </div>

              <button
                onClick={tryUnlock}
                disabled={!value || busy}
                className="mt-1 rounded-xl bg-cozy-accent dark:bg-night-accent text-white dark:text-night-card px-6 py-2 text-sm font-semibold transition-transform duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                {busy ? s.checking : s.unlockBtn}
              </button>

              {hasRecovery && (
                <button
                  onClick={goForgot}
                  className="mt-4 text-[11px] text-cozy-muted dark:text-night-muted hover:text-cozy-accent dark:hover:text-night-accent transition-colors underline underline-offset-2"
                >
                  {s.forgot}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
