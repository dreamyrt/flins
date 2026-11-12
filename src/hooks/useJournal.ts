import { useState, useEffect, useRef } from 'react';
import { Lang } from '../services/i18n';
import { dbService, VaultConfig } from '../services/dbService';

export interface JournalPage {
  id: string;
  title: string;
  isFavorite: boolean;
  content: any[];
}

export interface DayMetadata {
  mood?: string;
  weather?: string;
  rating?: number;
}

export interface DayEntry {
  pages: JournalPage[];
  activePageIndex: number;
  isModified: boolean;
  metadata: DayMetadata;
}

export function useJournal(lang: Lang, vaultConfig?: VaultConfig, onSaveStatusChange?: (saving: boolean) => void) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entriesMap, setEntriesMap] = useState<Record<string, DayEntry>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  const getDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const selectedDateFormatted = formatDate(selectedDate);
  const currentKey = getDateKey(selectedDate);

  // 1. Початкове завантаження з SQLite при старті
  useEffect(() => {
    dbService.loadJournalEntries().then((loaded) => {
      setEntriesMap(loaded);
      setIsLoaded(true);
    });
  }, []);

  const createDefaultDay = (date: Date): DayEntry => {
    return {
      activePageIndex: 0,
      isModified: false,
      metadata: { mood: '☕', weather: '☀️', rating: 5 },
      pages: [
        {
          id: `page-${getDateKey(date)}-1`,
          title: 'Аркуш 1',
          isFavorite: false,
          content: [
            {
              type: "paragraph",
              content: lang === 'uk' ? "Запишіть думки цього дня..." : "Capture your reflections for today...",
            },
          ],
        },
      ],
    };
  };

  const currentDayEntry = entriesMap[currentKey] || createDefaultDay(selectedDate);
  const journalPages = currentDayEntry.pages;
  const activePageIndex = currentDayEntry.activePageIndex;
  const currentPage = journalPages[activePageIndex] || journalPages[0];
  const metadata = currentDayEntry.metadata;

  // 2. Тихохідний Debounce-тригер для збереження (400 мс після зупинки вводу)
  const triggerDebouncedSave = (updatedMap: Record<string, DayEntry>) => {
    if (onSaveStatusChange) onSaveStatusChange(true);
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(async () => {
      const entryToSave = updatedMap[currentKey];
      if (entryToSave && entryToSave.isModified) {
        await dbService.saveJournalEntry(currentKey, entryToSave, '', vaultConfig);
      }
      if (onSaveStatusChange) onSaveStatusChange(false);
      debounceTimerRef.current = null;
    }, 400);
  };

  const saveContent = (blocks: any[]) => {
    const existing = entriesMap[currentKey] || createDefaultDay(selectedDate);
    const updatedPages = existing.pages.map((p, idx) =>
      idx === activePageIndex ? { ...p, content: blocks } : p
    );
    const updatedMap = {
      ...entriesMap,
      [currentKey]: {
        ...existing,
        pages: updatedPages,
        isModified: true,
      },
    };
    setEntriesMap(updatedMap);
    triggerDebouncedSave(updatedMap);
  };

  const updateMetadata = (newMeta: Partial<DayMetadata>) => {
    const existing = entriesMap[currentKey] || createDefaultDay(selectedDate);
    const updatedMap = {
      ...entriesMap,
      [currentKey]: {
        ...existing,
        metadata: { ...existing.metadata, ...newMeta },
        isModified: true,
      },
    };
    setEntriesMap(updatedMap);
    triggerDebouncedSave(updatedMap);
  };

  const setActivePageIndex = (index: number) => {
    const existing = entriesMap[currentKey] || createDefaultDay(selectedDate);
    setEntriesMap({
      ...entriesMap,
      [currentKey]: { ...existing, activePageIndex: index },
    });
  };

  const addNewPage = () => {
    const existing = entriesMap[currentKey] || createDefaultDay(selectedDate);
    const nextNum = existing.pages.length + 1;
    const newPage: JournalPage = {
      id: `page-${currentKey}-${Date.now()}`,
      title: `Аркуш ${nextNum}`,
      isFavorite: false,
      content: [{ type: "paragraph", content: "" }],
    };
    const updatedMap = {
      ...entriesMap,
      [currentKey]: {
        ...existing,
        pages: [...existing.pages, newPage],
        activePageIndex: existing.pages.length,
        isModified: true,
      },
    };
    setEntriesMap(updatedMap);
    triggerDebouncedSave(updatedMap);
  };

  const deletePage = (indexToDelete: number): boolean => {
    if (journalPages.length <= 1) return false;
    const existing = entriesMap[currentKey] || createDefaultDay(selectedDate);
    const newPages = existing.pages.filter((_, idx) => idx !== indexToDelete);
    let newActive = existing.activePageIndex;
    if (newActive >= newPages.length) {
      newActive = Math.max(0, newPages.length - 1);
    } else if (newActive === indexToDelete) {
      newActive = Math.max(0, indexToDelete - 1);
    }
    const updatedMap = {
      ...entriesMap,
      [currentKey]: {
        ...existing,
        pages: newPages,
        activePageIndex: newActive,
        isModified: true,
      },
    };
    setEntriesMap(updatedMap);
    triggerDebouncedSave(updatedMap);
    return true;
  };

  const toggleFavorite = () => {
    const existing = entriesMap[currentKey] || createDefaultDay(selectedDate);
    const updatedPages = existing.pages.map((p, idx) =>
      idx === activePageIndex ? { ...p, isFavorite: !p.isFavorite } : p
    );
    const updatedMap = {
      ...entriesMap,
      [currentKey]: { ...existing, pages: updatedPages, isModified: true },
    };
    setEntriesMap(updatedMap);
    triggerDebouncedSave(updatedMap);
  };

  const getDayMetadata = (date: Date): DayMetadata | undefined => {
    const key = getDateKey(date);
    const entry = entriesMap[key];
    if (entry && entry.isModified) return entry.metadata;
    return undefined;
  };

  return {
    journalPages,
    activePageIndex,
    setActivePageIndex,
    currentPage,
    selectedDate,
    setSelectedDate,
    todayFormatted: selectedDateFormatted,
    metadata,
    updateMetadata,
    getDayMetadata,
    addNewPage,
    deletePage,
    toggleFavorite,
    saveContent,
    isLoaded,
  };
}
