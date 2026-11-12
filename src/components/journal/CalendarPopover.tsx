import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles, Maximize2, X, Smile, SunMedium, Star, CircleDot } from 'lucide-react';
import { Lang } from '../../services/i18n';
import { DayMetadata } from '../../hooks/useJournal';

type CalendarFilter = 'mood' | 'weather' | 'rating' | 'dot';

interface CalendarPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  getDayMetadata: (date: Date) => DayMetadata | undefined;
  lang: Lang;
}

export default function CalendarPopover({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  getDayMetadata,
  lang,
}: CalendarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState<Date>(new Date(selectedDate));
  const [isYearViewOpen, setIsYearViewOpen] = useState(false);

  const [filter, setFilter] = useState<CalendarFilter>('mood');

  useEffect(() => {
    if (isOpen) {
      setViewDate(new Date(selectedDate));
      setIsYearViewOpen(false);
    }
  }, [isOpen, selectedDate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isYearViewOpen) {
          setIsYearViewOpen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isYearViewOpen, onClose]);

  if (!isOpen) return null;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthTitle = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(viewDate);

  const weekDays = lang === 'uk'
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
    : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const monthNames = lang === 'uk'
    ? ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonthDays = Array.from({ length: firstDayIndex }, (_, i) => daysInPrevMonth - firstDayIndex + i + 1);
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalDays = prevMonthDays.length + currentMonthDays.length;
  const nextMonthDaysCount = (7 - (totalDays % 7)) % 7;
  const nextMonthDays = Array.from({ length: nextMonthDaysCount }, (_, i) => i + 1);

  const isToday = (d: number, m: number, y: number) => {
    const now = new Date();
    return now.getDate() === d && now.getMonth() === m && now.getFullYear() === y;
  };

  const isSelected = (d: number, m: number, y: number) => {
    return selectedDate.getDate() === d && selectedDate.getMonth() === m && selectedDate.getFullYear() === y;
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDaySelect = (day: number, monthOffset: number = 0) => {
    const newSelected = new Date(year, month + monthOffset, day);
    onSelectDate(newSelected);
    onClose();
  };

  const renderDayMarker = (date: Date) => {
    const meta = getDayMetadata(date);
    if (!meta) return null;

    if (filter === 'mood' && meta.mood) {
      return <span className="text-[9px] leading-none absolute -bottom-1">{meta.mood}</span>;
    }
    if (filter === 'weather' && meta.weather) {
      return <span className="text-[9px] leading-none absolute -bottom-1">{meta.weather}</span>;
    }
    if (filter === 'rating' && meta.rating) {
      return <span className="text-[8px] font-bold text-amber-500 leading-none absolute -bottom-1">{meta.rating}★</span>;
    }
    return <span className="w-1.5 h-1.5 rounded-full bg-cozy-accent dark:bg-night-accent absolute bottom-0.5" />;
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-transparent" />

      {/* РЕЖИМ «ОГЛЯД РОКУ»: через createPortal у document.body, поверх усього застосунку та AI-шторки */}
      {isYearViewOpen && typeof document !== 'undefined' ? (
        createPortal(
          <>
            <div
              onClick={() => setIsYearViewOpen(false)}
              className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-xs select-none anim-modal-backdrop-in"
            />

            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-4 sm:inset-8 z-[9999] bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-3xl p-6 shadow-2xl flex flex-col anim-modal-box-in select-none overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-cozy-border/60 dark:border-night-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-cozy-card dark:bg-night-card px-3 py-1 rounded-xl border border-cozy-border/60 dark:border-night-border/60">
                    <button onClick={() => setViewDate(new Date(year - 1, month, 1))} className="p-1 hover:text-cozy-accent cursor-pointer">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-base font-serif font-bold text-cozy-text dark:text-night-text px-2">{year}</span>
                    <button onClick={() => setViewDate(new Date(year + 1, month, 1))} className="p-1 hover:text-cozy-accent cursor-pointer">
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* ФІЛЬТР-ІКОНКИ */}
                  <div className="flex items-center gap-1 bg-cozy-card dark:bg-night-card p-1 rounded-xl border border-cozy-border/60 dark:border-night-border/60">
                    <button
                      onClick={() => setFilter('mood')}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${filter === 'mood' ? 'bg-cozy-accent text-white shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                      title="Настрій дня"
                    >
                      <Smile size={14} />
                    </button>
                    <button
                      onClick={() => setFilter('weather')}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${filter === 'weather' ? 'bg-cozy-accent text-white shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                      title="Погода"
                    >
                      <SunMedium size={14} />
                    </button>
                    <button
                      onClick={() => setFilter('rating')}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${filter === 'rating' ? 'bg-cozy-accent text-white shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                      title="Оцінка дня"
                    >
                      <Star size={14} />
                    </button>
                    <button
                      onClick={() => setFilter('dot')}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${filter === 'dot' ? 'bg-cozy-accent text-white shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                      title="Проста крапка"
                    >
                      <CircleDot size={14} />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setIsYearViewOpen(false)}
                  className="p-1.5 rounded-xl text-cozy-muted hover:text-cozy-text hover:bg-cozy-card dark:hover:bg-night-card cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 overflow-y-auto">
                {monthNames.map((mName, mIdx) => {
                  const mDaysCount = new Date(year, mIdx + 1, 0).getDate();
                  const mFirstDay = (new Date(year, mIdx, 1).getDay() + 6) % 7;

                  return (
                    <div key={mName} className="bg-cozy-card/60 dark:bg-night-card/60 rounded-xl p-3 border border-cozy-border/40 dark:border-night-border/40 flex flex-col justify-between">
                      <div className="text-xs font-serif font-bold text-cozy-accent dark:text-night-accent mb-2">
                        {mName}
                      </div>

                      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
                        {Array.from({ length: mFirstDay }).map((_, i) => (
                          <span key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: mDaysCount }, (_, i) => i + 1).map((day) => {
                          const dayDate = new Date(year, mIdx, day);
                          const sel = isSelected(day, mIdx, year);
                          const tod = isToday(day, mIdx, year);

                          return (
                            <button
                              key={day}
                              onClick={() => {
                                onSelectDate(dayDate);
                                setIsYearViewOpen(false);
                                onClose();
                              }}
                              className={`w-6 h-6 rounded-md flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                                sel
                                  ? 'bg-cozy-accent text-white font-bold'
                                  : tod
                                  ? 'bg-cozy-border dark:bg-night-border font-bold'
                                  : 'hover:bg-cozy-surface dark:hover:bg-night-surface text-cozy-muted hover:text-cozy-text'
                              }`}
                            >
                              <span className="leading-none">{day}</span>
                              {!sel && renderDayMarker(dayDate)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )
      ) : (
        /* КОМПАКТНИЙ МІНІ-КАЛЕНДАР (під кнопкою в шапці) */
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-2 z-50 w-72 bg-cozy-card dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-2xl shadow-2xl p-4 select-none animate-cozy-pop origin-top-left"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-cozy-border/60 dark:border-night-border/60">
            <div className="flex items-center gap-1.5">
              <CalendarIcon size={14} className="text-cozy-accent dark:text-night-accent" />
              <span className="text-xs font-serif font-bold capitalize text-cozy-text dark:text-night-text">
                {monthTitle}
              </span>
            </div>

            <div className="flex items-center gap-0.5">
              <button onClick={handlePrevMonth} className="p-1 rounded-md text-cozy-muted hover:text-cozy-text hover:bg-cozy-surface dark:hover:bg-night-card transition-colors cursor-pointer">
                <ChevronLeft size={14} />
              </button>
              <button onClick={handleNextMonth} className="p-1 rounded-md text-cozy-muted hover:text-cozy-text hover:bg-cozy-surface dark:hover:bg-night-card transition-colors cursor-pointer">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-cozy-border/40 dark:border-night-border/40">
            <span className="text-[10px] uppercase font-mono text-cozy-muted tracking-wider">Фільтр:</span>
            <div className="flex items-center gap-1 bg-cozy-surface dark:bg-night-card p-0.5 rounded-lg border border-cozy-border/60 dark:border-night-border/60">
              <button
                onClick={() => setFilter('mood')}
                className={`p-1 rounded-md transition-all cursor-pointer ${filter === 'mood' ? 'bg-cozy-accent text-white shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                title="Настрій"
              >
                <Smile size={12} />
              </button>
              <button
                onClick={() => setFilter('weather')}
                className={`p-1 rounded-md transition-all cursor-pointer ${filter === 'weather' ? 'bg-cozy-accent text-white shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                title="Погода"
              >
                <SunMedium size={12} />
              </button>
              <button
                onClick={() => setFilter('rating')}
                className={`p-1 rounded-md transition-all cursor-pointer ${filter === 'rating' ? 'bg-cozy-accent text-white shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                title="Оцінка"
              >
                <Star size={12} />
              </button>
              <button
                onClick={() => setFilter('dot')}
                className={`p-1 rounded-md transition-all cursor-pointer ${filter === 'dot' ? 'bg-cozy-accent text-white shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                title="Крапка"
              >
                <CircleDot size={12} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-center">
            {weekDays.map((d) => (
              <span key={d} className="text-[10px] font-semibold text-cozy-muted uppercase tracking-wider">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {prevMonthDays.map((day) => (
              <button
                key={`prev-${day}`}
                onClick={() => handleDaySelect(day, -1)}
                className="w-8 h-8 rounded-lg text-[11px] text-cozy-muted/40 hover:bg-cozy-surface dark:hover:bg-night-card flex items-center justify-center transition-colors cursor-pointer"
              >
                {day}
              </button>
            ))}

            {currentMonthDays.map((day) => {
              const dayDate = new Date(year, month, day);
              const selected = isSelected(day, month, year);
              const today = isToday(day, month, year);

              return (
                <button
                  key={`cur-${day}`}
                  onClick={() => handleDaySelect(day, 0)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                    selected
                      ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg shadow-sm scale-105 font-bold'
                      : today
                      ? 'bg-cozy-surface dark:bg-night-card text-cozy-accent dark:text-night-accent font-bold border border-cozy-border dark:border-night-border'
                      : 'text-cozy-text dark:text-night-text hover:bg-cozy-surface dark:hover:bg-night-card'
                  }`}
                >
                  <span className={selected ? 'leading-none' : 'leading-tight'}>{day}</span>
                  {!selected && renderDayMarker(dayDate)}
                </button>
              );
            })}

            {nextMonthDays.map((day) => (
              <button
                key={`next-${day}`}
                onClick={() => handleDaySelect(day, 1)}
                className="w-8 h-8 rounded-lg text-[11px] text-cozy-muted/40 hover:bg-cozy-surface dark:hover:bg-night-card flex items-center justify-center transition-colors cursor-pointer"
              >
                {day}
              </button>
            ))}
          </div>

          <div className="pt-2.5 mt-2 border-t border-cozy-border/60 dark:border-night-border/60 flex items-center justify-between">
            <button
              onClick={() => {
                const now = new Date();
                onSelectDate(now);
                setViewDate(new Date(now));
                onClose();
              }}
              className="flex items-center gap-1.5 text-[11px] font-medium text-cozy-accent dark:text-night-accent hover:underline py-0.5 cursor-pointer"
            >
              <Sparkles size={12} />
              <span>{lang === 'uk' ? 'Сьогодні' : 'Today'}</span>
            </button>

            <button
              onClick={() => setIsYearViewOpen(true)}
              className="flex items-center gap-1 text-[11px] text-cozy-muted hover:text-cozy-text dark:hover:text-night-text px-2 py-0.5 rounded-md hover:bg-cozy-surface dark:hover:bg-night-card transition-colors cursor-pointer"
            >
              <Maximize2 size={11} />
              <span>{lang === 'uk' ? 'Огляд року' : 'Year view'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
