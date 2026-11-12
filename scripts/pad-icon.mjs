// scripts/pad-icon.mjs — генерація іконок для ОБИДВОХ платформ за один прогін:
//   node scripts/pad-icon.mjs
//
// Логіка: з поточних logo-dark/light.png «зрізаємо» арт (trim по прозорих полях),
// потім компонуємо на полотно 1024 з ПРАВИЛЬНИМИ відступами:
//   macOS: арт 856px (Apple grid ~84%) — іде у src/assets/* та в icon.icns
//   Windows: арт 960px (майже full-bleed, як у системних іконок Win11) — в icon.ico/Square*
// Потім двічі викликає «pnpm tauri icon» і міняє місця платформні файли.
import sharp from 'sharp';
import { execSync } from 'node:child_process';
import { mkdtempSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CANVAS = 1024;
const ART_MAC = 856;
const ART_WIN = 960;

const compose = async (artBuf, art) => {
  const sized = await sharp(artBuf).resize(art, art, { fit: 'contain' }).png().toBuffer();
  return sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: sized, gravity: 'center' }])
    .png()
    .toBuffer();
};

const trim = async (path) => sharp(path).trim({ threshold: 8 }).png().toBuffer();

// 1. Арти з поточних файлів
const artDark = await trim('src/assets/logo-dark.png');
const artLight = await trim('src/assets/logo-light.png');

// 2. Runtime-асети для Dock (set_dock_icon) — troхи більші, ніж були (824 → 856)
await sharp(await compose(artDark, ART_MAC)).png().toFile('src/assets/logo-dark.png');
await sharp(await compose(artLight, ART_MAC)).png().toFile('src/assets/logo-light.png');

// 3. Окремий вихідний PNG для Windows-іконок
await sharp(await compose(artDark, ART_WIN)).png().toFile('src/assets/icon-source-win.png');

// 4. Двопрохінна генерація: спершу Windows-варіант, стешуємо його файли,
//    потім macOS-варіант, і повертаємо Windows-файли назад
const winFiles = ['icon.ico', 'StoreLogo.png'];
const stash = mkdtempSync(join(tmpdir(), 'flins-icons-'));

execSync('pnpm tauri icon src/assets/icon-source-win.png', { stdio: 'inherit' });
for (const f of readdirSync('src-tauri/icons')) {
  if (winFiles.includes(f) || /^Square.*\.png$/.test(f)) {
    cpSync(join('src-tauri/icons', f), join(stash, f));
  }
}

execSync('pnpm tauri icon src/assets/logo-dark.png', { stdio: 'inherit' });
for (const f of readdirSync(stash)) {
  cpSync(join(stash, f), join('src-tauri/icons', f));
}

console.log('✓ icon.icns / Dock-ассети: арт 856 (macOS-стандарт, +4% до попередніх)');
console.log('✓ icon.ico / Square*: арт 960 (Windows, майже без поля)');
