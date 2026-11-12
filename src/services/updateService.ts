// src/services/updateService.ts
// Оновлення Flins: GitHub Releases + minisign-підпис.
// Windows: повний цикл (перевірка → завантаження → установка → перезапуск).
// macOS без Developer ID: теж пробуємо in-app (завантаження Rust-клієнтом не вішає
// карантин), але при будь-якій помилці — автоматичний план Б: сторінка Releases.
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { openUrl } from '@tauri-apps/plugin-opener';

export const RELEASES_URL = 'https://github.com/dreamyrt/flins/releases/latest';

export type UpdateCheckResult =
  | { status: 'up-to-date' }
  | { status: 'available'; version: string; notes: string }
  | { status: 'unreachable' };

// Перевірка сервера оновлень. Мережеві помилки не «летять» назовні —
// доки немає жодного релізу, endpoint законно повертає 404.
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const update = await check();
    if (!update) return { status: 'up-to-date' };
    return { status: 'available', version: update.version, notes: update.body ?? '' };
  } catch {
    return { status: 'unreachable' };
  }
}

export type InstallProgress = { downloaded: number; total: number | null };

// Windows: тягне артефакт з signature-перевіркою всередині плагіна, ставить, просить relaunch.
// Повертає true, якщо установка успішна (викликати relaunch!).
export async function installUpdate(onProgress?: (p: InstallProgress) => void): Promise<boolean> {
  const update = await check();
  if (!update) return false;
  let downloaded = 0;
  let total: number | null = null;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? null;
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onProgress?.({ downloaded, total });
        break;
      case 'Finished':
        onProgress?.({ downloaded, total });
        break;
    }
  });
  return true;
}

export async function openReleasesPage(): Promise<void> {
  await openUrl(RELEASES_URL);
}

export async function softRelaunch(): Promise<void> {
  await relaunch();
}
