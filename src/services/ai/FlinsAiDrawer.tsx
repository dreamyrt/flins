import { useState, useRef, useEffect } from 'react';
import {
  X, Feather, Archive, ArrowDownToLine, SlidersHorizontal,
  Send, BookOpen, CalendarRange, Calendar as CalendarIcon, Wand2, Square, ChevronDown, ChevronRight, Brain
} from 'lucide-react';
import { Lang, t } from '../i18n';
import { DayMetadata } from '../../hooks/useJournal';
import {
  ToneType,
  streamChatWithLibrarian,
  streamPolishText,
  generateChronicle,
  getRecentMemoryContext,
  sanitizeUserText
} from './aiService';
import AiSparkleLoader from '../../components/common/AiSparkleLoader';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  reasoning?: string;
  isReasoningExpanded?: boolean;
  tone?: ToneType;
}

interface FlinsAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
  metadata?: DayMetadata;
  currentDocTitle?: string;
  currentDocContent?: string;
  quickPolishText?: string | null;
  onClearQuickPolish?: () => void;
  onInsertIntoEditor: (text: string) => void;
  apiUrl?: string;
  lang: Lang;
}

export default function FlinsAiDrawer({
  onClose,
  width,
  onWidthChange,
  metadata,
  currentDocTitle,
  currentDocContent,
  quickPolishText,
  onClearQuickPolish,
  onInsertIntoEditor,
  apiUrl = 'http://127.0.0.1:1234/v1',
  lang,
}: FlinsAiDrawerProps) {
  const [activeTab, setActiveTab] = useState<'quill' | 'archive'>('quill');
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState<ToneType>('cozy');
  const [useContext, setUseContext] = useState(true);
  const [rememberPastDays, setRememberPastDays] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const isResizingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const strings = t[lang];

  const TONES: { id: ToneType; emoji: string; title: string; desc: string }[] = [
    { id: 'cozy', emoji: '☕', title: strings.toneCozy, desc: strings.toneCozyDesc },
    { id: 'philosophical', emoji: '🕯️', title: strings.tonePhil, desc: strings.tonePhilDesc },
    { id: 'pragmatic', emoji: '⚡', title: strings.tonePrag, desc: strings.tonePragDesc },
    { id: 'humorous', emoji: '🥐', title: strings.toneHumor, desc: strings.toneHumorDesc },
  ];

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: strings.aiWelcome,
      },
    ]);
  }, [lang]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const maxAllowedWidth = Math.min(620, Math.max(320, window.innerWidth - 520));
      const targetWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.min(Math.max(targetWidth, 300), maxAllowedWidth);
      onWidthChange(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onWidthChange]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (quickPolishText) {
      setInputText(quickPolishText);
      setActiveTab('quill');
      setShowConfig(true);
    }
  }, [quickPolishText]);

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleSend = async () => {
    const clean = sanitizeUserText(inputText);
    if (!clean || isStreaming) return;

    const userText = clean;
    setInputText('');
    if (onClearQuickPolish) onClearQuickPolish();

    const assistantMsgId = `asst-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text: userText },
      { id: assistantMsgId, sender: 'assistant', text: '', reasoning: '', isReasoningExpanded: false, tone: selectedTone },
    ]);

    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const memories = rememberPastDays ? await getRecentMemoryContext(new Date().toISOString().split('T')[0], 2) : [];

    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ sender: m.sender, text: m.text }));

    await streamChatWithLibrarian(
      history,
      userText,
      selectedTone,
      metadata,
      useContext,
      rememberPastDays,
      memories,
      {
        onReasoningChunk: (rChunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, reasoning: (msg.reasoning || '') + rChunk } : msg
            )
          );
        },
        onChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: msg.text + chunk } : msg
            )
          );
        },
        onComplete: (finalContent, finalReasoning) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: finalContent || finalReasoning } : msg
            )
          );
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: `⚠️ ${err.message}` } : msg
            )
          );
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
      },
      controller.signal,
      apiUrl,
      lang
    );
  };

  const handleQuickPolish = async (mode: 'literary' | 'concise' | 'fix') => {
    const clean = sanitizeUserText(inputText);
    if (!clean || isStreaming) return;

    const targetText = clean;
    setInputText('');
    if (onClearQuickPolish) onClearQuickPolish();

    const assistantMsgId = `asst-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text: targetText },
      { id: assistantMsgId, sender: 'assistant', text: '' },
    ]);

    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    await streamPolishText(
      targetText,
      mode,
      {
        onChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: msg.text + chunk } : msg
            )
          );
        },
        onComplete: (content) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, text: content } : msg))
          );
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: `⚠️ ${err.message}` } : msg
            )
          );
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
      },
      controller.signal,
      apiUrl,
      lang
    );
  };

  const handleChronicleAction = async (type: 'note_summary' | 'weekly' | 'monthly') => {
    const assistantMsgId = `asst-${Date.now()}`;
    const titles = {
      note_summary: strings.aiNoteSummary,
      weekly: strings.aiWeekly,
      monthly: strings.aiMonthly,
    };

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text: titles[type] },
      { id: assistantMsgId, sender: 'assistant', text: '' },
    ]);

    setIsStreaming(true);
    const textToAnalyze = sanitizeUserText(currentDocContent || '') || currentDocTitle || '';

    await generateChronicle(
      type,
      textToAnalyze,
      {
        onChunk: (token) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: msg.text + token } : msg
            )
          );
        },
        onComplete: (full) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, text: full } : msg))
          );
          setIsStreaming(false);
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: `⚠️ ${err.message}` } : msg
            )
          );
          setIsStreaming(false);
        },
      },
      apiUrl,
      lang
    );
  };

  const toggleReasoning = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, isReasoningExpanded: !m.isReasoningExpanded } : m
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className={`relative flex-shrink-0 h-full bg-cozy-surface dark:bg-night-surface border-l border-cozy-border dark:border-night-border flex flex-col justify-between shadow-2xl z-40 ${
        isResizing ? 'transition-none' : 'transition-[width] duration-150'
      }`}
    >
      <div
        onMouseDown={startResizing}
        className="absolute top-0 -left-1.5 w-3 h-full cursor-col-resize hover:bg-cozy-accent/30 dark:hover:bg-night-accent/30 transition-colors z-50 select-none"
        title="Resize"
      />

      {/* 1. Шапка (select-none) */}
      <div className="select-none">
        <div className="p-3 border-b border-cozy-border/60 dark:border-night-border/60 flex items-center justify-between bg-cozy-surface/70 dark:bg-night-surface/70">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-cozy-accent/15 dark:bg-night-accent/20 text-cozy-accent dark:text-night-accent flex items-center justify-center select-none shadow-xs flex-shrink-0">
              <span className="text-[26px] leading-none relative -top-[1.5px] font-bold">✦</span>
            </span>
            <div>
              <h3 className="text-xs font-serif font-bold text-cozy-text dark:text-night-text tracking-wide">
                Flins AI
              </h3>
              <p className="text-[10px] text-cozy-muted font-sans">
                {strings.aiLibrarian}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-1.5 rounded-lg border transition-all ${
                showConfig
                  ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg border-transparent'
                  : 'text-cozy-muted hover:text-cozy-text border-cozy-border/60 dark:border-night-border/60 hover:bg-cozy-card dark:hover:bg-night-card'
              }`}
              title={strings.aiAtmosphere}
            >
              <SlidersHorizontal size={13} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-cozy-muted hover:text-cozy-text dark:hover:text-night-text hover:bg-cozy-card dark:hover:bg-night-card transition-colors"
              title={strings.close}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* НАЛАШТУВАННЯ ТОНУ ТА ПАМ'ЯТІ */}
        {showConfig && (
          <div className="p-3 bg-cozy-card dark:bg-night-card border-b border-cozy-border/60 dark:border-night-border/60 space-y-2 animate-cozy-pop select-none">
            <div className="text-center text-[10px] font-semibold text-cozy-muted uppercase tracking-widest">
              {strings.aiAtmosphere}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {TONES.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setSelectedTone(tone.id)}
                  className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs text-left transition-all ${
                    selectedTone === tone.id
                      ? 'bg-cozy-surface dark:bg-night-surface border-cozy-accent dark:border-night-accent shadow-xs'
                      : 'border-cozy-border/40 hover:border-cozy-accent/40 text-cozy-muted'
                  }`}
                >
                  <span>{tone.emoji}</span>
                  <span className="font-medium text-cozy-text dark:text-night-text">{tone.title}</span>
                </button>
              ))}
            </div>

            <div className="pt-1.5 border-t border-cozy-border/40 dark:border-night-border/40 space-y-1">
              <label className="flex items-center gap-2 text-[11px] text-cozy-muted cursor-pointer hover:text-cozy-text select-none">
                <input
                  type="checkbox"
                  checked={useContext}
                  onChange={(e) => setUseContext(e.target.checked)}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span className="truncate">
                  {strings.aiIncludeContext
                    .replace('{mood}', metadata?.mood || '—')
                    .replace('{weather}', metadata?.weather || '—')}
                </span>
              </label>

              <label className="flex items-center gap-2 text-[11px] text-cozy-muted cursor-pointer hover:text-cozy-text select-none">
                <input
                  type="checkbox"
                  checked={rememberPastDays}
                  onChange={(e) => setRememberPastDays(e.target.checked)}
                  className="rounded accent-cozy-accent cursor-pointer"
                />
                <span className="truncate font-medium text-cozy-text/80 dark:text-night-text/80">
                  {strings.aiMemoryCheckbox}
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 2. ЧАТ: ПОВНЕ ВИДІЛЕННЯ ТА КОПІЮВАННЯ ТЕКСТУ (select-text) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans select-text selection:bg-cozy-accent/20 selection:text-cozy-text dark:selection:bg-night-accent/30 dark:selection:text-night-text">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-6 h-6 rounded-lg bg-cozy-accent/15 dark:bg-night-accent/20 text-cozy-accent dark:text-night-accent flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-serif font-bold select-none">
                ✦
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-2.5 text-xs leading-relaxed select-text ${
                msg.sender === 'user'
                  ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg font-medium shadow-xs'
                  : 'bg-cozy-card dark:bg-night-card border border-cozy-border/60 dark:border-night-border/60 text-cozy-text dark:text-night-text shadow-xs'
              }`}
            >
              {/* Спойлер роздумів моделі */}
              {msg.reasoning && (
                <div className="mb-2 pb-1.5 border-b border-cozy-border/40 dark:border-night-border/40 select-none">
                  <button
                    onClick={() => toggleReasoning(msg.id)}
                    className="flex items-center gap-1.5 text-[10px] text-cozy-muted hover:text-cozy-accent font-mono uppercase tracking-wider py-0.5 cursor-pointer"
                  >
                    <Brain size={11} className="text-cozy-accent" />
                    <span>{strings.aiThinkingProcess}</span>
                    {msg.isReasoningExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>

                  {msg.isReasoningExpanded && (
                    <div className="mt-1 p-2 rounded-lg bg-cozy-surface/60 dark:bg-night-surface/60 text-[10px] font-mono text-cozy-muted leading-normal whitespace-pre-wrap max-h-36 overflow-y-auto border border-cozy-border/40 select-text">
                      {msg.reasoning}
                    </div>
                  )}
                </div>
              )}

              {/* Очікування відповіді: Орбітальні зірки */}
              {isStreaming && msg.sender === 'assistant' && !msg.text && !msg.reasoning ? (
                <div className="px-2 py-1 flex items-center justify-center select-none">
                  <AiSparkleLoader lang={lang} size="sm" />
                </div>
              ) : (
                <p className={`select-text cursor-text ${msg.sender === 'assistant' ? 'font-serif whitespace-pre-wrap' : 'whitespace-pre-wrap'}`}>
                  {msg.text}
                </p>
              )}

              {msg.sender === 'assistant' && msg.id !== 'welcome' && msg.text && !isStreaming && (
                <div className="mt-2 pt-1.5 border-t border-cozy-border/40 dark:border-night-border/40 flex justify-end select-none">
                  <button
                    onClick={() => onInsertIntoEditor(msg.text)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cozy-surface dark:bg-night-surface hover:text-cozy-accent text-[10px] font-sans font-medium text-cozy-muted transition-colors cursor-pointer"
                  >
                    <ArrowDownToLine size={11} />
                    <span>{strings.aiInsertToPage}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Зона вводу та Хроніка (select-none) */}
      <div className="p-3 border-t border-cozy-border/60 dark:border-night-border/60 bg-cozy-surface/60 dark:bg-night-surface/60 space-y-2 select-none">
        {activeTab === 'quill' ? (
          <>
            {inputText.trim() && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
                <span className="text-cozy-muted flex items-center gap-1 font-mono uppercase">
                  <Wand2 size={10} /> {strings.aiPolish}
                </span>
                <button
                  onClick={() => handleQuickPolish('literary')}
                  disabled={isStreaming}
                  className="px-2 py-0.5 rounded-md bg-cozy-card dark:bg-night-card hover:bg-cozy-accent hover:text-white border border-cozy-border/60 transition-colors disabled:opacity-40"
                >
                  {strings.aiLiterary}
                </button>
                <button
                  onClick={() => handleQuickPolish('concise')}
                  disabled={isStreaming}
                  className="px-2 py-0.5 rounded-md bg-cozy-card dark:bg-night-card hover:bg-cozy-accent hover:text-white border border-cozy-border/60 transition-colors disabled:opacity-40"
                >
                  {strings.aiConcise}
                </button>
                <button
                  onClick={() => handleQuickPolish('fix')}
                  disabled={isStreaming}
                  className="px-2 py-0.5 rounded-md bg-cozy-card dark:bg-night-card hover:bg-cozy-accent hover:text-white border border-cozy-border/60 transition-colors disabled:opacity-40"
                >
                  {strings.aiFix}
                </button>
              </div>
            )}

            <div className="relative flex items-center">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={strings.aiInputPlaceholder}
                className="w-full text-xs font-sans bg-cozy-card dark:bg-night-card border border-cozy-border dark:border-night-border rounded-xl pl-3 pr-10 py-2.5 text-cozy-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-cozy-accent resize-none placeholder:text-cozy-muted/60 leading-relaxed select-text"
              />

              {isStreaming ? (
                <button
                  onClick={handleStopStreaming}
                  className="absolute right-2 p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all cursor-pointer shadow-xs"
                  title="Зупинити"
                >
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="absolute right-2 p-1.5 rounded-lg bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg disabled:opacity-30 hover:scale-105 transition-all cursor-pointer shadow-xs"
                  title="Send"
                >
                  <Send size={13} />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-1.5 py-1">
            <span className="text-[10px] font-semibold text-cozy-muted uppercase tracking-wider block">
              {strings.aiArchiveTitle}
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={() => handleChronicleAction('note_summary')}
                disabled={isStreaming}
                className="flex items-center gap-2 p-2 rounded-xl bg-cozy-card dark:bg-night-card border border-cozy-border/60 dark:border-night-border/60 hover:border-cozy-accent text-xs text-left transition-colors"
              >
                <BookOpen size={13} className="text-cozy-accent dark:text-night-accent flex-shrink-0" />
                <div>
                  <span className="font-semibold block text-cozy-text dark:text-night-text">{strings.aiNoteSummary}</span>
                  <span className="text-[10px] text-cozy-muted">{strings.aiNoteSummarySub}</span>
                </div>
              </button>

              <button
                onClick={() => handleChronicleAction('weekly')}
                disabled={isStreaming}
                className="flex items-center gap-2 p-2 rounded-xl bg-cozy-card dark:bg-night-card border border-cozy-border/60 dark:border-night-border/60 hover:border-cozy-accent text-xs text-left transition-colors"
              >
                <CalendarRange size={13} className="text-cozy-accent dark:text-night-accent flex-shrink-0" />
                <div>
                  <span className="font-semibold block text-cozy-text dark:text-night-text">{strings.aiWeekly}</span>
                  <span className="text-[10px] text-cozy-muted">{strings.aiWeeklySub}</span>
                </div>
              </button>

              <button
                onClick={() => handleChronicleAction('monthly')}
                disabled={isStreaming}
                className="flex items-center gap-2 p-2 rounded-xl bg-cozy-card dark:bg-night-card border border-cozy-border/60 dark:border-night-border/60 hover:border-cozy-accent text-xs text-left transition-colors"
              >
                <CalendarIcon size={13} className="text-cozy-accent dark:text-night-accent flex-shrink-0" />
                <div>
                  <span className="font-semibold block text-cozy-text dark:text-night-text">{strings.aiMonthly}</span>
                  <span className="text-[10px] text-cozy-muted">{strings.aiMonthlySub}</span>
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 bg-cozy-card dark:bg-night-card p-1 rounded-xl border border-cozy-border/60 dark:border-night-border/60">
          <button
            onClick={() => setActiveTab('quill')}
            className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'quill'
                ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg shadow-xs font-semibold'
                : 'text-cozy-muted hover:text-cozy-text'
            }`}
          >
            <Feather size={12} />
            <span>{strings.aiTabQuill}</span>
          </button>

          <button
            onClick={() => setActiveTab('archive')}
            className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'archive'
                ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg shadow-xs font-semibold'
                : 'text-cozy-muted hover:text-cozy-text'
            }`}
          >
            <Archive size={12} />
            <span>{strings.aiTabArchive}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
