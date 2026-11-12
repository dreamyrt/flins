import { useState, useEffect, useRef } from 'react';
import { Lang } from '../services/i18n';
import { getRandomStarterPhrase } from '../services/starterPhrases';
import { FolderItem } from '../notes/NotesManager';
import { dbService, VaultConfig } from '../services/dbService';

export interface NotePage {
  id: string;
  title: string;
  isFavorite: boolean;
  content: any[];
}

export interface NoteItem {
  id: string;
  title: string;
  folderId: string | null;
  pages: NotePage[];
  activePageIndex: number;
}

export function useNotes(lang: Lang, vaultConfig?: VaultConfig, onSaveStatusChange?: (saving: boolean) => void) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  // 1. Початкове завантаження з SQLite
  useEffect(() => {
    Promise.all([dbService.loadFolders(), dbService.loadNotes()]).then(([f, n]) => {
      if (f.length > 0) {
        setFolders(f);
      } else {
        // Дефолтні папки лише при першому запуску нової програми
        const initialFolders = [
          { id: 'f1', name: 'Особисте' },
          { id: 'f2', name: 'Ідеї та проєкти' },
        ];
        setFolders(initialFolders);
        dbService.saveFolders(initialFolders);
      }

      if (n.length > 0) {
        setNotes(n);
        setActiveNoteId(n[0].id);
      } else {
        const firstPhrase = getRandomStarterPhrase('uk');
        const initialNote: NoteItem = {
          id: 'n1',
          title: firstPhrase.title,
          folderId: 'f2',
          activePageIndex: 0,
          pages: [
            {
              id: 'n1-page-1',
              title: 'Аркуш 1',
              isFavorite: false,
              content: [
                { type: "heading", props: { level: 1 }, content: firstPhrase.title },
                { type: "paragraph", content: firstPhrase.subtitle },
              ],
            },
          ],
        };
        setNotes([initialNote]);
        setActiveNoteId('n1');
        dbService.saveNote(initialNote);
      }
      setIsLoaded(true);
    });
  }, []);

  const triggerDebouncedNoteSave = (note: NoteItem) => {
    if (onSaveStatusChange) onSaveStatusChange(true);
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(async () => {
      const folder = folders.find((f) => f.id === note.folderId)?.name || '';
      await dbService.saveNote(note, folder, vaultConfig);
      if (onSaveStatusChange) onSaveStatusChange(false);
      debounceTimerRef.current = null;
    }, 400);
  };

  const createNote = (folderId: string | null) => {
    const phrase = getRandomStarterPhrase(lang);
    const newId = `note-${Date.now()}`;
    const newNote: NoteItem = {
      id: newId,
      title: phrase.title,
      folderId,
      activePageIndex: 0,
      pages: [
        {
          id: `${newId}-page-1`,
          title: 'Аркуш 1',
          isFavorite: false,
          content: [
            { type: "heading", props: { level: 1 }, content: phrase.title },
            { type: "paragraph", content: phrase.subtitle },
          ],
        },
      ],
    };
    setNotes((prev) => [...prev, newNote]);
    setActiveNoteId(newId);
    triggerDebouncedNoteSave(newNote);
  };

  const createFolder = (): string => {
    const newId = `folder-${Date.now()}`;
    const defaultName = lang === 'uk' ? 'Нова папка' : 'New Folder';
    const updated = [...folders, { id: newId, name: defaultName }];
    setFolders(updated);
    dbService.saveFolders(updated);
    return newId;
  };

  const deleteFolder = (id: string) => {
    const updated = folders.filter((f) => f.id !== id);
    setFolders(updated);
    dbService.saveFolders(updated);
    setNotes((prev) => prev.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)));
  };

  const renameNote = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, title: newTitle.trim() };
          triggerDebouncedNoteSave(updated);
          return updated;
        }
        return n;
      })
    );
  };

  const renameFolder = (id: string, newName: string) => {
    if (!newName.trim()) return;
    const updated = folders.map((f) => (f.id === id ? { ...f, name: newName.trim() } : f));
    setFolders(updated);
    dbService.saveFolders(updated);
  };

  const moveNote = (noteId: string, targetFolderId: string | null) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === noteId) {
          const updated = { ...n, folderId: targetFolderId };
          triggerDebouncedNoteSave(updated);
          return updated;
        }
        return n;
      })
    );
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) setActiveNoteId(null);
    dbService.deleteNote(id);
  };

  const addNewPageToCurrentNote = () => {
    if (!activeNoteId) return;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== activeNoteId) return n;
        const nextNum = n.pages.length + 1;
        const newPage: NotePage = {
          id: `${n.id}-page-${Date.now()}`,
          title: `Аркуш ${nextNum}`,
          isFavorite: false,
          content: [
            { type: "heading", props: { level: 1 }, content: `${n.title} (стор. ${nextNum})` },
            { type: "paragraph", content: "" },
          ],
        };
        const updated = { ...n, pages: [...n.pages, newPage], activePageIndex: n.pages.length };
        triggerDebouncedNoteSave(updated);
        return updated;
      })
    );
  };

  const deletePageFromCurrentNote = (indexToDelete: number): boolean => {
    if (!activeNoteId) return false;
    let success = false;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== activeNoteId || n.pages.length <= 1) return n;
        success = true;
        const newPages = n.pages.filter((_, idx) => idx !== indexToDelete);
        let newActive = n.activePageIndex;
        if (newActive >= newPages.length) newActive = Math.max(0, newPages.length - 1);
        const updated = { ...n, pages: newPages, activePageIndex: newActive };
        triggerDebouncedNoteSave(updated);
        return updated;
      })
    );
    return success;
  };

  const toggleFavoriteCurrentNotePage = () => {
    if (!activeNoteId) return;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== activeNoteId) return n;
        const updated = {
          ...n,
          pages: n.pages.map((p, idx) => (idx === n.activePageIndex ? { ...p, isFavorite: !p.isFavorite } : p)),
        };
        triggerDebouncedNoteSave(updated);
        return updated;
      })
    );
  };

  const setActivePageIndexForNote = (index: number) => {
    if (!activeNoteId) return;
    setNotes((prev) => prev.map((n) => (n.id === activeNoteId ? { ...n, activePageIndex: index } : n)));
  };

  const saveCurrentNotePageContent = (blocks: any[]) => {
    if (!activeNoteId) return;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== activeNoteId) return n;
        const updated = {
          ...n,
          pages: n.pages.map((p, idx) => (idx === n.activePageIndex ? { ...p, content: blocks } : p)),
        };
        triggerDebouncedNoteSave(updated);
        return updated;
      })
    );
  };

  const currentNote = notes.find((n) => n.id === activeNoteId);
  const currentNotePage = currentNote?.pages[currentNote.activePageIndex] || currentNote?.pages[0];

  return {
    folders,
    notes,
    activeNoteId,
    setActiveNoteId,
    currentNote,
    currentNotePage,
    createNote,
    createFolder,
    moveNote,
    deleteFolder,
    renameNote,
    renameFolder,
    deleteNote,
    addNewPageToCurrentNote,
    deletePageFromCurrentNote,
    toggleFavoriteCurrentNotePage,
    setActivePageIndexForNote,
    saveCurrentNotePageContent,
    isLoaded,
  };
}
