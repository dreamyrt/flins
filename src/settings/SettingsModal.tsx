// src/settings/SettingsModal.tsx
import { useState, useEffect } from 'react';
import {
  X, Globe, Maximize2, Cpu, User, Sliders, ZoomIn,
  RotateCcw, Monitor, Sun, Moon, Info, Volume2, FolderOpen, HelpCircle,
  CheckCircle2, AlertCircle, RefreshCw, AlertTriangle,
  Download
} from 'lucide-react';
import {
  checkForUpdate, installUpdate, openReleasesPage, softRelaunch, supportsInAppUpdate,
} from '../services/updateService';
import { invoke } from '@tauri-apps/api/core';
import { Lang, t } from '../services/i18n';
import { SoundPreset, cozySound } from '../services/sound';
import { VaultConfig } from '../services/dbService';
import { detectLocalServer, ServerStatusResult, classifyNetworkType } from '../services/ai/aiService';
import AiHelpModal from '../services/ai/AiHelpModal';
import { isMac } from '../services/platform';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface UserProfile {
  nickname: string;
  emoji: string;
  avatarBg: string;
}

export interface AestheticsConfig {
  showWashiTape: boolean;
  showDateHeader: boolean;
  showWeather: boolean;
  showMood: boolean;
  showRating: boolean;
  showTimeButton: boolean;
  showDailyPrompt: boolean;
  showLibrarianRemark: boolean;
  ratingSymbol?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  isWide: boolean;
  onToggleWide: (wide: boolean) => void;
  apiUrl: string;
  onApiUrlChange: (url: string) => void;
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  aesthetics: AestheticsConfig;
  onAestheticsChange: (aesthetics: AestheticsConfig) => void;
  uiScale: number;
  onUiScaleChange: (scale: number) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  soundPreset: SoundPreset;
  onSoundPresetChange: (preset: SoundPreset) => void;
  vaultConfig: VaultConfig;
  onVaultConfigChange: (config: VaultConfig) => void;
  aiEnabled: boolean;
  onAiEnabledChange: (enabled: boolean) => void;
  autoUpdate: boolean;
  onAutoUpdateChange: (enabled: boolean) => void;
}

const EMOJI_OPTIONS = ['☕', '🌿', '🦉', '✨', '🌙', '🎨', '🪐', '🦊', '🌊', '📖', '🕯️', '🥨'];
const BG_COLOR_OPTIONS = ['#C87D55', '#A78BFA', '#84A98C', '#E09F3E', '#5B8E7D', '#9D8189', '#6B705C'];

export default function SettingsModal({
  isOpen,
  onClose,
  lang,
  onLangChange,
  isWide,
  onToggleWide,
  apiUrl,
  onApiUrlChange,
  profile,
  onProfileChange,
  aesthetics,
  onAestheticsChange,
  uiScale,
  onUiScaleChange,
  themeMode,
  onThemeModeChange,
  soundPreset,
  onSoundPresetChange,
  vaultConfig,
  onVaultConfigChange,
  aiEnabled,
  onAiEnabledChange,
  autoUpdate,
  onAutoUpdateChange,
}: SettingsModalProps) {
  // Стан розгортання підказки про приватність сховища (має бути ВСЕРЕДИНІ компонента!)
  const [showVaultSecurity, setShowVaultSecurity] = useState(false);
  const [isAiHelpOpen, setIsAiHelpOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimated, setIsAnimated] = useState(false);

  // Стан перевірки сервера
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatusResult | null>(null);

  // Стан оновлень: idle → checking → latest/available/unreachable → installing
  const [updState, setUpdState] = useState<{
    phase: 'idle' | 'checking' | 'latest' | 'available' | 'unreachable' | 'installing';
    version?: string;
    pct?: number;
  }>({ phase: 'idle' });

  const handleCheckUpdate = async () => {
    setUpdState({ phase: 'checking' });
    const r = await checkForUpdate();
    if (r.status === 'up-to-date') setUpdState({ phase: 'latest' });
    else if (r.status === 'available') setUpdState({ phase: 'available', version: r.version });
    else setUpdState({ phase: 'unreachable' });
  };

  const handleInstallUpdate = async () => {
    // План Б (macOS без Developer ID): відкриваємо Releases у браузері
    if (!supportsInAppUpdate) {
      try { await openReleasesPage(); } catch (err) { console.error(err); }
      return;
    }
    setUpdState((s) => ({ ...s, phase: 'installing', pct: 0 }));
    try {
      await installUpdate(({ downloaded, total }) =>
        setUpdState((s) => ({
          ...s,
          pct: total ? Math.min(99, Math.round((downloaded / total) * 100)) : s.pct,
        })),
      );
      await softRelaunch();
    } catch (err) {
      console.error('Update install failed:', err);
      setUpdState((s) => ({ ...s, phase: 'available' }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsAnimated(true), 25);
      handleCheckServer();
      return () => clearTimeout(timer);
    } else {
      setIsAnimated(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCheckServer = async () => {
    setIsCheckingServer(true);
    try {
      const result = await detectLocalServer(apiUrl);
      setServerStatus(result);
      if (result.ok && result.endpoint) {
        onApiUrlChange(result.endpoint);
      }
    } finally {
      setIsCheckingServer(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAiHelpOpen) {
          setIsAiHelpOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAiHelpOpen, onClose]);

  if (!shouldRender) return null;
  const strings = t[lang];

  const toggleAesthetic = (key: keyof AestheticsConfig) => {
    onAestheticsChange({ ...aesthetics, [key]: !aesthetics[key] });
  };

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 select-none transition-opacity duration-200 ${
        isAnimated ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[530px] bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4 transition-all duration-200 transform ${
          isAnimated ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-cozy-border/60 dark:border-night-border/60">
          <h2 className="text-lg font-serif font-bold text-cozy-text dark:text-night-text">
            {strings.settingsTitle}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-cozy-muted hover:text-cozy-text dark:hover:text-night-text cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* 1. ПРОФІЛЬ АВТОРА */}
          <div className="space-y-3.5 p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60">
            <div className="flex items-center gap-2">
              <User size={16} className="text-cozy-accent dark:text-night-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
                {strings.profile}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div
                style={{ backgroundColor: profile.avatarBg }}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-xs transition-colors flex-shrink-0"
              >
                {profile.emoji}
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[11px] text-cozy-muted block">
                  {strings.yourNickname}
                </label>
                <input
                  type="text"
                  value={profile.nickname}
                  onChange={(e) => onProfileChange({ ...profile, nickname: e.target.value })}
                  className="w-full text-xs font-medium bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-lg px-2.5 py-1.5 focus:outline-none"
                  placeholder="dreamyr"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-cozy-muted block">
                {strings.chooseEmoji}
              </span>
              <div className="flex items-center justify-between gap-1 w-full">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onProfileChange({ ...profile, emoji })}
                    className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-transform hover:scale-110 flex-shrink-0 cursor-pointer ${
                      profile.emoji === emoji
                        ? 'ring-2 ring-cozy-accent dark:ring-night-accent bg-cozy-surface dark:bg-night-surface shadow-xs'
                        : 'hover:bg-cozy-surface dark:hover:bg-night-surface'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-cozy-muted block">
                {strings.avatarColor}
              </span>
              <div className="flex items-center gap-2.5">
                {BG_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onProfileChange({ ...profile, avatarBg: color })}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full transition-transform hover:scale-110 cursor-pointer ${
                      profile.avatarBg === color ? 'ring-2 ring-offset-2 ring-cozy-text dark:ring-night-text' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 2. ТЕМА */}
          <div className="p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60 space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
              {strings.themeTitle}
            </span>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => onThemeModeChange('system')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  themeMode === 'system'
                    ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg border-transparent shadow-xs'
                    : 'border-cozy-border dark:border-night-border text-cozy-muted hover:text-cozy-text'
                }`}
              >
                <Monitor size={14} />
                <span>{strings.themeAuto}</span>
              </button>

              <button
                onClick={() => onThemeModeChange('light')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  themeMode === 'light'
                    ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg border-transparent shadow-xs'
                    : 'border-cozy-border dark:border-night-border text-cozy-muted hover:text-cozy-text'
                }`}
              >
                <Sun size={14} />
                <span>{strings.themeLight}</span>
              </button>

              <button
                onClick={() => onThemeModeChange('dark')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg border-transparent shadow-xs'
                    : 'border-cozy-border dark:border-night-border text-cozy-muted hover:text-cozy-text'
                }`}
              >
                <Moon size={14} />
                <span>{strings.themeDark}</span>
              </button>
            </div>
          </div>

          {/* 3. КАСТОМІЗАЦІЯ ЩОДЕННИКА */}
          <div className="p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60 space-y-3">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-cozy-accent dark:text-night-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
                {strings.aestheticsTitle}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer hover:text-cozy-accent">
                <input
                  type="checkbox"
                  checked={aesthetics.showWashiTape}
                  onChange={() => toggleAesthetic('showWashiTape')}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span>{strings.washiTape}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-cozy-accent">
                <input
                  type="checkbox"
                  checked={aesthetics.showDateHeader}
                  onChange={() => toggleAesthetic('showDateHeader')}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span>{strings.dateStamp}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-cozy-accent">
                <input
                  type="checkbox"
                  checked={aesthetics.showWeather}
                  onChange={() => toggleAesthetic('showWeather')}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span>{strings.weatherStickers}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-cozy-accent">
                <input
                  type="checkbox"
                  checked={aesthetics.showMood}
                  onChange={() => toggleAesthetic('showMood')}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span>{strings.moodSticker}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-cozy-accent">
                <input
                  type="checkbox"
                  checked={aesthetics.showRating}
                  onChange={() => toggleAesthetic('showRating')}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span>{strings.dayRating}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-cozy-accent">
                <input
                  type="checkbox"
                  checked={aesthetics.showTimeButton}
                  onChange={() => toggleAesthetic('showTimeButton')}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span>{strings.timeButton}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-cozy-accent col-span-2 pt-1 border-t border-cozy-border/40 dark:border-night-border/40">
                <input
                  type="checkbox"
                  checked={aesthetics.showDailyPrompt}
                  onChange={() => toggleAesthetic('showDailyPrompt')}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span>{strings.dailyPrompt}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-cozy-accent col-span-2">
                <input
                  type="checkbox"
                  checked={aesthetics.showLibrarianRemark}
                  onChange={() => toggleAesthetic('showLibrarianRemark')}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span>{strings.librarianRemark}</span>
              </label>
            </div>

            {/* ВИБІР СИМВОЛУ ОЦІНКИ ДНЯ */}
            {aesthetics.showRating && (
              <div className="flex items-center justify-between bg-cozy-surface dark:bg-night-surface p-2 rounded-xl border border-cozy-border/40 dark:border-night-border/40 mt-1">
                <span className="text-[11px] text-cozy-muted">
                  {lang === 'uk' ? 'Символ оцінки дня:' : 'Rating symbol:'}
                </span>
                <div className="flex items-center gap-1.5">
                  {['☕', '⭐', '❤️', '🌿', '🕯️', '✨'].map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => onAestheticsChange({ ...aesthetics, ratingSymbol: sym })}
                      className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
                        (aesthetics.ratingSymbol || '☕') === sym
                          ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg font-bold shadow-xs scale-110'
                          : 'hover:bg-cozy-card dark:hover:bg-night-card opacity-60 hover:opacity-100'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. ЗВУК FLINS AI */}
          <div className="p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-cozy-accent dark:text-night-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
                  {strings.aiSound}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-cozy-muted">
                {strings.aiSoundStyle}
              </span>
              <select
                value={soundPreset}
                onChange={(e) => {
                  const newPreset = e.target.value as SoundPreset;
                  onSoundPresetChange(newPreset);
                  cozySound.previewPreset(newPreset);
                }}
                className="text-xs bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer text-cozy-text dark:text-night-text"
              >
                <option value="kalimba">🪵 {lang === 'uk' ? 'Тепла калімба (дерево)' : 'Warm Kalimba (Wood)'}</option>
                <option value="harp">🎶 {lang === 'uk' ? 'Затишна арфа (щипок)' : 'Cozy Harp (Pluck)'}</option>
                <option value="typewriter">📠 {lang === 'uk' ? 'Вінтажна друкарка (клік)' : 'Vintage Typewriter (Click)'}</option>
                <option value="zen">🔔 {lang === 'uk' ? 'Тихий дзен-дзвін' : 'Zen Bell'}</option>
                <option value="celesta">✨ {lang === 'uk' ? 'Кришталева челеста' : 'Crystal Celesta'}</option>
                <option value="silent">🔇 {lang === 'uk' ? 'Без звуку (тиша)' : 'Silent'}</option>
              </select>
            </div>
          </div>

          {/* 5. ШИРИНА АРКУША */}
          <div className="flex items-center justify-between p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60">
            <div className="flex items-center gap-2.5">
              <Maximize2 size={16} className="text-cozy-accent dark:text-night-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
                {strings.pageWidth}
              </span>
            </div>
            <div className="flex gap-1 bg-cozy-surface dark:bg-night-surface p-1 border border-cozy-border dark:border-night-border rounded-lg">
              <button
                onClick={() => onToggleWide(false)}
                className={`text-xs px-2.5 py-1 rounded cursor-pointer ${!isWide ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg font-medium' : 'text-cozy-muted'}`}
              >
                {strings.compact}
              </button>
              <button
                onClick={() => onToggleWide(true)}
                className={`text-xs px-2.5 py-1 rounded cursor-pointer ${isWide ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg font-medium' : 'text-cozy-muted'}`}
              >
                {strings.wide}
              </button>
            </div>
          </div>

          {/* 6. МАСШТАБ АРКУША */}
          <div className="p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZoomIn size={16} className="text-cozy-accent dark:text-night-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
                  {strings.sheetScale}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-cozy-text dark:text-night-text bg-cozy-surface dark:bg-night-surface px-2 py-0.5 rounded border border-cozy-border/60 dark:border-night-border/60">
                  {uiScale}%
                </span>
                <button
                  onClick={() => onUiScaleChange(100)}
                  className="p-1 rounded text-cozy-muted hover:text-cozy-text hover:bg-cozy-surface dark:hover:bg-night-surface transition-colors cursor-pointer"
                  title={strings.resetScale}
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] text-cozy-muted font-mono">80%</span>
              <input
                type="range"
                min="80"
                max="125"
                step="5"
                value={uiScale}
                onChange={(e) => onUiScaleChange(Number(e.target.value))}
                className="flex-1 accent-cozy-accent cursor-pointer h-1.5 bg-cozy-surface dark:bg-night-surface rounded-lg appearance-none"
              />
              <span className="text-[11px] text-cozy-muted font-mono">125%</span>
            </div>
          </div>

          {/* 7. ФІЗИЧНЕ СХОВИЩЕ */}
                    <div className="p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FolderOpen size={16} className="text-cozy-accent dark:text-night-accent" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
                            {strings.vaultTitle}
                          </span>
                        </div>

                        {/* Перемикач + акуратна іконка попередження без фону */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowVaultSecurity(!showVaultSecurity)}
                            className={`p-1 rounded hover:bg-cozy-surface dark:hover:bg-night-surface transition-colors cursor-pointer ${
                              showVaultSecurity ? 'text-amber-500' : 'text-cozy-muted hover:text-amber-500'
                            }`}
                            title={lang === 'uk' ? 'Приватність та шифрування' : 'Privacy & Encryption'}
                          >
                            <AlertTriangle size={14} />
                          </button>

                          <label className="flex items-center gap-2 text-xs text-cozy-muted cursor-pointer hover:text-cozy-text select-none">
                            <input
                              type="checkbox"
                              checked={vaultConfig.enabled}
                              onChange={(e) => onVaultConfigChange({ ...vaultConfig, enabled: e.target.checked })}
                              className="rounded accent-cozy-accent cursor-pointer"
                            />
                            <span className="font-medium text-cozy-text dark:text-night-text">
                              {strings.vaultEnable}
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Розгортання інформації по кліку на трикутник */}
                      {showVaultSecurity && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed animate-cozy-pop">
                          <strong>{lang === 'uk' ? 'Приватність сховища:' : 'Vault privacy:'}</strong>{' '}
                          {lang === 'uk'
                            ? `Файли зберігаються у відкритому форматі Markdown (.md) для прямого доступу. Для захисту від сторонніх увімкніть системне шифрування диска (${isMac ? 'FileVault' : 'BitLocker'}).`
                            : `Files are stored in plain Markdown (.md) for direct file manager access. For local protection, enable system disk encryption (${isMac ? 'FileVault' : 'BitLocker'}).`}
                        </div>
                      )}

                      {vaultConfig.enabled && (
                        <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                          <label className="text-[11px] text-cozy-muted block">
                            {strings.vaultPathLabel}
                          </label>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={vaultConfig.vaultPath}
                              onChange={(e) => onVaultConfigChange({ ...vaultConfig, vaultPath: e.target.value })}
                              placeholder="/Users/.../Documents/FlinsVault"
                              className="flex-1 text-xs font-mono bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-lg px-2.5 py-1.5 focus:outline-none"
                            />

                            <button
                              onClick={async () => {
                                try {
                                  const selectedPath = await invoke<string | null>('pick_vault_folder');
                                  if (selectedPath) {
                                    onVaultConfigChange({ ...vaultConfig, vaultPath: selectedPath });
                                  }
                                } catch (err) {
                                  console.error('Error picking folder:', err);
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border hover:border-cozy-accent hover:text-cozy-accent text-xs font-medium transition-colors flex-shrink-0 cursor-pointer"
                              title={strings.vaultBrowse}
                            >
                              <FolderOpen size={13} />
                              <span>{strings.vaultBrowse}</span>
                            </button>
                          </div>

                          <p className="text-[10px] text-cozy-muted italic">
                            {strings.vaultHint}
                          </p>
                        </div>
                      )}
                    </div>

          {/* 8. ЛОКАЛЬНИЙ ШІ: З АВТО-ПОШУКОМ ТА СТАТУСОМ МЕРЕЖІ */}
          <div className="p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-cozy-accent dark:text-night-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
                  {strings.localAi}
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs text-cozy-muted cursor-pointer hover:text-cozy-text select-none">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => onAiEnabledChange(e.target.checked)}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span className="font-medium text-cozy-text dark:text-night-text">
                  {strings.enableAi}
                </span>
              </label>
            </div>

            <div className={`space-y-3 transition-opacity ${aiEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-cozy-muted">
                  {strings.serverUrl}
                </label>

                <button
                  type="button"
                  onClick={() => setIsAiHelpOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-cozy-accent dark:text-night-accent hover:underline cursor-pointer"
                >
                  <HelpCircle size={13} />
                  <span>{strings.aiGuideBtn}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled={!aiEnabled}
                  value={apiUrl}
                  onChange={(e) => onApiUrlChange(e.target.value)}
                  className="flex-1 text-xs font-mono bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-lg px-3 py-2 text-cozy-text dark:text-night-text focus:outline-none"
                  placeholder="http://127.0.0.1:1234"
                />

                <button
                  type="button"
                  onClick={handleCheckServer}
                  disabled={isCheckingServer || !aiEnabled}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border hover:border-cozy-accent text-xs font-medium text-cozy-text dark:text-night-text transition-all cursor-pointer shadow-xs flex-shrink-0"
                  title="Авто-пошук сервера та моделі"
                >
                  <RefreshCw size={13} className={isCheckingServer ? 'animate-spin text-cozy-accent' : ''} />
                  <span>{lang === 'uk' ? 'Перевірити' : 'Test'}</span>
                </button>
              </div>

              {/* СТАТУС ПІДКЛЮЧЕННЯ: Зелений бейдж із визначенням типу мережі */}
              {serverStatus && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 animate-cozy-pop ${
                    serverStatus.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {serverStatus.ok ? (
                      <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">
                      {serverStatus.ok
                        ? `${serverStatus.activeModel}`
                        : serverStatus.errorMessage}
                    </span>
                  </div>

                  {serverStatus.ok && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 font-mono font-semibold flex-shrink-0">
                      {classifyNetworkType(apiUrl) === 'localhost'
                        ? (lang === 'uk' ? 'Цей ПК 💻' : 'This PC 💻')
                        : classifyNetworkType(apiUrl) === 'lan'
                        ? (lang === 'uk' ? 'Сусідній ПК (LAN) 🏠' : 'LAN Network 🏠')
                        : (lang === 'uk' ? 'Інтернет (WAN) 🌐' : 'Internet (WAN) 🌐')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 9. МОВА ЗАСТОСУНКУ */}
          <div className="flex items-center justify-between p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60">
            <div className="flex items-center gap-2.5">
              <Globe size={16} className="text-cozy-accent dark:text-night-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
                {strings.langTitle}
              </span>
            </div>
            <select
              value={lang}
              onChange={(e) => onLangChange(e.target.value as Lang)}
              className="text-xs bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="uk">Українська 🇺🇦</option>
              <option value="en">English 🇬🇧</option>
            </select>
          </div>

          {/* 10. ОНОВЛЕННЯ */}
          <div className="p-4 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-border/60 dark:border-night-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download size={16} className="text-cozy-accent dark:text-night-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-cozy-muted">
                  {strings.updatesTitle}
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs text-cozy-muted cursor-pointer hover:text-cozy-text select-none">
                <input
                  type="checkbox"
                  checked={autoUpdate}
                  onChange={(e) => onAutoUpdateChange(e.target.checked)}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span className="font-medium text-cozy-text dark:text-night-text">
                  {strings.autoUpdateCheck}
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={updState.phase === 'checking' || updState.phase === 'installing'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border hover:border-cozy-accent text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
              >
                <RefreshCw size={13} className={updState.phase === 'checking' ? 'animate-spin text-cozy-accent' : ''} />
                <span>{updState.phase === 'checking' ? strings.checkingUpdates : strings.checkNow}</span>
              </button>

              {updState.phase === 'available' && (
                <button
                  type="button"
                  onClick={handleInstallUpdate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg text-xs font-medium shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {supportsInAppUpdate ? strings.installUpdate : strings.openReleasePage}
                </button>
              )}
            </div>

            {updState.phase === 'installing' && (
              <div className="h-1.5 rounded bg-cozy-surface dark:bg-night-card overflow-hidden">
                <div
                  className="h-full bg-cozy-accent dark:bg-night-accent transition-all duration-200"
                  style={{ width: `${updState.pct ?? 0}%` }}
                />
              </div>
            )}

            {updState.phase === 'latest' && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{strings.upToDate}</p>
            )}
            {updState.phase === 'available' && updState.version && (
              <p className="text-[11px] text-cozy-text dark:text-night-text">
                {strings.updateAvailable} <strong className="font-mono">v{updState.version}</strong>
              </p>
            )}
            {updState.phase === 'unreachable' && (
              <p className="text-[11px] text-cozy-muted italic">{strings.updateUnreachable}</p>
            )}

            <p className="text-[10px] text-cozy-muted">{strings.autoUpdateHint}</p>
          </div>

          {/* 11. НИЖНІЙ КОЛОНТИТУЛ */}
          <div className="p-3 bg-cozy-card/60 dark:bg-night-card/60 rounded-xl border border-cozy-border/40 dark:border-night-border/40 flex items-center justify-between text-[11px] text-cozy-muted font-sans">
            <div className="flex items-center gap-1.5">
              <Info size={13} className="text-cozy-accent dark:text-night-accent" />
              <span>{strings.appInfo}</span>
            </div>
            <span>
              {strings.developedBy} <strong className="text-cozy-accent dark:text-night-accent font-semibold">{profile.nickname}</strong>
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-cozy-border/60 dark:border-night-border/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg shadow-xs cursor-pointer"
          >
            {strings.close}
          </button>
        </div>
      </div>

      <AiHelpModal
        isOpen={isAiHelpOpen}
        onClose={() => setIsAiHelpOpen(false)}
        lang={lang}
      />
    </div>
  );
}
