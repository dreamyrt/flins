// src/services/passwordService.ts
// Фаза 6.3/6.4 — UI-lock паролем (argon2 на Rust-боці) + recovery-код.
import { invoke } from '@tauri-apps/api/core';

export async function appPasswordExists(): Promise<boolean> {
  try {
    return await invoke<boolean>('app_password_exists');
  } catch {
    return false;
  }
}

// Встановлення пароля повертає одноразовий recovery-код (6.4.1)
export function setAppPassword(password: string): Promise<string> {
  return invoke<string>('set_app_password', { password });
}

export function unlockApp(password: string): Promise<boolean> {
  return invoke<boolean>('unlock_app', { password });
}

// Зміна пароля ротає recovery-код (6.4.5): Some(новий код) / null = старий пароль не підійшов
export function changeAppPassword(oldPassword: string, newPassword: string): Promise<string | null> {
  return invoke<string | null>('change_app_password', { oldPassword, newPassword });
}

export function removeAppPassword(password: string): Promise<boolean> {
  return invoke<boolean>('remove_app_password', { password });
}

// 6.4.3 — «Забули пароль?»: код → новий пароль → новий код (null = код невірний)
export function resetPasswordWithRecovery(
  recoveryCode: string,
  newPassword: string,
): Promise<string | null> {
  return invoke<string | null>('reset_password_with_recovery', { recoveryCode, newPassword });
}

export async function recoveryCodeExists(): Promise<boolean> {
  try {
    return await invoke<boolean>('app_recovery_exists');
  } catch {
    return false;
  }
}

// Збереження коду у .txt через нативний діалог (rfd). true = записано
export function saveRecoveryFile(content: string): Promise<boolean> {
  return invoke<boolean>('save_recovery_file', { content });
}
