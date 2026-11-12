import { useState, useEffect, useRef } from 'react';
import {
  Folder, FileText, ChevronRight, ChevronDown, Plus, Trash2,
  FolderPlus, Edit2, CornerDownRight, PanelLeftClose
} from 'lucide-react';
import { Lang, t } from '../services/i18n';

export interface NoteItem {
  id: string;
  title: string;
  folderId: string | null;
  pages?: any[];
}

export interface FolderItem {
  id: string;
  name: string;
}

interface NotesManagerProps {
  folders: FolderItem[];
  notes: NoteItem[];
  activeNoteId: string | null;
  width: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onWidthChange: (width: number) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: (folderId: string | null) => void;
  onCreateFolder: () => string;
  onMoveNote: (noteId: string, targetFolderId: string | null) => void;
  onRenameNote: (id: string, newTitle: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteNote: (id: string) => void;
  onDeleteFolder?: (id: string) => void;
  lang: Lang;
}

export default function NotesManager({
  folders,
  notes,
  activeNoteId,
  width,
  isCollapsed,
  onToggleCollapse,
  onWidthChange,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onMoveNote,
  onRenameNote,
  onRenameFolder,
  onDeleteNote,
  onDeleteFolder,
  lang,
}: NotesManagerProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ f1: true, f2: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const [activeDragNote, setActiveDragNote] = useState<{ id: string; title: string } | null>(null);
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number } | null>(null);
  const [hoveredDropId, setHoveredDropId] = useState<string | 'root' | null>(null);

  const dragStartPosRef = useRef<{ x: number; y: number; note: NoteItem } | null>(null);
  const isDraggingRef = useRef(false);
  const hoveredDropRef = useRef<string | 'root' | null>(null);

  const isResizingRef = useRef(false);
  const strings = t[lang];

  const setHoverTarget = (id: string | 'root' | null) => {
    setHoveredDropId(id);
    hoveredDropRef.current = id;
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isResizingRef.current) {
        const newWidth = Math.min(Math.max(e.clientX - 60, 160), 450);
        onWidthChange(newWidth);
        return;
      }

      if (!dragStartPosRef.current) return;

      const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
      const dy = Math.abs(e.clientY - dragStartPosRef.current.y);

      if (!isDraggingRef.current && (dx > 5 || dy > 5)) {
        isDraggingRef.current = true;
        setActiveDragNote({
          id: dragStartPosRef.current.note.id,
          title: dragStartPosRef.current.note.title,
        });
        document.body.style.userSelect = 'none';
      }

      if (isDraggingRef.current) {
        setDragCoords({ x: e.clientX, y: e.clientY });
      }
    };

    const handleGlobalMouseUp = () => {
      isResizingRef.current = false;

      if (isDraggingRef.current && dragStartPosRef.current) {
        const noteId = dragStartPosRef.current.note.id;
        const target = hoveredDropRef.current;

        if (target === 'root') {
          onMoveNote(noteId, null);
        } else if (target) {
          onMoveNote(noteId, target);
          setOpenFolders((prev) => ({ ...prev, [target]: true }));
        }
      }

      dragStartPosRef.current = null;
      isDraggingRef.current = false;
      setActiveDragNote(null);
      setDragCoords(null);
      setHoverTarget(null);
      document.body.style.userSelect = 'auto';
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [onMoveNote, onWidthChange]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleNoteMouseDown = (e: React.MouseEvent, note: NoteItem) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    if (e.button !== 0) return;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY, note };
  };

  const toggleFolder = (id: string) => {
    setOpenFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = (id: string, isFolder: boolean) => {
    if (isFolder) {
      onRenameFolder(id, editTitle);
    } else {
      onRenameNote(id, editTitle);
    }
    setEditingId(null);
  };

  const handleCreateFolderClick = () => {
    const newId = onCreateFolder();
    if (newId) {
      setOpenFolders((prev) => ({ ...prev, [newId]: true }));
      setEditingId(newId);
      setEditTitle(lang === 'uk' ? 'Нова папка' : 'New Folder');
    }
  };

  const rootNotes = notes.filter((n) => n.folderId === null);

  return (
    <aside
      style={{ width: isCollapsed ? '34px' : `${width}px` }}
      className="relative flex-shrink-0 border-r border-cozy-border dark:border-night-border bg-cozy-surface/50 dark:bg-night-surface/50 flex flex-col h-full select-none transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
    >
      {/* 1. ЗГОРНУТИЙ СТАН: акуратна вертикальна смужка */}
      {isCollapsed ? (
        <div
          onClick={onToggleCollapse}
          className="w-full h-full flex flex-col items-center py-3 cursor-pointer hover:bg-cozy-card dark:hover:bg-night-card transition-colors select-none group"
          title="Розгорнути дерево нотаток"
        >
          <button className="p-1 rounded text-cozy-muted group-hover:text-cozy-accent transition-colors">
            <ChevronRight size={16} />
          </button>

          {/* Вертикальний напис опущено до mt-20, щоб ніколи не перекривати стрілочку */}
          <span className="text-[10px] uppercase font-mono tracking-widest text-cozy-muted rotate-90 mt-20 origin-center whitespace-nowrap pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity">
            {strings.notes}
          </span>
        </div>
      ) : (
        /* 2. РОЗГОРНУТИЙ СТАН: повноцінне дерево нотаток */
        <div className="flex flex-col h-full w-full min-w-[200px] animate-in fade-in duration-150">
          {/* Шапка дерева */}
          <div className="p-3 border-b border-cozy-border/60 dark:border-night-border/60 flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded hover:bg-cozy-card dark:hover:bg-night-card text-cozy-muted hover:text-cozy-accent transition-colors"
                title="Згорнути в тонку смужку"
              >
                <PanelLeftClose size={14} />
              </button>
              <span className="text-[11px] font-semibold tracking-wider text-cozy-muted uppercase truncate">
                {strings.notes}
              </span>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onCreateNote(null)}
                className="p-1 rounded hover:bg-cozy-card dark:hover:bg-night-card text-cozy-accent dark:text-night-accent transition-colors"
                title={strings.newNote}
              >
                <Plus size={15} />
              </button>

              <button
                onClick={handleCreateFolderClick}
                className="p-1 rounded hover:bg-cozy-card dark:hover:bg-night-card text-cozy-accent dark:text-night-accent transition-colors"
                title={strings.newFolder}
              >
                <FolderPlus size={15} />
              </button>
            </div>
          </div>

          {/* Список елементів (кнопки дій не стискають текст завдяки relative/group) */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {folders.map((folder) => {
              const isOpen = openFolders[folder.id];
              const folderNotes = notes.filter((n) => n.folderId === folder.id);
              const isEditing = editingId === folder.id;
              const isTargeted = hoveredDropId === folder.id;

              return (
                <div
                  key={folder.id}
                  className={`space-y-0.5 rounded-xl p-0.5 transition-all ${
                    isTargeted ? 'ring-2 ring-cozy-accent bg-cozy-accent/20 dark:bg-night-accent/25 shadow-xs' : ''
                  }`}
                  onMouseEnter={() => setHoverTarget(folder.id)}
                  onMouseLeave={() => setHoverTarget(null)}
                >
                  <div
                    onClick={() => !isEditing && toggleFolder(folder.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(folder.id, folder.name);
                    }}
                    className="relative flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-cozy-card dark:hover:bg-night-card text-cozy-text dark:text-night-text group transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-6">
                      {isOpen ? <ChevronDown size={13} className="flex-shrink-0" /> : <ChevronRight size={13} className="flex-shrink-0" />}
                      <Folder size={14} className="text-cozy-accent dark:text-night-accent flex-shrink-0" />

                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleSaveRename(folder.id, true)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(folder.id, true)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-cozy-bg dark:bg-night-surface px-1.5 py-0.5 rounded border border-cozy-accent text-xs w-full focus:outline-none pointer-events-auto"
                        />
                      ) : (
                        <span className="truncate flex-1">{folder.name}</span>
                      )}
                    </div>

                    {/* Плаваючі кнопки дій (не крадуть місце у назви) */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-cozy-card dark:bg-night-card pl-1 rounded-md shadow-xs">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(folder.id, folder.name);
                        }}
                        className="p-1 hover:text-cozy-accent"
                        title="Перейменувати"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateNote(folder.id);
                        }}
                        className="p-1 hover:text-cozy-accent"
                        title={strings.newNote}
                      >
                        <Plus size={12} />
                      </button>
                      {onDeleteFolder && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFolder(folder.id);
                          }}
                          className="p-1 hover:text-red-400"
                          title="Видалити папку"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Нотатки у папці */}
                  {isOpen && (
                    <div className="pl-4 space-y-0.5">
                      {folderNotes.length === 0 ? (
                        <span className="text-[10px] text-cozy-muted italic px-2 block py-0.5">
                          {strings.emptyFolder}
                        </span>
                      ) : (
                        folderNotes.map((note) => {
                          const isNoteEditing = editingId === note.id;
                          const isDragged = activeDragNote?.id === note.id;

                          return (
                            <div
                              key={note.id}
                              onMouseDown={(e) => handleNoteMouseDown(e, note)}
                              onClick={() => !isNoteEditing && onSelectNote(note.id)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(note.id, note.title);
                              }}
                              className={`relative flex items-center justify-between px-2 py-1 rounded-md text-xs cursor-pointer group transition-all ${
                                isDragged ? 'opacity-30 scale-95' : ''
                              } ${
                                activeNoteId === note.id
                                  ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg font-medium shadow-xs'
                                  : 'hover:bg-cozy-card dark:hover:bg-night-card text-cozy-muted hover:text-cozy-text dark:hover:text-night-text'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-6">
                                <FileText size={12} className="flex-shrink-0 opacity-70" />
                                {isNoteEditing ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={() => handleSaveRename(note.id, false)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(note.id, false)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-cozy-bg dark:bg-night-surface px-1 py-0.5 rounded border border-cozy-accent text-xs w-full text-cozy-text dark:text-night-text focus:outline-none pointer-events-auto"
                                  />
                                ) : (
                                  <span className="truncate flex-1">{note.title || strings.untitledNote}</span>
                                )}
                              </div>

                              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-cozy-card dark:bg-night-card pl-1 rounded shadow-xs">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartRename(note.id, note.title);
                                  }}
                                  className="p-1 hover:text-cozy-accent"
                                  title="Перейменувати"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteNote(note.id);
                                  }}
                                  className="p-1 hover:text-red-400"
                                  title="Видалити"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Кореневі нотатки */}
            {rootNotes.map((note) => {
              const isNoteEditing = editingId === note.id;
              const isDragged = activeDragNote?.id === note.id;

              return (
                <div
                  key={note.id}
                  onMouseDown={(e) => handleNoteMouseDown(e, note)}
                  onClick={() => !isNoteEditing && onSelectNote(note.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(note.id, note.title);
                  }}
                  className={`relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer group transition-all ${
                    isDragged ? 'opacity-30 scale-95' : ''
                  } ${
                    activeNoteId === note.id
                      ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg font-medium shadow-xs'
                      : 'hover:bg-cozy-card dark:hover:bg-night-card text-cozy-text dark:text-night-text'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-6">
                    <FileText size={13} className="text-cozy-muted flex-shrink-0" />
                    {isNoteEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleSaveRename(note.id, false)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(note.id, false)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-cozy-bg dark:bg-night-surface px-1 py-0.5 rounded border border-cozy-accent text-xs w-full text-cozy-text dark:text-night-text focus:outline-none pointer-events-auto"
                      />
                    ) : (
                      <span className="truncate flex-1">{note.title || strings.untitledNote}</span>
                    )}
                  </div>

                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-cozy-card dark:bg-night-card pl-1 rounded shadow-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(note.id, note.title);
                      }}
                      className="p-1 hover:text-cozy-accent"
                      title="Перейменувати"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                      className="p-1 hover:text-red-400"
                      title="Видалити"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Зона переміщення в корінь */}
            {activeDragNote && (
              <div
                onMouseEnter={() => setHoverTarget('root')}
                onMouseLeave={() => setHoverTarget(null)}
                className={`p-2.5 my-2 border-2 border-dashed rounded-xl text-center text-[11px] transition-all flex items-center justify-center gap-1.5 ${
                  hoveredDropId === 'root'
                    ? 'border-cozy-accent bg-cozy-accent/20 text-cozy-accent font-semibold scale-102 shadow-xs'
                    : 'border-cozy-border/80 dark:border-night-border text-cozy-muted'
                }`}
              >
                <CornerDownRight size={13} />
                <span>{lang === 'uk' ? 'Відпустіть тут для винесення в корінь' : 'Release here to move to root'}</span>
              </div>
            )}
          </div>

          {/* Віджет drag&drop */}
          {activeDragNote && dragCoords && (
            <div
              style={{
                left: `${dragCoords.x + 14}px`,
                top: `${dragCoords.y + 14}px`,
              }}
              className="fixed z-50 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cozy-surface dark:bg-night-surface border-2 border-cozy-accent dark:border-night-accent shadow-2xl text-xs font-semibold text-cozy-text dark:text-night-text rotate-2 scale-105 transition-transform"
            >
              <FileText size={14} className="text-cozy-accent dark:text-night-accent" />
              <span className="truncate max-w-[150px]">{activeDragNote.title}</span>
            </div>
          )}

          {/* Ручка ручного ресайзу */}
          <div
            onMouseDown={startResizing}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-cozy-accent/40 dark:hover:bg-night-accent/40 transition-colors z-20"
          />
        </div>
      )}
    </aside>
  );
}
