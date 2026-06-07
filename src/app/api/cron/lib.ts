import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;

export const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

export function getDisplayName(profile: any) {
  return profile?.name || profile?.full_name || 'Сотрудник';
}

export function escapeHtml(text: string) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendTelegram(text: string) {
  if (!TELEGRAM_TOKEN || !GROUP_CHAT_ID) {
    console.error('Telegram cron config missing');
    return null;
  }

  return fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: GROUP_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
}

export function formatOrderLine(order: any, assignedNames: Record<string, string>) {
  // Словарь для красивых названий
  const statusMap: Record<string, string> = {
    'new': '🆕 Новые',
    'in_progress': '⏳ В работе',
    'completed': '✅ Готово'
  };

  const departmentLabel = order.department === 'installation' 
    ? '🛠 Монтаж' 
    : order.department === 'production' 
    ? '🏭 Изготовление' 
    : '🖨 Печать';

  const statusLabel = statusMap[order.status] || order.status || 'В работе';
  const assigned = assignedNames[order.assigned_to] || 'Общий';
  const deadline = order.deadline ? new Date(order.deadline).toLocaleDateString('ru-RU') : 'Не указан';
  
  // ВЫВОДИМ TITLE, А НЕ ID
  return `• <b>${escapeHtml(order.title)}</b>\n  ${departmentLabel}, ${statusLabel}\n  Ответственный: ${escapeHtml(assigned)}\n  Дедлайн: ${escapeHtml(deadline)}`;
}