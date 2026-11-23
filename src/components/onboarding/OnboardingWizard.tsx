// src/components/onboarding/OnboardingWizard.tsx
// Фаза 6.1 — каркас онбордингу: крок вітання (мова) → тема → звук → фініш.
// Крок профілю/ШІ-сервера (6.2) та пароля (6.3) приєднаються сюди наступними кроками.
import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Monitor, Sun, Moon, Play, ArrowLeft, Sparkles, Cpu, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { Lang, t } from '../../services/i18n';
import { ThemeMode, UserProfile } from '../../settings/SettingsModal';
import { SoundPreset, cozySound } from '../../services/sound';
import { detectLocalServer, ServerStatusResult } from '../../services/ai/aiService';
import { setAppPassword } from '../../services/passwordService';
import RecoveryCodeCard from '../common/RecoveryCodeCard';

interface OnboardingWizardProps {
  lang: Lang;
  themeMode: ThemeMode;
  soundPreset: SoundPreset;
  profile: UserProfile;
  apiUrl: string;
  hasPriorData: boolean;
  onLangChange: (l: Lang) => void;
  onThemeModeChange: (m: ThemeMode) => void;
  onSoundPresetChange: (p: SoundPreset) => void;
  onProfileChange: (p: UserProfile) => void;
  onApiUrlChange: (u: string) => void;
  onDone: (skipped: boolean) => void;
}

const STEP_IDS = ['welcome', 'theme', 'sound', 'profile', 'ai', 'password', 'done'] as const;

const SOUNDS: { id: SoundPreset; label: string }[] = [
  { id: 'kalimba', label: 'Kalimba' },
  { id: 'harp', label: 'Harp' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'zen', label: 'Zen Bell' },
  { id: 'celesta', label: 'Celesta' },
];

export default function OnboardingWizard({
  lang,
  themeMode,
  soundPreset,
  profile,
  apiUrl,
  hasPriorData,
  onLangChange,
  onThemeModeChange,
  onSoundPresetChange,
  onProfileChange,
  onApiUrlChange,
  onDone,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatusResult | null>(null);
  // 6.3.5 — крок пароля: обидва поля порожні = Skip
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwErr, setPwErr] = useState<string | null>(null);
  // 6.4.2 — recovery-код після встановлення пароля (показується один раз на кроці)
  const [issuedRecovery, setIssuedRecovery] = useState<string | null>(null);
  // Плавний вихід з візарда: fade+scale перед розмонтом
  const [leaving, setLeaving] = useState(false);

  const startExit = (skipped: boolean) => {
    setLeaving(true);
    // перемикаємо сцену ледь картка дозвучить (200 мс), інакше видно порожній фон
    window.setTimeout(() => onDone(skipped), 220);
  };
  const s = t[lang].onboarding;
  const isLast = step === STEP_IDS.length - 1;

  // Фон-оверлей тягне вікно (лише якщо клік саме по фоні, не по картці чи кнопці).
  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    getCurrentWindow()
      .startDragging()
      .catch(() => {});
  };

  const goNext = async () => {
    // Поки картку recovery-коду не закрито («Я зберіг») — далі не пускаємо
    if (STEP_IDS[step] === 'password' && issuedRecovery) return;
    // На кроці пароля: валідація + запис; порожні поля = пропуск
    if (STEP_IDS[step] === 'password' && (pw1 || pw2)) {
      if (pw1.length < 4) {
        setPwErr(s.pwShort);
        return;
      }
      if (pw1 !== pw2) {
        setPwErr(s.pwMismatch);
        return;
      }
      try {
        const code = await setAppPassword(pw1);
        setPw1('');
        setPw2('');
        setPwErr(null);
        setIssuedRecovery(code);
        return; // далі не йдемо, доки юзер не підтвердить збереження коду
      } catch (e) {
        setPwErr(String(e));
        return;
      }
    }
    cozySound.playClickChime();
    if (isLast) startExit(false);
    else setStep((v) => Math.min(v + 1, STEP_IDS.length - 1));
  };
  const goBack = () => {
    cozySound.playHoverChime();
    setStep((v) => Math.max(v - 1, 0));
  };

  // 6.2.5 — авто-пошук ШІ-сервера (реюз того ж detectLocalServer, що й у Settings)
  const handleDetect = async () => {
    setIsChecking(true);
    setServerStatus(null);
    try {
      const result = await detectLocalServer(apiUrl);
      setServerStatus(result);
      if (result.ok && result.endpoint) onApiUrlChange(result.endpoint);
      cozySound.playClickChime();
    } finally {
      setIsChecking(false);
    }
  };

  const optionCard =
    'flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-sm cursor-pointer transition-all duration-200 hover:scale-[1.03]';
  const optionIdle =
    'border-cozy-border dark:border-night-border bg-cozy-bg/40 dark:bg-night-bg/40 text-cozy-muted dark:text-night-muted';
  const optionActive =
    'border-cozy-accent dark:border-night-accent ring-2 ring-cozy-accent/40 dark:ring-night-accent/40 bg-cozy-card dark:bg-night-card text-cozy-text dark:text-night-text';

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      className="flex h-screen w-screen overflow-hidden items-center justify-center bg-cozy-bg dark:bg-night-bg text-cozy-text dark:text-night-text"
    >
      {/* Аркуш-картка: розчиняється сама, фон сцени лишається solid (без білого спалаху) */}
      <div
        className={`relative w-full max-w-lg rounded-2xl border border-cozy-border dark:border-night-border bg-cozy-card dark:bg-night-card shadow-lg px-10 pt-12 pb-6 transition-all duration-200 ease-out animate-[cozyPopIn_0.45s_ease-out] ${
          leaving ? 'scale-[0.95] opacity-0 blur-[2px]' : 'scale-100 opacity-100 blur-0'
        }`}
      >
        {/* Washi tape — фірмова стрічка зверху аркуша */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 -rotate-2 h-6 w-28 rounded-sm bg-cozy-accent/25 dark:bg-night-accent/25" />

        {hasPriorData && (
          <button
            onClick={() => {
              cozySound.playClickChime();
              startExit(true);
            }}
            className="absolute top-4 right-5 text-xs text-cozy-muted dark:text-night-muted hover:text-cozy-accent dark:hover:text-night-accent transition-colors"
          >
            {s.skipAll}
          </button>
        )}

        {/* Контент кроку — remount по key дає pop-in анімацію на кожному кроці */}
        <div key={step} className="animate-[cozyPopIn_0.45s_ease-out] min-h-[300px]">
          {STEP_IDS[step] === 'welcome' && (
            <div className="flex flex-col items-center text-center">
              <span className="star-glyph sparkle-wiggle text-[52px] leading-none text-cozy-accent dark:text-night-accent select-none">
                ✦
              </span>
              <h1 className="mt-3 font-serif text-2xl font-bold">{s.welcomeTitle}</h1>
              <p className="mt-2 text-sm text-cozy-muted dark:text-night-muted max-w-sm">
                {s.welcomeText}
              </p>
              <div className="mt-6 text-xs uppercase tracking-wider text-cozy-muted dark:text-night-muted">
                {s.languageLabel}
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-full border border-cozy-border dark:border-night-border p-1">
                {(['uk', 'en'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      cozySound.playClickChime();
                      onLangChange(l);
                    }}
                    className={`px-4 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      lang === l
                        ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-card font-semibold scale-105'
                        : 'text-cozy-muted dark:text-night-muted hover:scale-105'
                    }`}
                  >
                    {l === 'uk' ? 'Українська' : 'English'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {STEP_IDS[step] === 'theme' && (
            <div className="flex flex-col items-center text-center">
              <h2 className="font-serif text-xl font-bold">{s.themeTitle}</h2>
              <p className="mt-1.5 text-sm text-cozy-muted dark:text-night-muted">{s.themeText}</p>
              <div className="mt-6 grid grid-cols-3 gap-3 w-full">
                {(
                  [
                    { id: 'system', icon: Monitor, label: s.themeSystem },
                    { id: 'light', icon: Sun, label: t[lang].themeLight },
                    { id: 'dark', icon: Moon, label: t[lang].themeDark },
                  ] as const
                ).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => {
                      cozySound.playClickChime();
                      onThemeModeChange(id);
                    }}
                    className={`${optionCard} ${themeMode === id ? optionActive : optionIdle}`}
                  >
                    <Icon className="w-6 h-6" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {STEP_IDS[step] === 'sound' && (
            <div className="flex flex-col items-center">
              <h2 className="font-serif text-xl font-bold text-center">{s.soundTitle}</h2>
              <p className="mt-1.5 text-sm text-cozy-muted dark:text-night-muted text-center">
                {s.soundText}
              </p>
              <div className="mt-5 space-y-2 w-full">
                {[...SOUNDS, { id: 'silent' as SoundPreset, label: s.soundSilent }].map(
                  ({ id, label }) => (
                    <div
                      key={id}
                      onClick={() => {
                        cozySound.previewPreset(id);
                        onSoundPresetChange(id);
                      }}
                      className={`flex items-center justify-between rounded-xl border px-4 py-2.5 cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
                        soundPreset === id ? optionActive : optionIdle
                      }`}
                    >
                      <span className="text-sm">{label}</span>
                      <span className="flex items-center gap-2">
                        {id !== 'silent' && (
                          <Play
                            className="w-4 h-4 opacity-70"
                            onClick={(e) => {
                              e.stopPropagation();
                              cozySound.previewPreset(id);
                            }}
                          />
                        )}
                        <Sparkles
                          className={`w-4 h-4 transition-opacity ${
                            soundPreset === id ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {STEP_IDS[step] === 'profile' && (
            <div className="flex flex-col items-center text-center">
              <h2 className="font-serif text-xl font-bold">{s.profileTitle}</h2>
              <p className="mt-1.5 text-sm text-cozy-muted dark:text-night-muted">{s.profileText}</p>
              <input
                type="text"
                value={profile.nickname}
                maxLength={32}
                placeholder={s.profilePlaceholder}
                onChange={(e) => onProfileChange({ ...profile, nickname: e.target.value })}
                className="mt-6 w-full max-w-xs rounded-xl border border-cozy-border dark:border-night-border bg-cozy-bg/40 dark:bg-night-bg/40 px-4 py-2.5 text-center text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-cozy-accent/50 dark:focus:ring-night-accent/50"
              />
            </div>
          )}

          {STEP_IDS[step] === 'ai' && (
            <div className="flex flex-col items-center text-center">
              <Cpu className="w-8 h-8 text-cozy-accent dark:text-night-accent" />
              <h2 className="mt-2 font-serif text-xl font-bold">{s.aiTitle}</h2>
              <p className="mt-1.5 text-sm text-cozy-muted dark:text-night-muted max-w-sm">{s.aiText}</p>
              <div className="mt-5 flex items-center gap-2 w-full max-w-md">
                <input
                  type="text"
                  value={apiUrl}
                  placeholder="http://localhost:1234/v1"
                  onChange={(e) => onApiUrlChange(e.target.value)}
                  className="flex-1 rounded-xl border border-cozy-border dark:border-night-border bg-cozy-bg/40 dark:bg-night-bg/40 px-3 py-2 text-xs outline-none transition-all duration-200 focus:ring-2 focus:ring-cozy-accent/50 dark:focus:ring-night-accent/50"
                />
                <button
                  onClick={handleDetect}
                  disabled={isChecking}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium bg-cozy-accent text-white dark:bg-night-accent dark:text-night-card transition-transform duration-200 hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
                >
                  <Search className="w-3.5 h-3.5" />
                  {isChecking ? s.aiChecking : s.aiDetect}
                </button>
              </div>
              {serverStatus && (
                <div
                  className={`mt-4 flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-all duration-300 ${
                    serverStatus.ok
                      ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}
                >
                  {serverStatus.ok ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {s.aiFound.replace('{model}', serverStatus.activeModel || serverStatus.type || '')}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>{serverStatus.errorMessage || s.aiNotFound}</span>
                    </>
                  )}
                </div>
              )}
              <p className="mt-3 text-[11px] text-cozy-muted dark:text-night-muted max-w-xs">
                {s.aiSkipHint}
              </p>
            </div>
          )}

          {STEP_IDS[step] === 'password' && (
            <div className="flex flex-col items-center text-center">
              {issuedRecovery ? (
                <div className="w-full">
                  <RecoveryCodeCard
                    code={issuedRecovery}
                    lang={lang}
                    onClose={() => {
                      // «Я зберіг» → ховаємо картку й ОДРАЗУ йдемо на наступний крок (без циклу)
                      setIssuedRecovery(null);
                      setStep((v) => Math.min(v + 1, STEP_IDS.length - 1));
                    }}
                  />
                </div>
              ) : (
                <>
              <h2 className="font-serif text-xl font-bold">{s.pwTitle}</h2>
              <p className="mt-1.5 text-sm text-cozy-muted dark:text-night-muted max-w-sm">{s.pwText}</p>
              <div className="mt-5 space-y-2 w-full max-w-xs">
                <input
                  type="password"
                  value={pw1}
                  placeholder={s.pwNew}
                  onChange={(e) => {
                    setPw1(e.target.value);
                    setPwErr(null);
                  }}
                  className="w-full rounded-xl border border-cozy-border dark:border-night-border bg-cozy-bg/40 dark:bg-night-bg/40 px-4 py-2.5 text-center text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-cozy-accent/50 dark:focus:ring-night-accent/50"
                />
                <input
                  type="password"
                  value={pw2}
                  placeholder={s.pwConfirm}
                  onChange={(e) => {
                    setPw2(e.target.value);
                    setPwErr(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') goNext();
                  }}
                  className="w-full rounded-xl border border-cozy-border dark:border-night-border bg-cozy-bg/40 dark:bg-night-bg/40 px-4 py-2.5 text-center text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-cozy-accent/50 dark:focus:ring-night-accent/50"
                />
                <div className="h-4">
                  {pwErr && (
                    <p className="text-[11px] text-red-500 dark:text-red-400 animate-[cozyPopIn_0.3s_ease-out]">
                      {pwErr}
                    </p>
                  )}
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {STEP_IDS[step] === 'done' && (
            <div className="flex flex-col items-center text-center">
              <span className="star-glyph text-[52px] leading-none text-cozy-accent dark:text-night-accent select-none">
                ✦
              </span>
              <h2 className="mt-3 font-serif text-2xl font-bold">{s.doneTitle}</h2>
              <p className="mt-2 text-sm text-cozy-muted dark:text-night-muted max-w-sm">
                {s.doneText}
              </p>
            </div>
          )}
        </div>

        {/* Футер: прогрес-крапки + навігація */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STEP_IDS.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-6 bg-cozy-accent dark:bg-night-accent'
                    : i < step
                      ? 'w-2 bg-cozy-accent/50 dark:bg-night-accent/50'
                      : 'w-2 bg-cozy-border dark:bg-night-border'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && !isLast && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-cozy-muted dark:text-night-muted hover:text-cozy-text dark:hover:text-night-text transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {s.back}
              </button>
            )}
            <button
              onClick={goNext}
              className="rounded-xl bg-cozy-accent dark:bg-night-accent text-white dark:text-night-card px-5 py-2 text-sm font-semibold transition-transform duration-200 hover:scale-105"
            >
              {isLast ? s.enter : s.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
