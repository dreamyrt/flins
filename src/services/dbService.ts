import { invoke } from '@tauri-apps/api/core';
import { DayMetadata, DayEntry } from '../hooks/useJournal';
import { NoteItem } from '../hooks/useNotes';
import { FolderItem } from '../notes/NotesManager';

export interface VaultConfig {
  enabled: boolean;
  vaultPath: string;
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getJournalVaultPath(dateKey: string, lang: 'uk' | 'en'): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  const monthNamesUk = [
    '01-Січень', '02-Лютий', '03-Березень', '04-Квітень', '05-Травень', '06-Червень',
    '07-Липень', '08-Серпень', '09-Вересень', '10-Жовтень', '11-Листопад', '12-Грудень'
  ];
  const monthNamesEn = [
    '01-January', '02-February', '03-March', '04-April', '05-May', '06-June',
    '07-July', '08-August', '09-September', '10-October', '11-November', '12-December'
  ];

  const monthFolder = (lang === 'uk' ? monthNamesUk : monthNamesEn)[m - 1] || `${String(m).padStart(2, '0')}-Month`;
  const weekNum = getWeekNumber(date);
  const weekFolder = lang === 'uk' ? `Тиждень-${weekNum}` : `Week-${weekNum}`;

  const weekdayName = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', { weekday: 'long' }).format(date);
  const filename = `${dateKey} (${weekdayName}).md`;

  const rootFolder = lang === 'uk' ? 'Щоденник' : 'Journal';
  return `${rootFolder}/${y}/${monthFolder}/${weekFolder}/${filename}`;
}

export function getNotesVaultPath(title: string, folderName: string = '', lang: 'uk' | 'en'): string {
  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Без назви';
  const rootFolder = lang === 'uk' ? 'Нотатки' : 'Notes';
  if (folderName && folderName.trim()) {
    const safeFolder = folderName.replace(/[/\\?%*:|"<>]/g, '_').trim();
    return `${rootFolder}/${safeFolder}/${safeTitle}.md`;
  }
  return `${rootFolder}/${safeTitle}.md`;
}

export function formatMarkdownWithFrontmatter(
  title: string,
  pages: { title: string; content: any[] }[],
  metadata?: DayMetadata,
  remark?: string
): string {
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    metadata?.mood ? `mood: "${metadata.mood}"` : null,
    metadata?.weather ? `weather: "${metadata.weather}"` : null,
    metadata?.rating ? `rating: ${metadata.rating}` : null,
    remark ? `librarian_remark: "${remark.replace(/"/g, '\\"')}"` : null,
    `sheets_count: ${pages.length}`,
    '---',
    '',
  ].filter(Boolean).join('\n');

  const body = pages
    .map((p, idx) => {
      const pageHeader = pages.length > 1 ? `## ${p.title || `Аркуш ${idx + 1}`}\n\n` : '';
      const text = (p.content || [])
        .map((b) => {
          if (Array.isArray(b.content)) return b.content.map((c: any) => c.text || '').join('');
          return b.content || '';
        })
        .join('\n\n');
      return pageHeader + text;
    })
    .join('\n\n---\n\n');

  return frontmatter + body;
}

// Версія формату редактора, що зберігається в pages_json у SQLite.
// Зміна BlockNote на інший мейджор може несовместимо змінити структуру блоків,
// тому кожен запис тепер несе свій формат-тег. Старі записи (оголений масив)
// читаються у зворотній сумісності без міграції.
const EDITOR_FORMAT = 'blocknote@0.22';

function serializePages(pages: unknown[]): string {
  return JSON.stringify({ format: EDITOR_FORMAT, blocks: pages });
}

// Приймає і старий формат (оголений масив блоків), і новий ({ format, blocks }).
function parsePages(pagesJson: string): any[] {
  const parsed = JSON.parse(pagesJson);
  if (Array.isArray(parsed)) return parsed;
  return parsed.blocks ?? [];
}

export const dbService = {
  async saveJournalEntry(dateKey: string, day: DayEntry, remark: string = '', vault?: VaultConfig, lang: 'uk' | 'en' = 'uk') {
    try {
      await invoke('db_save_journal_entry', {
        dateKey,
        pagesJson: serializePages(day.pages),
        metadataJson: JSON.stringify(day.metadata),
        remark,
      });

      if (vault?.enabled && vault.vaultPath.trim()) {
        const md = formatMarkdownWithFrontmatter(dateKey, day.pages, day.metadata, remark);
        const relativePath = getJournalVaultPath(dateKey, lang);
        await invoke('sync_to_vault_folder', {
          vaultDir: vault.vaultPath.trim(),
          relativePath,
          content: md,
        });
      }
    } catch (err) {
      console.error('Помилка збереження запису щоденника:', err);
    }
  },

  async loadJournalEntries(): Promise<Record<string, DayEntry>> {
    try {
      const rows = await invoke<[string, string, string, string][]>('db_load_journal_entries');
      const map: Record<string, DayEntry> = {};
      for (const [dateKey, pagesJson, metadataJson] of rows) {
        map[dateKey] = {
          pages: parsePages(pagesJson),
          metadata: JSON.parse(metadataJson),
          activePageIndex: 0,
          isModified: true,
        };
      }
      return map;
    } catch (err) {
      console.error('Помилка завантаження щоденника:', err);
      return {};
    }
  },

  // Завантаження останніх днів для ін'єкції в пам'ять ШІ-бібліотекаря
  async loadRecentJournalEntries(beforeDate: string, limit: number = 2): Promise<{ dateKey: string; pages: any[]; metadata: DayMetadata; remark: string }[]> {
    try {
      const rows = await invoke<[string, string, string, string][]>('db_load_recent_journal_entries', {
        beforeDate,
        limit,
      });
      return rows.map(([dateKey, pagesJson, metadataJson, remark]) => ({
        dateKey,
        pages: parsePages(pagesJson),
        metadata: JSON.parse(metadataJson),
        remark,
      }));
    } catch (err) {
      console.warn('Помилка завантаження останніх записів для пам’яті:', err);
      return [];
    }
  },

  async saveNote(note: NoteItem, folderName: string = '', vault?: VaultConfig, lang: 'uk' | 'en' = 'uk') {
    try {
      await invoke('db_save_note', {
        id: note.id,
        title: note.title,
        folderId: note.folderId,
        pagesJson: serializePages(note.pages),
        activePageIndex: note.activePageIndex,
      });

      if (vault?.enabled && vault.vaultPath.trim()) {
        const relativePath = getNotesVaultPath(note.title, folderName, lang);
        const md = formatMarkdownWithFrontmatter(note.title, note.pages);
        await invoke('sync_to_vault_folder', {
          vaultDir: vault.vaultPath.trim(),
          relativePath,
          content: md,
        });
      }
    } catch (err) {
      console.error('Помилка збереження нотатки:', err);
    }
  },

  async deleteNote(id: string) {
    try {
      await invoke('db_delete_note', { id });
    } catch (err) {
      console.error('Помилка видалення нотатки:', err);
    }
  },

  async loadNotes(): Promise<NoteItem[]> {
    try {
      const rows = await invoke<[string, string, string | null, string, number][]>('db_load_notes');
      return rows.map(([id, title, folderId, pagesJson, activePageIndex]) => ({
        id,
        title,
        folderId,
        pages: parsePages(pagesJson),
        activePageIndex,
      }));
    } catch (err) {
      console.error('Помилка завантаження нотаток:', err);
      return [];
    }
  },

  async saveFolders(folders: FolderItem[]) {
    try {
      await invoke('db_save_folders', { foldersJson: JSON.stringify(folders) });
    } catch (err) {
      console.error('Помилка збереження папок:', err);
    }
  },

  async loadFolders(): Promise<FolderItem[]> {
    try {
      const rows = await invoke<[string, string][]>('db_load_folders');
      return rows.map(([id, name]) => ({ id, name }));
    } catch (err) {
      console.error('Помилка завантаження папок:', err);
      return [];
    }
  },

  async saveSetting(key: string, value: any) {
    try {
      await invoke('db_save_setting', { key, value: JSON.stringify(value) });
    } catch (err) {
      console.error('Помилка збереження налаштувань:', err);
    }
  },

  async loadSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const res = await invoke<string | null>('db_load_setting', { key });
      if (res) return JSON.parse(res);
      return defaultValue;
    } catch {
      return defaultValue;
    }
  },
};
