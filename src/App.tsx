import { useState, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import {
  BookOpen, FolderClosed, Moon, Sun, Settings,
  FileText, Bookmark, Grid, PanelLeftClose, PanelLeft,
  Plus, Star, Calendar, Share2, Trash2, ChevronDown, Monitor, CheckCircle2, RefreshCw
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import Editor, { EditorHandle } from './components/editor/Editor';
import NotesManager from './notes/NotesManager';
import SettingsModal, { UserProfile, AestheticsConfig, ThemeMode } from './settings/SettingsModal';
import ExportModal from './components/export/ExportModal';
import ConfirmModal from './components/common/ConfirmModal';
import CalendarPopover from './components/journal/CalendarPopover';
import JournalHeader from './components/journal/JournalHeader';
import FlinsAiDrawer from './services/ai/FlinsAiDrawer';
import AiSparkleLoader from './components/common/AiSparkleLoader';
import { Lang, t } from './services/i18n';
import { useJournal } from './hooks/useJournal';
import { useNotes } from './hooks/useNotes';
import { cozySound, SoundPreset } from './services/sound';
import { getRandomLibrarianRemark, generateMarginRemark, generateDailyQuestion } from './services/ai/aiService';
import { dbService, VaultConfig } from './services/dbService';

import logoDark from './assets/logo-dark.png';
import logoLight from './assets/logo-light.png';
import logoDarkTransparent from './assets/logo-dark-transparent.png';
import logoLightTransparent from './assets/logo-light-transparent.png';
import WindowControls from './components/common/WindowControls';



interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Помилка редактора:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="p-6 bg-cozy-card dark:bg-night-card rounded-2xl border border-cozy-border dark:border-night-border shadow-sm max-w-sm">
            <h4 className="text-sm font-serif font-bold text-cozy-text dark:text-night-text mb-1">
              Перезавантаження аркуша ☕
            </h4>
            <p className="text-xs text-cozy-muted mb-3">
              Дані збережені у базі. Натисніть кнопку для оновлення.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-3.5 py-1.5 rounded-lg bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg text-xs font-medium shadow-xs cursor-pointer"
            >
              Оновити аркуш
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState(false);

  const [activeTab, setActiveTab] = useState<'journal' | 'notes'>('journal');
  const [lang, setLang] = useState<Lang>('uk');
  const [isWide, setIsWide] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:1234/v1');
  const [soundPreset, setSoundPreset] = useState<SoundPreset>('kalimba');
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);

  const [vaultConfig, setVaultConfig] = useState<VaultConfig>({
    enabled: false,
    vaultPath: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiDrawerWidth, setAiDrawerWidth] = useState<number>(380);
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false);
  const [uiScale, setUiScale] = useState<number>(100);

  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; pageIndex: number; pageTitle: string } | null>(null);
  const [pageToDelete, setPageToDelete] = useState<{ index: number; title: string } | null>(null);
  const [quickPolishText, setQuickPolishText] = useState<string | null>(null);

  const [pageRemarksMap, setPageRemarksMap] = useState<Record<string, string>>({});
  const [isRemarkLoading, setIsRemarkLoading] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    nickname: 'dreamyr',
    emoji: '🎨',
    avatarBg: '#5B8E7D',
  });

  const [aesthetics, setAesthetics] = useState<AestheticsConfig>({
    showWashiTape: true,
    showDateHeader: true,
    showWeather: true,
    showMood: true,
    showRating: true,
    showTimeButton: true,
    showDailyPrompt: true,
    showLibrarianRemark: true,
    ratingSymbol: '☕',
  });

  const [notesWidth, setNotesWidth] = useState<number>(230);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [paperTexture, setPaperTexture] = useState<'plain' | 'margin' | 'dots'>('plain');
  const [stats, setStats] = useState({ words: 0, chars: 0, readTime: 1 });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorHandle>(null);

  const journal = useJournal(lang, vaultConfig, setIsSaving);
  const notesHook = useNotes(lang, vaultConfig, setIsSaving);

  const strings = t[lang];

  useEffect(() => {
    dbService.loadSetting<ThemeMode>('themeMode', 'system').then(setThemeMode);
    dbService.loadSetting<Lang>('lang', 'uk').then(setLang);
    dbService.loadSetting<number>('uiScale', 100).then(setUiScale);
    dbService.loadSetting<UserProfile>('profile', profile).then(setProfile);
    dbService.loadSetting<AestheticsConfig>('aesthetics', aesthetics).then(setAesthetics);
    dbService.loadSetting<SoundPreset>('soundPreset', 'kalimba').then((p) => {
      setSoundPreset(p);
      cozySound.setPreset(p);
    });
    dbService.loadSetting<VaultConfig>('vaultConfig', vaultConfig).then(setVaultConfig);
    dbService.loadSetting<boolean>('aiEnabled', true).then(setAiEnabled);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateDockIcon = async (dark: boolean) => {
      try {
        const iconPath = dark ? logoDark : logoLight;
        const res = await fetch(iconPath);
        const buffer = await res.arrayBuffer();
        await invoke('set_dock_icon', {
          imageBytes: Array.from(new Uint8Array(buffer)),
        });
      } catch {}
    };

    const applyTheme = () => {
      let activeIsDark = false;
      if (themeMode === 'system') {
        activeIsDark = mediaQuery.matches;
      } else {
        activeIsDark = themeMode === 'dark';
      }

      setIsDark(activeIsDark);
      if (activeIsDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      updateDockIcon(activeIsDark);
    };

    applyTheme();

    const listener = () => {
      if (themeMode === 'system') applyTheme();
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [themeMode]);

  useEffect(() => {
    const handleZoomKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        const selected = window.getSelection()?.toString();
        if (selected && selected.trim()) {
          handleAiRewrite(selected.trim());
        } else {
          toggleFlinsAi();
        }
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setUiScale((s) => Math.min(s + 5, 125));
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          setUiScale((s) => Math.max(s - 5, 80));
        } else if (e.key === '0') {
          e.preventDefault();
          setUiScale(100);
        }
      }
    };

    window.addEventListener('keydown', handleZoomKeyDown);
    return () => window.removeEventListener('keydown', handleZoomKeyDown);
  }, [isAiOpen]);

  useEffect(() => {
    const handleGlobalClick = () => setTabContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const toggleTheme = () => {
    let next: ThemeMode = 'system';
    if (themeMode === 'system') next = 'light';
    else if (themeMode === 'light') next = 'dark';
    setThemeMode(next);
    dbService.saveSetting('themeMode', next);
  };

  const toggleFlinsAi = () => {
    cozySound.playClickChime();
    const nextState = !isAiOpen;
    setIsAiOpen(nextState);

    if (nextState) {
      setIsSidebarCollapsed(true);
      setIsNotesCollapsed(true);
    }
  };

  const handleAiRewrite = (selectedText: string) => {
    setQuickPolishText(selectedText);
    setIsAiOpen(true);
    setIsSidebarCollapsed(true);
    setIsNotesCollapsed(true);
    cozySound.playClickChime();
  };

  const getPaperClass = () => {
    if (paperTexture === 'margin') return 'paper-margin-line';
    if (paperTexture === 'dots') return 'paper-dots';
    return '';
  };

  const isJournalMode = activeTab === 'journal';
  const currentPagesList = isJournalMode ? journal.journalPages : (notesHook.currentNote?.pages || []);
  const activePageIndex = isJournalMode ? journal.activePageIndex : (notesHook.currentNote?.activePageIndex || 0);
  const currentPageItem = isJournalMode ? journal.currentPage : notesHook.currentNotePage;
  const currentDocTitle = isJournalMode ? journal.todayFormatted : (notesHook.currentNote?.title || strings.untitledNote);

  const currentPageKey = currentPageItem?.id || 'default';
  const currentLibrarianRemark = pageRemarksMap[currentPageKey];

  // Генерація живої поради на полях аркуша через локальний ШІ
  const handleGeneratePageRemark = async () => {
    if (isRemarkLoading) return;
    cozySound.playClickChime();

    if (!aiEnabled) {
      const remark = getRandomLibrarianRemark();
      setPageRemarksMap((prev) => ({ ...prev, [currentPageKey]: remark }));
      return;
    }

    setIsRemarkLoading(true);
    try {
      const rawPageText = JSON.stringify(currentPageItem?.content || []);
      const remark = await generateMarginRemark(
        rawPageText,
        journal.selectedDate.toISOString().split('T')[0],
        journal.metadata,
        apiUrl,
        lang
      );
      setPageRemarksMap((prev) => ({ ...prev, [currentPageKey]: remark }));
    } catch {
      const remark = getRandomLibrarianRemark();
      setPageRemarksMap((prev) => ({ ...prev, [currentPageKey]: remark }));
    } finally {
      setIsRemarkLoading(false);
    }
  };

  const handleMoveTextToPage = (text: string, targetSheetNum: number) => {
    const targetIdx = targetSheetNum - 1;

    if (isJournalMode) {
      const currentPages = [...journal.journalPages];
      while (currentPages.length < targetSheetNum) {
        const nextNum = currentPages.length + 1;
        currentPages.push({
          id: `page-${Date.now()}-${nextNum}`,
          title: `${strings.sheet} ${nextNum}`,
          isFavorite: false,
          content: [],
        });
      }

      const targetPage = currentPages[targetIdx];
      const newBlock = { type: "paragraph", content: text };
      targetPage.content = [...(targetPage.content || []), newBlock];

      journal.journalPages = currentPages;
      journal.setActivePageIndex(targetIdx);
      journal.saveContent(targetPage.content);
    } else if (notesHook.currentNote) {
      while (notesHook.currentNote.pages.length < targetSheetNum) {
        notesHook.addNewPageToCurrentNote();
      }
      setTimeout(() => {
        notesHook.setActivePageIndexForNote(targetIdx);
        editorRef.current?.insertTimestamp(text);
      }, 50);
    }
  };

  const handleConfirmDeletePage = () => {
    if (!pageToDelete) return;
    if (isJournalMode) {
      journal.deletePage(pageToDelete.index);
    } else {
      notesHook.deletePageFromCurrentNote(pageToDelete.index);
    }
    setPageToDelete(null);
  };

  const handleInsertTimestamp = (timeText: string) => {
    editorRef.current?.insertTimestamp(timeText);
  };

  const handleInsertAiText = (text: string) => {
    editorRef.current?.insertTimestamp(text);
  };

  const getAdaptiveDateString = () => {
    const d = journal.selectedDate;
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const shortYear = String(year).slice(-2);

    const monthShort = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
      month: 'short',
    }).format(d);

    return {
      medium: `${day} ${monthShort} ${year}`,
      compact: `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${shortYear}`
    };
  };

  const dateFormats = getAdaptiveDateString();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cozy-bg dark:bg-night-bg text-cozy-text dark:text-night-text transition-colors duration-200">
      {/* 1. Лівий Сайдбар */}
      <aside
        className={`flex flex-col justify-between bg-cozy-surface dark:bg-night-surface border-r border-cozy-border dark:border-night-border p-3 transition-all duration-300 select-none flex-shrink-0 ${
          isSidebarCollapsed ? 'w-16 items-center' : 'w-60'
        }`}
      >
        <div className="w-full">
          <div className={`flex items-center mb-6 px-1 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5">
              <img
                src={isDark ? logoDarkTransparent : logoLightTransparent}
                alt="Flins Logo"
                className="w-7 h-7 object-contain drop-shadow-xs transition-transform hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              {!isSidebarCollapsed && (
                <h1 className="text-lg font-serif font-bold tracking-wide text-cozy-text dark:text-night-text">
                  Flins
                </h1>
              )}
            </div>

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg text-cozy-muted dark:text-night-muted hover:bg-cozy-bg dark:hover:bg-night-card transition-colors cursor-pointer"
              title={isSidebarCollapsed ? "Expand" : "Collapse"}
            >
              {isSidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

          <nav className="space-y-1.5 w-full">
            <button
              onClick={() => setActiveTab('journal')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'journal'
                  ? 'bg-cozy-card dark:bg-night-card text-cozy-accent dark:text-night-accent shadow-xs'
                  : 'text-cozy-muted dark:text-night-muted hover:bg-cozy-card/50 dark:hover:bg-night-card/50'
              } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={strings.journal}
            >
              <BookOpen size={18} />
              {!isSidebarCollapsed && <span>{strings.journal}</span>}
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-cozy-card dark:bg-night-card text-cozy-accent dark:text-night-accent shadow-xs'
                  : 'text-cozy-muted dark:text-night-muted hover:bg-cozy-card/50 dark:hover:bg-night-card/50'
              } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={strings.notes}
            >
              <FolderClosed size={18} />
              {!isSidebarCollapsed && <span>{strings.notes}</span>}
            </button>
          </nav>
        </div>

        {/* Низ сайдбара */}
        <div className="w-full space-y-2 pt-3 border-t border-cozy-border/60 dark:border-night-border/60 flex flex-col items-center">
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-cozy-muted hover:bg-cozy-card dark:hover:bg-night-card transition-colors cursor-pointer ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
            title={strings.themeTitle}
          >
            {themeMode === 'system' ? (
              <Monitor size={16} />
            ) : isDark ? (
              <Moon size={16} />
            ) : (
              <Sun size={16} />
            )}
            {!isSidebarCollapsed && (
              <span className="text-xs truncate">
                {themeMode === 'system' ? strings.themeAuto : isDark ? strings.themeDark : strings.themeLight}
              </span>
            )}
          </button>

          <div
            onClick={() => setIsSettingsOpen(true)}
            className={`w-full flex items-center p-1.5 rounded-xl bg-cozy-card dark:bg-night-card border border-cozy-border/60 dark:border-night-border/40 cursor-pointer hover:border-cozy-accent/50 transition-all ${
              isSidebarCollapsed ? 'justify-center' : 'justify-between'
            }`}
            title={strings.settings}
          >
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: profile.avatarBg }}
                className="w-7 h-7 rounded-lg text-white flex items-center justify-center text-sm shadow-xs flex-shrink-0"
              >
                {profile.emoji}
              </span>
              {!isSidebarCollapsed && (
                <span className="text-xs font-semibold text-cozy-text dark:text-night-text truncate max-w-[90px]">
                  {profile.nickname}
                </span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <span className="p-1 text-cozy-muted hover:text-cozy-accent transition-colors">
                <Settings size={14} />
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Шторка папок */}
      {activeTab === 'notes' && (
        <NotesManager
          folders={notesHook.folders}
          notes={notesHook.notes}
          activeNoteId={notesHook.activeNoteId}
          width={notesWidth}
          isCollapsed={isNotesCollapsed}
          onToggleCollapse={() => setIsNotesCollapsed(!isNotesCollapsed)}
          onWidthChange={setNotesWidth}
          onSelectNote={notesHook.setActiveNoteId}
          onCreateNote={notesHook.createNote}
          onCreateFolder={notesHook.createFolder}
          onMoveNote={notesHook.moveNote}
          onDeleteFolder={notesHook.deleteFolder}
          onRenameNote={notesHook.renameNote}
          onRenameFolder={notesHook.renameFolder}
          onDeleteNote={notesHook.deleteNote}
          lang={lang}
        />
      )}

      {/* 3. Головна робоча зона */}
      <main className="flex-1 flex flex-col bg-cozy-bg dark:bg-night-bg transition-all duration-300 overflow-hidden min-w-[500px]">

        {/* Шапка */}
        <header
                  data-tauri-drag-region
                  className={`h-12 border-b border-cozy-border dark:border-night-border flex items-center justify-between px-3 bg-cozy-surface/60 dark:bg-night-surface/30 select-none gap-2 min-w-0 relative overflow-visible ${
                    isCalendarOpen ? 'z-50' : 'z-30'
                  }`}
                >
          {/* Ліва частина */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink overflow-visible">
            {activeTab === 'notes' ? (
              <span className="text-xs font-serif text-cozy-text dark:text-night-text font-medium truncate max-w-[130px]">
                {notesHook.currentNote ? notesHook.currentNote.title : strings.workspace}
              </span>
            ) : (
              <div className="relative flex-shrink-0 overflow-visible">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCalendarOpen((prev) => !prev);
                  }}
                  className={`group flex items-center gap-1.5 text-xs font-serif font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer shadow-xs max-w-[155px] overflow-hidden ${
                    isCalendarOpen
                      ? 'bg-cozy-card dark:bg-night-card border-cozy-accent dark:border-night-accent text-cozy-accent dark:text-night-accent ring-2 ring-cozy-accent/20'
                      : 'bg-cozy-card dark:bg-night-surface text-cozy-accent dark:text-night-accent border-cozy-border/80 dark:border-night-border hover:border-cozy-accent shadow-xs'
                  }`}
                  title={lang === 'uk' ? 'Календар' : 'Calendar'}
                >
                  <Calendar size={13} className="text-cozy-accent dark:text-night-accent flex-shrink-0" />
                  <span className="truncate min-w-0 block">
                    <span className="hidden sm:inline">{dateFormats.medium}</span>
                    <span className="sm:hidden font-mono text-[11px]">{dateFormats.compact}</span>
                  </span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 text-cozy-muted flex-shrink-0 ${
                      isCalendarOpen ? 'rotate-180 text-cozy-accent dark:text-night-accent' : ''
                    }`}
                  />
                </button>

                <CalendarPopover
                  isOpen={isCalendarOpen}
                  onClose={() => setIsCalendarOpen(false)}
                  selectedDate={journal.selectedDate}
                  onSelectDate={(date) => journal.setSelectedDate(date)}
                  getDayMetadata={journal.getDayMetadata}
                  lang={lang}
                />
              </div>
            )}

            {/* Система аркушів */}
            <div className="flex items-center gap-1 min-w-0 max-w-[130px] sm:max-w-[200px] md:max-w-[280px] flex-shrink">
              <div
                className="flex items-center gap-1 overflow-x-auto overflow-y-hidden py-0.5 px-0.5 no-scrollbar scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {currentPagesList.map((page, index) => {
                  const isActive = activePageIndex === index;
                  return (
                    <button
                      key={page.id}
                      ref={(el) => {
                        if (isActive && el) {
                          el.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
                        }
                      }}
                      onClick={() => {
                        if (isJournalMode) {
                          journal.setActivePageIndex(index);
                        } else {
                          notesHook.setActivePageIndexForNote(index);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setTabContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          pageIndex: index,
                          pageTitle: page.title || `${strings.sheet} ${index + 1}`,
                        });
                      }}
                      className={`relative flex-shrink-0 flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg shadow-xs font-semibold'
                          : 'bg-cozy-card dark:bg-night-surface text-cozy-muted dark:text-night-muted hover:bg-cozy-border/50 border border-cozy-border/50 dark:border-transparent'
                      }`}
                      title={`${page.title || `${strings.sheet} ${index + 1}`}`}
                    >
                      <span>{index + 1}</span>
                      {page.isFavorite && (
                        <Star
                          size={9}
                          className="absolute top-0.5 right-0.5 text-amber-400 fill-amber-400 drop-shadow-xs"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  if (isJournalMode) {
                    journal.addNewPage();
                  } else {
                    notesHook.addNewPageToCurrentNote();
                  }
                }}
                className="p-1 h-6 w-6 flex items-center justify-center rounded-md bg-cozy-card dark:bg-night-surface text-cozy-muted hover:text-cozy-accent transition-colors border border-cozy-border/50 dark:border-transparent flex-shrink-0 cursor-pointer"
                title={lang === 'uk' ? 'Новий аркуш' : 'New sheet'}
              >
                <Plus size={13} />
              </button>
            </div>

            <button
              onClick={() => {
                if (isJournalMode) {
                  journal.toggleFavorite();
                } else {
                  notesHook.toggleFavoriteCurrentNotePage();
                }
              }}
              className={`p-1 rounded-md transition-colors flex-shrink-0 cursor-pointer ${
                currentPageItem?.isFavorite
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-cozy-muted hover:text-amber-500'
              }`}
              title="Favorite"
            >
              <Star size={14} className={currentPageItem?.isFavorite ? "fill-amber-400" : ""} />
            </button>
          </div>

          {/* Права частина: збалансована висота h-[28px] для всіх елементів */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* 1. Фактура (іконки збільшено з 12px до 13.5px) */}
            <div className="h-[28px] flex items-center bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-lg p-0.5">
              <button
                onClick={() => setPaperTexture('plain')}
                className={`h-full px-1.5 rounded flex items-center justify-center transition-colors cursor-pointer ${paperTexture === 'plain' ? 'bg-cozy-card dark:bg-night-card text-cozy-accent shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                title="Plain"
              >
                <FileText size={13.5} />
              </button>
              <button
                onClick={() => setPaperTexture('margin')}
                className={`h-full px-1.5 rounded flex items-center justify-center transition-colors cursor-pointer ${paperTexture === 'margin' ? 'bg-cozy-card dark:bg-night-card text-cozy-accent shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                title="Margin"
              >
                <Bookmark size={13.5} />
              </button>
              <button
                onClick={() => setPaperTexture('dots')}
                className={`h-full px-1.5 rounded flex items-center justify-center transition-colors cursor-pointer ${paperTexture === 'dots' ? 'bg-cozy-card dark:bg-night-card text-cozy-accent shadow-xs' : 'text-cozy-muted hover:text-cozy-text'}`}
                title="Dots"
              >
                <Grid size={13.5} />
              </button>
            </div>

            {/* 2. Експорт (іконку збільшено до 13.5px, висота h-[28px]) */}
            <button
              onClick={() => setIsExportOpen(true)}
              className="h-[28px] flex items-center gap-1.5 text-xs font-medium px-2.5 rounded-full bg-cozy-card dark:bg-night-card text-cozy-text dark:text-night-text border border-cozy-border dark:border-night-border hover:text-cozy-accent transition-colors shadow-xs cursor-pointer"
              title={strings.exportTitle}
            >
              <Share2 size={13.5} />
              <span className="hidden md:inline">{strings.exportBtn}</span>
            </button>

            {/* 3. Кнопка Flins AI (висота зменшена до h-[28px], зірка 30px на -top-[3.3px]) */}
            {aiEnabled && (
              <button
                onMouseEnter={() => cozySound.playHoverChime()}
                onClick={toggleFlinsAi}
                className={`group h-[28px] flex items-center justify-center gap-1 text-xs font-medium px-3 rounded-full transition-all duration-200 border cursor-pointer ${
                  isAiOpen
                    ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg border-transparent shadow-xs ring-1 ring-cozy-accent/30'
                    : 'bg-cozy-surface dark:bg-night-surface text-cozy-accent dark:text-night-accent border-cozy-border dark:border-night-border hover:border-cozy-accent shadow-xs'
                }`}
                title={strings.aiHelper}
              >
                <span className="sparkle-wiggle text-[30px] leading-none select-none relative -top-[3.3px] flex items-center justify-center font-bold">
                  ✦
                </span>
                <span className="font-serif tracking-wide font-semibold text-xs leading-none flex items-center">
                  {isAiOpen ? 'AI' : 'Flins AI'}
                </span>
              </button>
            )}
            {/* ОСЬ СЮДИ ВСТАВЛЯЄМО: кнопки з'являться ТІЛЬКИ на Windows! */}
            <WindowControls />
          </div>
        </header>

        {/* Робочий стіл */}
        <div
          ref={scrollContainerRef}
          className="flex-1 p-5 pb-24 overflow-y-auto flex flex-col items-center scroll-smooth transition-all duration-300"
        >
          <div
            style={{
              zoom: `${uiScale}%`,
              minHeight: '680px',
            }}
            className={`w-full flex-shrink-0 bg-cozy-card dark:bg-night-card rounded-2xl p-6 sm:p-8 border border-cozy-border dark:border-night-border shadow-md transition-all duration-300 flex flex-col justify-between relative ${
              isWide ? 'max-w-5xl' : 'max-w-3xl'
            } ${getPaperClass()}`}
          >
            {isJournalMode && aesthetics.showWashiTape && (
              <div className="washi-tape absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-5 rounded-xs transform -rotate-1 pointer-events-none opacity-85 z-10 shadow-xs" />
            )}

            <div className="flex-1 flex flex-col">
              {isJournalMode && (
                <JournalHeader
                  selectedDate={journal.selectedDate}
                  metadata={journal.metadata}
                  aesthetics={aesthetics}
                  isAiOpen={isAiOpen}
                  onUpdateMetadata={journal.updateMetadata}
                  onInsertTimestamp={handleInsertTimestamp}
                  onGenerateAiPrompt={
                    aiEnabled
                      ? async () => {
                          return await generateDailyQuestion(
                            journal.selectedDate.toISOString().split('T')[0],
                            journal.metadata,
                            apiUrl,
                            lang
                          );
                        }
                      : undefined
                  }
                  lang={lang}
                />
              )}

              <ErrorBoundary>
                {currentPageItem && (
                  <Editor
                    ref={editorRef}
                    key={`${currentPageItem.id}-${lang}-${isJournalMode ? (journal.isLoaded ? 'loaded' : 'init') : (notesHook.isLoaded ? 'loaded' : 'init')}`}
                    pageId={currentPageItem.id}
                    initialContent={currentPageItem.content}
                    isDark={isDark}
                    lang={lang}
                    onContentChange={(blocks) => {
                      if (isJournalMode) {
                        journal.saveContent(blocks);
                      } else {
                        notesHook.saveCurrentNotePageContent(blocks);
                      }
                    }}
                    onStatsChange={(w, c, r) => setStats({ words: w, chars: c, readTime: r })}
                    onAiRewrite={handleAiRewrite}
                    onMoveSelectedToSheet={handleMoveTextToPage}
                  />
                )}
              </ErrorBoundary>
            </div>

            {/* Межа аркуша: велика зірка ✦ 37px з орбітальним лоадером під час генерації */}
            <div className="mt-8 pt-3 border-t border-dashed border-cozy-border/60 dark:border-night-border/60 select-none relative">
              <div className="flex items-center justify-between text-[11px] text-cozy-muted/60 dark:text-night-muted/60 relative h-6">
                <span className="font-serif italic tracking-wide truncate max-w-[200px]">
                  {currentDocTitle}
                </span>

                {aesthetics.showLibrarianRemark && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    {isRemarkLoading ? (
                      <AiSparkleLoader lang={lang} size="md" />
                    ) : (
                      <button
                        onClick={handleGeneratePageRemark}
                        className="group relative w-10 h-10 flex items-center justify-center cursor-pointer text-cozy-accent dark:text-night-accent hover:scale-110 transition-transform"
                        title={strings.updateRemarkHint}
                      >
                        <span className="sparkle-wiggle text-[37px] leading-none select-none font-bold pointer-events-none">
                          ✦
                        </span>
                        <span className="opacity-0 group-hover:opacity-90 transition-opacity font-serif italic text-[10px] text-cozy-muted absolute -top-5 whitespace-nowrap pointer-events-none bg-cozy-surface/90 dark:bg-night-surface/90 px-1.5 py-0.5 rounded shadow-xs border border-cozy-border/40">
                          {strings.pageSummaryHint}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                <span className="tracking-widest uppercase text-[9px] flex-shrink-0">
                  {`${strings.sheet} ${activePageIndex + 1}`}
                </span>
              </div>

              {/* Згенерована порада бібліотекаря (ширина max-w-2xl без обрізання) */}
              {aesthetics.showLibrarianRemark && currentLibrarianRemark && (
                <div className="w-full flex justify-center items-center pt-3.5 px-4 sm:px-8 animate-in fade-in duration-200">
                  <p
                    onClick={handleGeneratePageRemark}
                    className="font-serif italic text-xs sm:text-[13px] tracking-wide text-cozy-text/80 dark:text-night-text/80 text-center hover:text-cozy-accent cursor-pointer transition-colors max-w-2xl leading-relaxed"
                    title={strings.updateRemarkHint}
                  >
                    «{currentLibrarianRemark}»
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Статус-бар */}
        <footer className="h-9 border-t border-cozy-border dark:border-night-border bg-cozy-surface/60 dark:bg-night-surface/60 px-4 flex items-center justify-between select-none flex-shrink-0">
          <div className="flex items-center gap-2.5 text-xs text-cozy-muted dark:text-night-muted font-sans">
            <div className="group relative flex items-center justify-center cursor-help text-cozy-muted hover:text-cozy-text dark:hover:text-night-text transition-colors p-1">
              {isSaving ? (
                <RefreshCw size={13} className="animate-spin text-cozy-accent" />
              ) : (
                <CheckCircle2 size={13} className="opacity-50 hover:opacity-100 transition-opacity" />
              )}

              <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute bottom-full left-0 mb-1 px-2 py-0.5 rounded-md bg-cozy-surface dark:bg-night-card border border-cozy-border dark:border-night-border text-[10px] font-sans shadow-md whitespace-nowrap z-50">
                {isSaving ? (lang === 'uk' ? "Збереження..." : "Saving...") : (lang === 'uk' ? "Запис збережено" : "Entry saved")}
              </div>
            </div>

            <span className="opacity-30">•</span>

            <span>☕ {stats.words} {strings.words}</span>
            <span>•</span>
            <span>~{stats.readTime} {strings.readTime}</span>
            <span>•</span>
            <span>{stats.chars} {strings.chars}</span>
          </div>
        </footer>
      </main>

      {/* 4. Шторка Flins AI */}
      <div
        style={{ width: isAiOpen ? `${aiDrawerWidth}px` : '0px' }}
        className="transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] flex-shrink-0 overflow-hidden h-full flex"
      >
        <div style={{ width: `${aiDrawerWidth}px` }} className="h-full flex-shrink-0">
          <FlinsAiDrawer
            isOpen={isAiOpen}
            onClose={() => setIsAiOpen(false)}
            width={aiDrawerWidth}
            onWidthChange={setAiDrawerWidth}
            metadata={journal.metadata}
            currentDocTitle={currentDocTitle}
            currentDocContent={JSON.stringify(currentPageItem?.content || [])}
            quickPolishText={quickPolishText}
            onClearQuickPolish={() => setQuickPolishText(null)}
            onInsertIntoEditor={handleInsertAiText}
            apiUrl={apiUrl}
            lang={lang}
          />
        </div>
      </div>

      {/* ПКМ Меню видалення */}
      {tabContextMenu && (
        <div
          style={{ top: `${tabContextMenu.y}px`, left: `${tabContextMenu.x}px` }}
          className="fixed z-50 bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-xl shadow-xl p-1 min-w-[170px] select-none animate-cozy-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (currentPagesList.length <= 1) {
                alert(lang === 'uk' ? 'Неможливо видалити єдиний аркуш документа!' : 'Cannot delete the only sheet!');
              } else {
                setPageToDelete({ index: tabContextMenu.pageIndex, title: tabContextMenu.pageTitle });
              }
              setTabContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors font-medium text-left cursor-pointer"
          >
            <Trash2 size={13} />
            <span>{lang === 'uk' ? 'Видалити цей аркуш' : 'Delete this sheet'}</span>
          </button>
        </div>
      )}

      {/* Діалог підтвердження */}
      <ConfirmModal
        isOpen={pageToDelete !== null}
        title={lang === 'uk' ? `Видалити ${pageToDelete?.title}?` : `Delete ${pageToDelete?.title}?`}
        message={
          lang === 'uk'
            ? 'Усі записи та текст на цьому аркуші будуть безповоротно видалені. Продовжити?'
            : 'All text and notes on this sheet will be permanently lost. Are you sure?'
        }
        confirmText={lang === 'uk' ? 'Так, видалити' : 'Yes, delete'}
        cancelText={lang === 'uk' ? 'Скасувати' : 'Cancel'}
        onConfirm={handleConfirmDeletePage}
        onClose={() => setPageToDelete(null)}
      />

      {/* Налаштування */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        lang={lang}
        onLangChange={(l) => {
          setLang(l);
          dbService.saveSetting('lang', l);
        }}
        isWide={isWide}
        onToggleWide={setIsWide}
        apiUrl={apiUrl}
        onApiUrlChange={setApiUrl}
        profile={profile}
        onProfileChange={(p) => {
          setProfile(p);
          dbService.saveSetting('profile', p);
        }}
        aesthetics={aesthetics}
        onAestheticsChange={(a) => {
          setAesthetics(a);
          dbService.saveSetting('aesthetics', a);
        }}
        uiScale={uiScale}
        onUiScaleChange={(s) => {
          setUiScale(s);
          dbService.saveSetting('uiScale', s);
        }}
        themeMode={themeMode}
        onThemeModeChange={(m) => {
          setThemeMode(m);
          dbService.saveSetting('themeMode', m);
        }}
        soundPreset={soundPreset}
        onSoundPresetChange={(p) => {
          setSoundPreset(p);
          cozySound.setPreset(p);
          dbService.saveSetting('soundPreset', p);
        }}
        vaultConfig={vaultConfig}
        onVaultConfigChange={(v) => {
          setVaultConfig(v);
          dbService.saveSetting('vaultConfig', v);
        }}
        aiEnabled={aiEnabled}
        onAiEnabledChange={(v) => {
          setAiEnabled(v);
          dbService.saveSetting('aiEnabled', v);
          if (!v) setIsAiOpen(false);
        }}
      />

      {/* Експорт */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        lang={lang}
        documentTitle={currentDocTitle}
        currentPageContent={currentPageItem?.content || []}
        allPages={currentPagesList}
      />
    </div>
  );
}
