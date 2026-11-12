// Синхронізація версії застосунку з єдиного джерела — src-tauri/tauri.conf.json.
// Використання: pnpm sync-version 1.2.3   (або без аргументу — переписати поточну версію скрізь)
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const confPath = `${root}/src-tauri/tauri.conf.json`;
const pkgPath = `${root}/package.json`;
const cargoPath = `${root}/src-tauri/Cargo.toml`;

const conf = JSON.parse(readFileSync(confPath, 'utf8'));
const desired = process.argv[2] ?? conf.version;

if (!/^\d+\.\d+\.\d+([-.+].*)?$/.test(desired)) {
  console.error(`Некоректний semver: "${desired}" (приклад: 0.1.2)`);
  process.exit(1);
}

// 1. package.json
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = desired;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 2. Cargo.toml — чіпляємо version ТІЛЬКИ всередині блоку [package]
const cargo = readFileSync(cargoPath, 'utf8');
const nextCargo = cargo.replace(
  /^(\[package\][\s\S]*?)^version = "[^"]*"$/m,
  `$1version = "${desired}"`,
);
if (nextCargo === cargo && !/^\[package\][\s\S]*?version = ".*"/m.test(cargo)) {
  console.error('Не знайдено рядок version у блоці [package] Cargo.toml');
  process.exit(1);
}
writeFileSync(cargoPath, nextCargo);

// 3. tauri.conf.json — джерело істини, оновлюється останнім
conf.version = desired;
writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');

// Cargo.lock cargo сам оновить на наступній збірці.
console.log(`✓ Версія ${desired} записана в: package.json, Cargo.toml, tauri.conf.json`);
