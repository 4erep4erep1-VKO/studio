export const ADMIN_TELEGRAM_ID = (process.env.ADMIN_TELEGRAM_ID || '509030316').trim();

export function isAdminTelegramId(id: string | number | null | undefined): boolean {
  const normalized = String(id ?? '').trim();
  return Boolean(normalized) && normalized === ADMIN_TELEGRAM_ID;
}

export type AdminLogLevel = 'ERROR' | 'SECURITY' | 'INFO';

export interface AdminLogEntry {
  id: string;
  time: string;
  level: AdminLogLevel;
  source: string;
  message: string;
  details?: string;
}

const MAX_LOG_ENTRIES = 25;

const globalForLogs = globalThis as typeof globalThis & {
  __montazhkaAdminLogs?: AdminLogEntry[];
};

function getLogStore(): AdminLogEntry[] {
  if (!globalForLogs.__montazhkaAdminLogs) {
    globalForLogs.__montazhkaAdminLogs = [];
  }
  return globalForLogs.__montazhkaAdminLogs;
}

export function getRecentAdminLogs(): AdminLogEntry[] {
  return [...getLogStore()];
}

export function clearAdminLogs(): void {
  globalForLogs.__montazhkaAdminLogs = [];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getLevelBadge(level: AdminLogLevel): string {
  if (level === 'ERROR') return '🚨 <b>ОШИБКА</b>';
  if (level === 'SECURITY') return '🔐 <b>БЕЗОПАСНОСТЬ</b>';
  return 'ℹ️ <b>ИНФО</b>';
}

export async function logAdminAlert(params: {
  level: AdminLogLevel;
  source: string;
  message: string;
  details?: string;
  notify?: boolean;
}): Promise<void> {
  const time = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
  const trimmedDetails = params.details ? String(params.details).trim().slice(0, 800) : undefined;

  const entry: AdminLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time,
    level: params.level,
    source: String(params.source || 'Система'),
    message: String(params.message || ''),
    details: trimmedDetails,
  };

  const store = getLogStore();
  store.unshift(entry);
  if (store.length > MAX_LOG_ENTRIES) {
    store.length = MAX_LOG_ENTRIES;
  }

  if (params.notify === false) return;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !ADMIN_TELEGRAM_ID) return;

  const lines = [
    `${getLevelBadge(entry.level)} • <code>${escapeHtml(entry.source)}</code>`,
    escapeHtml(entry.message),
  ];

  if (entry.details) {
    lines.push(`<code>${escapeHtml(entry.details)}</code>`);
  }
  lines.push(`🕒 ${escapeHtml(entry.time)}`);

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_ID,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(7000),
    });
  } catch (err) {
    console.error('❌ Ошибка отправки админ-лога в Telegram:', err);
  }
}

