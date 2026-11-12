// scripts/pad-icon.mjs — готує іконки під macOS-стандарт:
// арт 824px по центру полотна 1024px з прозорими полями (Apple grid).
// Вимога: pnpm add -D sharp (один раз).
import sharp from 'sharp';

const ART = 824;
const CANVAS = 1024;

for (const name of ['logo-dark', 'logo-light']) {
  const src = `src/assets/${name}.png`;
  const resized = await sharp(src)
    .resize(ART, ART, { fit: 'contain' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(`src/assets/${name}-padded.png`);

  console.log(`✓ src/assets/${name}-padded.png`);
}
