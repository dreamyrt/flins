import { useState } from 'react';
import { Sparkles, Hourglass, RotateCcw, EyeOff, Eye } from 'lucide-react';
import { DayMetadata } from '../../hooks/useJournal';
import { AestheticsConfig } from '../../settings/SettingsModal';
import { Lang, t } from '../../services/i18n';
import AiSparkleLoader from '../common/AiSparkleLoader';

interface JournalHeaderProps {
  selectedDate: Date;
  metadata: DayMetadata;
  aesthetics: AestheticsConfig;
  isAiOpen?: boolean;
  onUpdateMetadata: (meta: Partial<DayMetadata>) => void;
  onInsertTimestamp: (timeText: string) => void;
  onGenerateAiPrompt?: () => Promise<string>;
  lang: Lang;
}

const WEATHERS = ['☀️', '⛅', '🌧️', '❄️', '💨'];

const COZY_PROMPTS = {
  uk: [
    "Яка маленька радість зігріла вас сьогодні?",
    "Яку розмову за сьогодні хочеться зберегти в пам'яті?",
    "Що сьогодні змусило вас видихнути з полегшенням?",
    "Який момент дня вам хотілося б поставити на паузу?",
    "За що ви найбільше вдячні сьогоднішньому дню?",
    "Який смак, звук або запах сьогодні запам'ятався найбільше?",
    "Що сьогодні забрало найбільше сил, а що допомогло відновитися?",
    "Яке відкриття або інсайт ви зробили сьогодні?",
    "Яке рішення ви прийняли сьогодні, яким щиро пишаєтесь?",
    "Якби цей день був назвою картини, як би вона називалася?",
  ],
  en: [
    "What small joy warmed your heart today?",
    "Which conversation from today is worth remembering?",
    "What made you exhale with relief today?",
    "Which moment from today would you like to pause?",
    "What are you most grateful for today?",
    "What flavor, sound, or scent stood out today?",
    "What drained your energy today, and what restored it?",
    "What small insight did you discover about yourself today?",
    "What choice did you make today that you feel proud of?",
    "If this day had a chapter title, what would it be?",
  ],
};

export default function JournalHeader({
  selectedDate,
  metadata,
  aesthetics,
  isAiOpen,
  onUpdateMetadata,
  onInsertTimestamp,
  onGenerateAiPrompt,
  lang,
}: JournalHeaderProps) {
  const [showMoodMenu, setShowMoodMenu] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [isPromptHidden, setIsPromptHidden] = useState(false);

  // Стан для живого ШІ-питання дня
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [isPromptLoading, setIsPromptLoading] = useState(false);

  const strings = t[lang];
  const prompts = COZY_PROMPTS[lang];

  const MOODS = [
    { emoji: '😌', label: strings.moodCalm },
    { emoji: '☕', label: strings.moodCozy },
    { emoji: '🌧️', label: strings.moodMelancholy },
    { emoji: '🕯️', label: strings.moodSilence },
    { emoji: '✨', label: strings.moodInspiration },
    { emoji: '⚡', label: strings.moodProductivity },
  ];

  const weekdayName = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    weekday: 'long',
  }).format(selectedDate);

  const monthYearName = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(selectedDate);

  const dayNumber = selectedDate.getDate();

  const handleAddTimestamp = () => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      onInsertTimestamp(timeStr);
    };

  // Оживлення Точки 4: Генерація унікального питання через локальну модель
  const handleNextPrompt = async () => {
    if (isPromptLoading) return;

    if (onGenerateAiPrompt) {
      setIsPromptLoading(true);
      try {
        const aiQuestion = await onGenerateAiPrompt();
        if (aiQuestion && aiQuestion.trim()) {
          setCustomPrompt(aiQuestion.trim());
        } else {
          setCustomPrompt(null);
          setPromptIndex((prev) => (prev + 1) % prompts.length);
        }
      } catch {
        setCustomPrompt(null);
        setPromptIndex((prev) => (prev + 1) % prompts.length);
      } finally {
        setIsPromptLoading(false);
      }
    } else {
      setCustomPrompt(null);
      setPromptIndex((prev) => (prev + 1) % prompts.length);
    }
  };

  const hasAnyElement = Object.values(aesthetics).some(Boolean);
  if (!hasAnyElement) return null;

  return (
    <div className="relative pb-4 mb-5 border-b border-cozy-border/60 dark:border-night-border/60 select-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Штамп дати */}
        {aesthetics.showDateHeader ? (
          <div className="flex items-baseline gap-2.5 flex-shrink-0">
            <span className="text-3xl font-serif font-bold text-cozy-text dark:text-night-text tracking-tight">
              {dayNumber}
            </span>
            <div className="flex flex-col">
              <span className="text-xl font-serif capitalize text-cozy-accent dark:text-night-accent font-semibold leading-tight font-cozy-handwriting">
                {weekdayName}
              </span>
              <span className="text-[10px] font-serif uppercase tracking-widest text-cozy-muted whitespace-nowrap">
                {monthYearName}
              </span>
            </div>
          </div>
        ) : <div />}

        {/* Панель стікерів */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0 ml-auto">
          {/* Кнопка + Час */}
          {aesthetics.showTimeButton && (
            <button
              onClick={handleAddTimestamp}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cozy-surface dark:bg-night-surface border border-cozy-border/60 dark:border-night-border/60 text-xs font-medium text-cozy-text dark:text-night-text hover:border-cozy-accent hover:text-cozy-accent transition-all shadow-xs flex-shrink-0"
              title="Timestamp"
            >
              <Hourglass size={12} className="text-cozy-accent dark:text-night-accent" />
              <span className="text-[11px] font-mono tracking-tight font-semibold">
                {strings.timeBadge}
              </span>
            </button>
          )}

          {/* Погода */}
          {aesthetics.showWeather && (
            <div className="flex items-center bg-cozy-surface dark:bg-night-surface p-1 rounded-xl border border-cozy-border/60 dark:border-night-border/60 flex-shrink-0">
              {WEATHERS.map((w) => (
                <button
                  key={w}
                  onClick={() => onUpdateMetadata({ weather: w })}
                  className={`w-5 h-5 rounded-lg text-xs flex items-center justify-center transition-all ${
                    metadata.weather === w
                      ? 'bg-cozy-card dark:bg-night-card shadow-xs scale-110'
                      : 'opacity-40 hover:opacity-100'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          )}

          {/* Настрій та оцінка */}
          <div className={`flex ${isAiOpen ? 'flex-col items-center justify-center gap-1.5' : 'items-center gap-1.5'} flex-shrink-0`}>
            {aesthetics.showMood && (
              <div className="relative">
                <button
                  onClick={() => setShowMoodMenu(!showMoodMenu)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cozy-surface dark:bg-night-surface border border-cozy-border/60 dark:border-night-border/60 text-xs font-medium hover:border-cozy-accent transition-all shadow-xs"
                  title="Mood"
                >
                  <span className="text-sm">{metadata.mood || '☕'}</span>
                  <span className="text-[11px] text-cozy-muted whitespace-nowrap">
                    {MOODS.find((m) => m.emoji === metadata.mood)?.label || strings.moodHeaderFallback}
                  </span>
                </button>

                {showMoodMenu && (
                  <div
                    className="absolute right-0 top-full mt-1.5 z-30 bg-cozy-card dark:bg-night-card border border-cozy-border dark:border-night-border rounded-2xl shadow-xl p-1.5 w-44 space-y-0.5 animate-cozy-pop"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {MOODS.map((m) => (
                      <button
                        key={m.emoji}
                        onClick={() => {
                          onUpdateMetadata({ mood: m.emoji });
                          setShowMoodMenu(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-left transition-colors ${
                          metadata.mood === m.emoji
                            ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg font-semibold'
                            : 'hover:bg-cozy-surface dark:hover:bg-night-surface text-cozy-text dark:text-night-text'
                        }`}
                      >
                        <span>{m.emoji}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Оцінка дня */}
            {aesthetics.showRating && (
              <div className="flex items-center justify-center gap-1 bg-cozy-surface dark:bg-night-surface px-2 py-1 rounded-xl border border-cozy-border/60 dark:border-night-border/60 shadow-xs flex-shrink-0">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = (metadata.rating || 0) >= star;
                  return (
                    <button
                      key={star}
                      onClick={() => onUpdateMetadata({ rating: star })}
                      className={`text-xs transition-all duration-150 transform hover:scale-125 cursor-pointer ${
                        isFilled
                          ? 'opacity-100 scale-105 drop-shadow-xs'
                          : 'opacity-25 grayscale hover:grayscale-0 hover:opacity-70'
                      }`}
                      title={`Оцінка ${star}/5`}
                    >
                      <span>{aesthetics.ratingSymbol || '☕'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Щоденне питання з живим ШІ-генератором та сяючим лоадером */}
      {aesthetics.showDailyPrompt && (
        !isPromptHidden ? (
          <div className="mt-3 pt-2.5 border-t border-dashed border-cozy-border/40 dark:border-night-border/40 flex items-center justify-between text-xs text-cozy-muted italic">
            <div
              onClick={handleNextPrompt}
              className="flex items-center gap-2 cursor-pointer hover:text-cozy-accent transition-colors group flex-1 truncate"
              title={lang === 'uk' ? 'Натисніть, щоб згенерувати нове питання' : 'Click to generate new prompt'}
            >
              {isPromptLoading ? (
                <div className="flex-shrink-0">
                  <AiSparkleLoader lang={lang} size="sm" />
                </div>
              ) : (
                <Sparkles size={13} className="text-cozy-accent dark:text-night-accent flex-shrink-0 group-hover:rotate-12 transition-transform" />
              )}
              <span className="font-serif tracking-wide select-none truncate">
                «{customPrompt || prompts[promptIndex]}»
              </span>
            </div>

            <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 ml-3">
              <button
                onClick={handleNextPrompt}
                disabled={isPromptLoading}
                className="p-1 rounded-md hover:bg-cozy-surface dark:hover:bg-night-surface hover:text-cozy-accent cursor-pointer disabled:opacity-40"
                title={lang === 'uk' ? 'Оновити питання' : 'Next prompt'}
              >
                <RotateCcw size={12} className={isPromptLoading ? 'animate-spin text-cozy-accent' : ''} />
              </button>
              <button
                onClick={() => setIsPromptHidden(true)}
                className="p-1 rounded-md hover:bg-cozy-surface dark:hover:bg-night-surface hover:text-cozy-accent cursor-pointer"
                title={lang === 'uk' ? 'Приховати' : 'Hide'}
              >
                <EyeOff size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex justify-end">
            <button onClick={() => setIsPromptHidden(false)} className="flex items-center gap-1 text-[10px] text-cozy-muted/60 hover:text-cozy-accent transition-colors">
              <Eye size={11} />
              <span>Prompt</span>
            </button>
          </div>
        )
      )}
    </div>
  );
}
