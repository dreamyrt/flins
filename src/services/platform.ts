// src/services/platform.ts

/**
 * Визначення операційної системи в рантаймі
 */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
export const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);

/**
 * Символ головної клавіші-модифікатора:
 * macOS: ⌘
 * Windows / Linux: Ctrl
 */
export const modifierKey = isMac ? '⌘' : 'Ctrl';

/**
 * Форматування шортката під поточну систему (наприклад: "⌘J" на Mac та "Ctrl+J" на Windows)
 */
export function formatShortcut(key: string): string {
  if (isMac) {
    return `⌘${key}`;
  }
  return `Ctrl+${key}`;
}
