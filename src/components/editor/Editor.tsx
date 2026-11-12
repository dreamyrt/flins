import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { BlockNoteSchema, defaultStyleSpecs } from "@blocknote/core";
import {
  createReactStyleSpec,
  FormattingToolbar,
  FormattingToolbarController,
  SideMenuController,
  BlockTypeSelect,
  BasicTextStyleButton,
  TextAlignButton,
  ColorStyleButton,
  CreateLinkButton,
  useBlockNoteEditor,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { FileUp, X } from "lucide-react";
import { Lang } from "../../services/i18n";

// Стиль для кастомних шрифтів
const FontStyle = createReactStyleSpec(
  {
    type: "font",
    propSchema: "string",
  },
  {
    render: (props) => (
      <span style={{ fontFamily: props.value }} ref={props.contentRef} />
    ),
  }
);

// Фірмовий стиль для значка часу: піднятий вгору, збільшений (1.35em) і розтягнутий вертикально (scaleY 1.18)
const TimeIconStyle = createReactStyleSpec(
  {
    type: "timeIcon",
    propSchema: "boolean",
  },
  {
    render: (props) => (
      <span
        style={{
          display: "inline-block",
          fontSize: "1.35em",
          transform: "scaleY(1.18)", // Вертикальне розтягування пісочного годинника
          verticalAlign: "-0.05em",   // Піднято вгору, щоб стояти строго врівень із цифрами
          marginRight: "0.22em",
          lineHeight: 1,
        }}
        className="font-bold text-cozy-accent dark:text-night-accent drop-shadow-xs"
        ref={props.contentRef}
      />
    ),
  }
);

const schema = BlockNoteSchema.create({
  styleSpecs: {
    ...defaultStyleSpecs,
    font: FontStyle,
    timeIcon: TimeIconStyle,
  },
});

function AiRewriteButton({ onRewrite, lang }: { onRewrite?: (text: string) => void; lang: Lang }) {
  const editor = useBlockNoteEditor();

  const handleRewriteClick = () => {
    const selected = editor.getSelectedText();
    if (selected && selected.trim() && onRewrite) {
      onRewrite(selected.trim());
    }
  };

  return (
    <button
      onClick={handleRewriteClick}
      className="ai-shimmer-btn flex items-center justify-center w-7 h-7 rounded text-cozy-accent dark:text-night-accent hover:scale-110 transition-transform border border-cozy-accent/30 dark:border-night-accent/40 cursor-pointer"
      title={lang === 'uk' ? 'Перефразувати через Flins AI' : 'Rewrite with Flins AI'}
    >
      <span className="star-glyph text-[24px] leading-none select-none relative -top-[1.5px] font-bold">✦</span>
    </button>
  );
}

function MoveToSheetButton({ onMoveRequest, lang }: { onMoveRequest: (e: React.MouseEvent) => void; lang: Lang }) {
  return (
    <button
      onClick={onMoveRequest}
      className="flex items-center justify-center w-7 h-7 rounded hover:bg-cozy-surface dark:hover:bg-night-surface text-cozy-text dark:text-night-text transition-colors p-1 cursor-pointer"
      title={lang === 'uk' ? 'Перенести на інший аркуш' : 'Move to sheet'}
    >
      <FileUp size={15} />
    </button>
  );
}

function CustomFontSelect({ lang }: { lang: Lang }) {
  const editor = useBlockNoteEditor<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >();

  const fonts = [
    { label: lang === 'uk' ? "Книжковий (Lora)" : "Bookish (Lora)", value: "'Lora', serif" },
    { label: lang === 'uk' ? "Рукопис (Caveat)" : "Handwriting (Caveat)", value: "'Caveat', cursive" },
    { label: lang === 'uk' ? "Друкарка (Mono)" : "Typewriter (Mono)", value: "'JetBrains Mono', monospace" },
    { label: lang === 'uk' ? "Сучасний (Sans)" : "Modern (Sans)", value: "'Plus Jakarta Sans', sans-serif" },
  ];

  return (
    <select
      aria-label="Font Selection"
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "default") {
          editor.removeStyles({ font: "" });
        } else if (val) {
          editor.addStyles({ font: val });
        }
      }}
      defaultValue=""
      className="text-xs bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded px-1.5 py-1 text-cozy-text dark:text-night-text cursor-pointer focus:outline-none"
    >
      <option value="" disabled>{lang === 'uk' ? 'Шрифт...' : 'Font...'}</option>
      <option value="default">{lang === 'uk' ? 'Стандартний' : 'Default'}</option>
      {fonts.map((f) => (
        <option key={f.value} value={f.value}>
          {f.label}
        </option>
      ))}
    </select>
  );
}

export interface EditorHandle {
  insertTimestamp: (timeText: string) => void;
}

interface EditorProps {
  isDark: boolean;
  pageId: string;
  initialContent?: any[];
  lang: Lang;
  onContentChange: (blocks: any[]) => void;
  onStatsChange: (words: number, chars: number, readTime: number) => void;
  onAiRewrite?: (text: string) => void;
  onMoveSelectedToSheet?: (text: string, targetSheetNum: number) => void;
}

const Editor = forwardRef<EditorHandle, EditorProps>(({
  isDark,
  pageId,
  initialContent,
  lang,
  onContentChange,
  onStatsChange,
  onAiRewrite,
  onMoveSelectedToSheet,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const clickTimeoutRef = useRef<number | null>(null);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [modalCoords, setModalCoords] = useState<{ x: number; y: number } | null>(null);
  const [targetSheetInput, setTargetSheetInput] = useState('');

  const calculateStats = (blocks: any[]) => {
    let fullText = "";
    for (const block of blocks) {
      if (block.content && Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item.type === "text") fullText += item.text + " ";
        }
      }
    }
    const trimmed = fullText.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const chars = trimmed.length;
    const readTime = Math.max(1, Math.ceil(words / 200));
    onStatsChange(words, chars, readTime);
  };

  const defaultContent = [
    {
      type: "paragraph",
      content: lang === "uk" ? "Почніть писати тут..." : "Start writing here...",
    },
  ];

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent && initialContent.length > 0 ? initialContent : defaultContent,
  });

  useImperativeHandle(ref, () => ({
    insertTimestamp: (timeText: string) => {
      const cursor = editor.getTextCursorPosition();
      const cleanTime = timeText.replace(/^[⧗\s]+/, '').trim();

      const inlineContent: any[] = [
        { type: "text", text: "⧗", styles: { timeIcon: true } },
        { type: "text", text: ` ${cleanTime} `, styles: {} },
      ];

      if (cursor && cursor.block) {
        try {
          editor.insertInlineContent(inlineContent);
          editor.focus();
          return;
        } catch {
          editor.insertBlocks(
            [{ type: "paragraph", content: inlineContent }],
            cursor.block,
            "after"
          );
        }
      } else {
        const lastBlock = editor.document[editor.document.length - 1];
        editor.insertBlocks(
          [{ type: "paragraph", content: inlineContent }],
          lastBlock,
          "after"
        );
      }
      editor.focus();
    },
  }));

  const handleOpenMoveDialog = (e: React.MouseEvent) => {
    const selected = editor.getSelectedText();
    if (selected && selected.trim()) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const posX = Math.min(Math.max(rect.left - 100, 20), window.innerWidth - 320);
      const posY = Math.min(rect.bottom + 10, window.innerHeight - 180);
      setModalCoords({ x: posX, y: posY });
      setIsMoveModalOpen(true);
      setTargetSheetInput('');
    }
  };

  const handleConfirmMove = () => {
    const sheetNum = parseInt(targetSheetInput.trim(), 10);
    if (!isNaN(sheetNum) && sheetNum > 0 && onMoveSelectedToSheet) {
      const selected = editor.getSelectedText();
      if (selected && selected.trim()) {
        onMoveSelectedToSheet(selected.trim(), sheetNum);

        try {
          const tiptap = (editor as any)._tiptapEditor;
          if (tiptap && typeof tiptap.commands?.deleteSelection === 'function') {
            tiptap.commands.deleteSelection();
          } else {
            const domSelection = window.getSelection();
            if (domSelection && domSelection.rangeCount > 0) {
              const range = domSelection.getRangeAt(0);
              range.deleteContents();
            }
          }

          setTimeout(() => {
            onContentChange(editor.document);
            calculateStats(editor.document);
          }, 10);
        } catch (err) {
          console.warn('Не вдалося очистити виділення:', err);
        }
      }
      setIsMoveModalOpen(false);
    }
  };

  const CustomToolbar = () => (
    <FormattingToolbar>
      <BlockTypeSelect key="blockTypeSelect" />
      <CustomFontSelect key="fontSelect" lang={lang} />
      <AiRewriteButton key="aiRewrite" onRewrite={onAiRewrite} lang={lang} />
      <MoveToSheetButton key="moveToSheet" onMoveRequest={handleOpenMoveDialog} lang={lang} />
      <BasicTextStyleButton basicTextStyle="bold" key="boldStyleButton" />
      <BasicTextStyleButton basicTextStyle="italic" key="italicStyleButton" />
      <BasicTextStyleButton basicTextStyle="underline" key="underlineStyleButton" />
      <BasicTextStyleButton basicTextStyle="strike" key="strikeStyleButton" />
      <TextAlignButton textAlignment="left" key="textAlignLeftButton" />
      <TextAlignButton textAlignment="center" key="textAlignCenterButton" />
      <TextAlignButton textAlignment="right" key="textAlignRightButton" />
      <ColorStyleButton key="colorStyleButton" />
      <CreateLinkButton key="createLinkButton" />
    </FormattingToolbar>
  );

  const handleCanvasInteraction = (clientX: number, clientY: number, isDoubleClick: boolean) => {
    const editorEl = containerRef.current?.querySelector('.bn-editor');
    if (!editorEl) {
      editor.focus();
      return;
    }

    const renderedBlocks = editorEl.querySelectorAll('[data-id]');
    const lastBlockDom = renderedBlocks.length > 0
      ? renderedBlocks[renderedBlocks.length - 1]
      : editorEl.lastElementChild;

    const lastDocBlock = editor.document[editor.document.length - 1];
    if (!lastDocBlock) {
      editor.focus();
      return;
    }

    const lastRect = lastBlockDom
      ? lastBlockDom.getBoundingClientRect()
      : editorEl.getBoundingClientRect();

    if (clientY > lastRect.bottom + 6) {
      const diffY = clientY - lastRect.bottom;
      const lineHeight = 28;
      const linesToAdd = Math.max(1, Math.floor(diffY / lineHeight));

      const newBlocks: any[] = [];
      for (let i = 0; i < linesToAdd - 1; i++) {
        newBlocks.push({ type: "paragraph", content: "" });
      }

      if (isDoubleClick) {
        const editorLeft = lastRect.left;
        const diffX = Math.max(0, clientX - editorLeft);
        const charWidth = 8.5;
        const spacesCount = Math.min(Math.floor(diffX / charWidth), 65);
        const spaces = "\u00A0".repeat(spacesCount);

        newBlocks.push({
          type: "paragraph",
          content: spaces,
        });

        editor.insertBlocks(newBlocks, lastDocBlock, "after");
        const targetBlock = editor.document[editor.document.length - 1];
        editor.setTextCursorPosition(targetBlock, "end");
      } else {
        newBlocks.push({ type: "paragraph", content: "" });
        editor.insertBlocks(newBlocks, lastDocBlock, "after");
        const targetBlock = editor.document[editor.document.length - 1];
        editor.setTextCursorPosition(targetBlock, "start");
      }
      editor.focus();
    } else {
      editor.setTextCursorPosition(lastDocBlock, isDoubleClick ? "end" : "start");
      editor.focus();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.bn-block-content') || target.closest('.bn-toolbar') || target.closest('.bn-side-menu')) {
      return;
    }

    const x = e.clientX;
    const y = e.clientY;

    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = window.setTimeout(() => {
      handleCanvasInteraction(x, y, false);
      clickTimeoutRef.current = null;
    }, 220);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.bn-block-content') || target.closest('.bn-toolbar') || target.closest('.bn-side-menu')) {
      return;
    }

    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    handleCanvasInteraction(e.clientX, e.clientY, true);
  };

  return (
    <div
      ref={containerRef}
      key={pageId}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className="w-full flex-1 flex flex-col min-h-[550px] cursor-text select-text relative"
    >
      <BlockNoteView
        editor={editor}
        theme={isDark ? "dark" : "light"}
        formattingToolbar={false}
        sideMenu={false}
        onChange={() => {
          onContentChange(editor.document);
          calculateStats(editor.document);
        }}
        className="w-full flex-1"
      >
        <SideMenuController />

        <FormattingToolbarController
          formattingToolbar={CustomToolbar}
        />
      </BlockNoteView>

      {/* Поповер перенесення тексту */}
      {isMoveModalOpen && modalCoords && (
        <>
          <div
            onClick={() => setIsMoveModalOpen(false)}
            className="fixed inset-0 z-50 bg-transparent"
          />

          <div
            style={{
              top: `${modalCoords.y}px`,
              left: `${modalCoords.x}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 w-72 bg-cozy-card dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-2xl p-3.5 shadow-2xl space-y-2.5 animate-cozy-pop select-none"
          >
            <div className="flex items-center justify-between pb-1 border-b border-cozy-border/60 dark:border-night-border/60">
              <span className="text-xs font-serif font-bold text-cozy-text dark:text-night-text">
                {lang === 'uk' ? 'Перенести на інший аркуш' : 'Move to sheet'}
              </span>
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="p-1 rounded-md text-cozy-muted hover:text-cozy-text transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            <p className="text-[10px] text-cozy-muted leading-relaxed">
              {lang === 'uk'
                ? 'Введіть номер аркуша. Якщо його ще немає, Flins створить його автоматично:'
                : 'Enter sheet number. If it does not exist, Flins will create it:'}
            </p>

            <div className="flex items-center gap-1.5 pt-0.5">
              <input
                type="number"
                min="1"
                autoFocus
                value={targetSheetInput}
                onChange={(e) => setTargetSheetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmMove();
                  if (e.key === 'Escape') setIsMoveModalOpen(false);
                }}
                placeholder={lang === 'uk' ? 'Номер...' : 'Sheet #...'}
                className="flex-1 text-xs font-mono bg-cozy-surface dark:bg-night-card border border-cozy-border dark:border-night-border rounded-lg px-2.5 py-1.5 focus:outline-none"
              />
              <button
                onClick={handleConfirmMove}
                className="px-3 py-1.5 rounded-lg bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg text-xs font-medium shadow-xs hover:scale-102 transition-transform cursor-pointer flex-shrink-0"
              >
                {lang === 'uk' ? 'Перенести ↵' : 'Move ↵'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

Editor.displayName = "Editor";
export default Editor;
