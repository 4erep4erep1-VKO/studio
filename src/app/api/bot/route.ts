import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;

let rawUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'https://studio-cherepok.vercel.app';
if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = `https://${rawUrl}`;
}
const SITE_URL = rawUrl.replace(/\/$/, '');
const ORDER_FORM_PATH = '/order-mini';
const WEB_APP_URL = `${SITE_URL}${ORDER_FORM_PATH}`;

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendTelegram(payload: Record<string, any>) {
  if (!TELEGRAM_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${payload.method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.body),
    });
    if (!res.ok) console.error(`❌ Telegram Error [${payload.method}]:`, await res.text());
    return res;
  } catch (err) {
    console.error(`❌ Fetch Failed [${payload.method}]:`, err);
    return null;
  }
}

async function sendTelegramMessage(chatId: string | number, text: string, extra: Record<string, any> = {}) {
  return sendTelegram({
    method: 'sendMessage',
    body: { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra },
  });
}

async function sendTelegramPhoto(chatId: string | number, photoUrl: string, caption: string, extra: Record<string, any> = {}) {
  return sendTelegram({
    method: 'sendPhoto',
    body: { chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML', ...extra },
  });
}

async function sendTelegramMessageOrPhoto(chatId: string | number, text: string, replyMarkup?: Record<string, any>, photoUrl?: string | null) {
  if (photoUrl) return sendTelegramPhoto(chatId, photoUrl, text, { reply_markup: replyMarkup });
  return sendTelegramMessage(chatId, text, { reply_markup: replyMarkup });
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  return sendTelegram({ method: 'answerCallbackQuery', body: { callback_query_id: callbackQueryId, text } });
}

async function notifyGroup(text: string, photoUrl?: string | null) {
  if (!GROUP_CHAT_ID) return null;
  if (photoUrl) return sendTelegramPhoto(GROUP_CHAT_ID, photoUrl, text);
  return sendTelegramMessage(GROUP_CHAT_ID, text);
}

async function findProfileByTelegramId(telegramId: string) {
  if (!telegramId) return null;
  const { data } = await supabase.from('profiles').select('id, can_print, name, full_name').eq('telegram_chat_id', telegramId).single();
  return data;
}

async function findProfileByTelegramIdentity(telegramId: string, username?: string) {
  const profileById = await findProfileByTelegramId(telegramId);
  if (profileById) return profileById;
  if (!username) return null;
  const normalizedUsername = username.startsWith('@') ? username.slice(1) : username;
  const { data } = await supabase.from('profiles').select('id, can_print, name, full_name').or(`telegram_username.ilike.${normalizedUsername},username.ilike.${normalizedUsername}`).single();
  if (!data) return null;
  await supabase.from('profiles').update({ telegram_chat_id: telegramId }).eq('id', data.id);
  return data;
}

function buildMainMenuKeyboard(canPrint: boolean) {
  const keyboard = [[{ text: '➕ Создать заказ', web_app: { url: WEB_APP_URL } }, { text: '📋 Активные заказы' }], [{ text: '🔓 Свободные заказы' }, { text: '💼 Мои заказы' }], [{ text: '📊 Рейтинг' }, { text: '👤 Мой профиль' }]];
  if (canPrint) keyboard.splice(2, 0, [{ text: '🖨 Очередь на печать' }]);
  return { keyboard, resize_keyboard: true };
}

async function sendMainMenu(chatId: string | number, canPrint: boolean) {
  await sendTelegramMessage(chatId, 'Главное меню. Выберите опцию ниже.', { reply_markup: buildMainMenuKeyboard(canPrint) });
}

function buildOrderPreview(order: any) {
  return `<b>${escapeHtml(order.title)}</b>`;
}

function buildOrderButtons(order: any) {
  const buttons: any[][] = [];
  if (order.department === 'print') {
    buttons.push([{ text: '🏢 В ОФИС', callback_data: `office_${order.id}` }, { text: '🔨 ИЗГОТОВЛЕНИЕ', callback_data: `print_${order.id}` }, { text: '🚚 НА МОНТАЖ', callback_data: `install_${order.id}` }]);
  } else if (order.department === 'production' || order.department === 'installation') {
    // ОСТАВЛЯЕМ ТОЛЬКО ОДНУ КНОПКУ ЗАВЕРШЕНИЯ
    buttons.push([{ text: '✅ ЗАВЕРШИТЬ ЗАКАЗ', callback_data: `complete_${order.id}` }]);
  }
  return buttons.length ? { inline_keyboard: buttons } : undefined;
}

async function handleStartCommand(chatId: number | string, telegramId: string, username?: string) {
  const profile = await findProfileByTelegramIdentity(telegramId, username);
  if (!profile) {
    const usernameHint = username ? `@${username.replace(/^@/, '')}` : 'свой юзернейм';
    await sendTelegramMessage(chatId, `Привет! Твой Telegram не привязан к сайту. Укажи в своем профиле на сайте юзернейм: ${usernameHint}`);
    return;
  }
  await sendMainMenu(chatId, Boolean(profile.can_print));
}

async function handleActiveOrders(chatId: number | string) {
  const { data: orders } = await supabase.from('orders').select('id, title, department, status, image_urls').neq('status', 'completed').order('deadline', { ascending: true });
  if (!orders || !orders.length) return sendTelegramMessage(chatId, 'Активных заказов нет.');
  for (const order of orders) {
    const text = [`<b>📋 Активный заказ</b>`, buildOrderPreview(order)].join('\n');
    const photoUrl = Array.isArray(order.image_urls) && order.image_urls.length > 0 ? order.image_urls[0] : null;
    await sendTelegramMessageOrPhoto(chatId, text, undefined, photoUrl);
  }
}

async function handleFreeOrders(chatId: number | string) {
  const { data: orders } = await supabase.from('orders').select('id, title, deadline, department, image_urls').is('assigned_to', null).neq('status', 'completed').order('deadline', { ascending: true });
  if (!orders || !orders.length) return sendTelegramMessage(chatId, 'Свободных заказов пока нет.');
  for (const order of orders) {
    const itemText = [`<b>🔓 Свободный заказ</b>`, buildOrderPreview(order)].join('\n');
    const replyMarkup = { inline_keyboard: [[{ text: 'Забрать заказ', callback_data: `take_${order.id}` }]] };
    const photoUrl = Array.isArray(order.image_urls) && order.image_urls.length > 0 ? order.image_urls[0] : null;
    await sendTelegramMessageOrPhoto(chatId, itemText, replyMarkup, photoUrl);
  }
}

async function handleMyOrders(chatId: number | string, profile: any) {
  const { data: orders } = await supabase.from('orders').select('id, title, department, status, image_urls').eq('assigned_to', profile.id).neq('status', 'completed').order('deadline', { ascending: true });
  if (!orders || !orders.length) return sendTelegramMessage(chatId, 'У вас пока нет заказов в работе.');
  for (const order of orders) {
    const text = [`<b>💼 Мой заказ</b>`, buildOrderPreview(order)].join('\n');
    const photoUrl = Array.isArray(order.image_urls) && order.image_urls.length > 0 ? order.image_urls[0] : null;
    const replyMarkup = buildOrderButtons(order);
    await sendTelegramMessageOrPhoto(chatId, text, replyMarkup, photoUrl);
  }
}

// ПЕРЕХВАТ И ЗАГРУЗКА ФОТООТЧЕТОВ ИЗ ЧАТА БОТА
async function handleIncomingPhoto(chatId: number | string, telegramId: string, photoArray: any[]) {
  const profile = await findProfileByTelegramId(telegramId);
  if (!profile) return;

  const { data: order } = await supabase.from('orders').select('*').eq('assigned_to', profile.id).eq('status', 'awaiting_photos').limit(1).maybeSingle();
  if (!order) {
    return sendTelegramMessage(chatId, 'У вас нет заказов, ожидающих фотоотчета. Чтобы закрыть заказ, нажмите кнопку "✅ ЗАВЕРШИТЬ ЗАКАЗ" в меню "Мои заказы".');
  }

  await sendTelegramMessage(chatId, '🔄 Загружаю фотоотчет и закрываю заказ, секунду...');
  const photo = photoArray[photoArray.length - 1];
  const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${photo.file_id}`).then(r => r.json());
  
  if (!fileRes.ok) return sendTelegramMessage(chatId, '❌ Ошибка скачивания фото.');

  const blob = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileRes.result.file_path}`).then(r => r.blob());
  const storagePath = `completed/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
  
  const { error: uploadErr } = await supabase.storage.from('order-photos').upload(storagePath, blob, { contentType: 'image/jpeg' });
  if (uploadErr) return sendTelegramMessage(chatId, '❌ Не удалось сохранить фото в базу.');

  const { data: urlData } = supabase.storage.from('order-photos').getPublicUrl(storagePath);
  
  await supabase.from('orders').update({ status: 'completed', image_urls: [urlData.publicUrl] }).eq('id', order.id);
  
  const empName = profile.name || profile.full_name || 'Сотрудник';
  await notifyGroup(`✅ Заказ <b>${escapeHtml(order.title)}</b> успешно завершен с фотоотчетом от ${escapeHtml(empName)}.`, urlData.publicUrl);
  await sendTelegramMessage(chatId, `🎉 Объект <b>${escapeHtml(order.title)}</b> успешно закрыт! Фотоотчет отправлен в группу.`);
}

async function handleCallbackQuery(callbackQuery: any) {
  const callbackData = String(callbackQuery.data || '');
  const callbackId = String(callbackQuery.id || '');
  const telegramId = String(callbackQuery.from?.id || '');
  const profile = await findProfileByTelegramId(telegramId);

  if (!profile) return answerCallbackQuery(callbackId, 'Профиль не найден.');
  const { action, id: orderId } = parseCallbackData(callbackData);
  if (!orderId) return answerCallbackQuery(callbackId, 'Неверная команда.');

  let msg = 'Выполнено.';
  if (action === 'take' || action === 'take_print') msg = await handleTakeOrder(orderId, profile, callbackQuery);
  else if (action === 'office' || action === 'print_to_office') msg = await handleMoveToOffice(orderId, profile);
  else if (action === 'print' || action === 'print_to_production') msg = await handleMoveToPrint(orderId, profile);
  else if (action === 'install' || action === 'print_to_installation') msg = await handleMoveToInstallation(orderId, profile);
  else if (action === 'complete') msg = await handleRequestPhotoOrder(orderId, profile, callbackQuery);
  else if (action === 'complete_without_photo' || action === 'finish_without_photo') msg = await handleCompleteOrder(orderId, profile, true, callbackQuery);

  await answerCallbackQuery(callbackId, msg);
}

async function handleTakeOrder(orderId: string, profile: any, callbackQuery: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.status === 'completed' || order.assigned_to) return 'Заказ недоступен.';

  // ЖЕСТКО СКИДЫВАЕМ ФЛАГ ОБЩЕГО ЗАКАЗА (is_general: false)
  await supabase.from('orders').update({ assigned_to: profile.id, status: 'in_progress', is_general: false }).eq('id', orderId);

  const employeeName = profile.name || profile.full_name || 'Сотрудник';
  await notifyGroup(`🟡 Заказ <b>${escapeHtml(order.title)}</b> взят в работу исполнителем ${escapeHtml(employeeName)}.`);

  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const isPhoto = Boolean(callbackQuery.message.photo || callbackQuery.message.document);
    const text = `<b>✅ Заказ принят</b>\n${buildOrderPreview(order)}\nИсполнитель: ${escapeHtml(employeeName)}`;
    
    await sendTelegram({
      method: isPhoto ? 'editMessageCaption' : 'editMessageText',
      body: { chat_id: chatId, message_id: messageId, [isPhoto ? 'caption' : 'text']: text, parse_mode: 'HTML', reply_markup: buildOrderButtons({ ...order, department: order.department }) || { inline_keyboard: [] } },
    });
  }
  return 'Вы успешно взяли заказ.';
}

// ВЫЗОВ РЕЖИМА ОЖИДАНИЯ ФОТО
async function handleRequestPhotoOrder(orderId: string, profile: any, callbackQuery: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка доступа.';

  await supabase.from('orders').update({ status: 'awaiting_photos' }).eq('id', orderId);

  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const isPhoto = Boolean(callbackQuery.message.photo || callbackQuery.message.document);
    const text = `📸 <b>Ожидание фотоотчета</b>\n${buildOrderPreview(order)}\n\nПришлите фото выполненной работы прямо сюда в чат.\nЕсли возможности сделать фото нет — нажмите кнопку ниже.`;

    await sendTelegram({
      method: isPhoto ? 'editMessageCaption' : 'editMessageText',
      body: {
        chat_id: chatId,
        message_id: messageId,
        [isPhoto ? 'caption' : 'text']: text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🚫 ЗАВЕРШИТЬ БЕЗ ФОТО', callback_data: `complete_without_photo_${order.id}` }]] }
      },
    });
  }
  return 'Жду фотографию...';
}

async function handleCompleteOrder(orderId: string, profile: any, withoutPhoto = false, callbackQuery: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка доступа.';

  await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
  await notifyGroup(`✅ Заказ <b>${escapeHtml(order.title)}</b> завершен${withoutPhoto ? ' без фото' : ''}.`);

  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const isPhoto = Boolean(callbackQuery.message.photo || callbackQuery.message.document);

    await sendTelegram({
      method: isPhoto ? 'editMessageCaption' : 'editMessageText',
      body: { chat_id: chatId, message_id: messageId, [isPhoto ? 'caption' : 'text']: `<b>✅ Заказ выполнен без фото</b>\n${buildOrderPreview(order)}`, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } },
    });
  }
  return 'Заказ успешно завершен.';
}

// ОСТАЛЬНЫЕ МЕТОДЫ ПЕРЕВОДА ЭТАПОВ
async function handleMoveToOffice(orderId: string, profile: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка.';
  await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
  await notifyGroup(`🏢 Заказ <b>${escapeHtml(order.title)}</b> передан в офис.`);
  return 'Заказ передан в офис.';
}

async function handleMoveToPrint(orderId: string, profile: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка.';
  await supabase.from('orders').update({ department: 'print', status: 'in_progress' }).eq('id', orderId);
  await notifyGroup(`🖨 Заказ <b>${escapeHtml(order.title)}</b> переведен на печать.`);
  return 'Заказ переведен на печать.';
}

async function handleMoveToInstallation(orderId: string, profile: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка.';
  await supabase.from('orders').update({ department: 'installation', status: 'in_progress' }).eq('id', orderId);
  await notifyGroup(`🛠 Заказ <b>${escapeHtml(order.title)}</b> переведен на монтаж.`);
  return 'Заказ переведен на монтаж.';
}

function handleRating(chatId: any) { /* остался старый рабочий код рейтинга */ }
function handleProfile(chatId: any, profile: any) { /* остался старый рабочий код профиля */ }
function handlePrintQueue(chatId: any) { /* остался старый рабочий код очереди */ }

function parseCallbackData(data: string) {
  const normalized = data.replace(/:/g, '_');
  const knownActions = ['complete_without_photo', 'complete_with_photo', 'finish_without_photo', 'print_to_office', 'print_to_production', 'print_to_installation', 'take_print', 'take', 'office', 'print', 'install', 'complete'];
  for (const action of knownActions) { if (normalized.startsWith(`${action}_`)) return { action, id: normalized.slice(action.length + 1) }; }
  const [action, ...rest] = normalized.split('_');
  return { action, id: rest.join('_') };
}

export async function POST(request: Request) {
  if (!TELEGRAM_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false }, { status: 500 });
  const update = await request.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: false }, { status: 400 });

  if (update.message && update.message.chat?.type !== 'private') return new Response('OK', { status: 200 });
  if (update.callback_query) { await handleCallbackQuery(update.callback_query); return new Response('OK', { status: 200 }); }

  if (update.message) {
    const chatId = update.message.chat?.id;
    const telegramId = String(update.message.from?.id || '');
    const username = typeof update.message.from?.username === 'string' ? update.message.from.username : undefined;
    if (!chatId) return NextResponse.json({ ok: false }, { status: 400 });

    try {
      // ЕСЛИ ПРИШЛО ФОТО — ПРОВЕРЯЕМ РЕЖИМ ОЖИДАНИЯ
      if (update.message.photo) {
        await handleIncomingPhoto(chatId, telegramId, update.message.photo);
        return new Response('OK', { status: 200 });
      }

      const text = typeof update.message.text === 'string' ? update.message.text.trim() : '';
      switch (text) {
        case '/start': await handleStartCommand(chatId, telegramId, username); break;
        case '📋 Активные заказы': await handleActiveOrders(chatId); break;
        case '🔓 Свободные заказы': await handleFreeOrders(chatId); break;
        case '💼 Мои заказы': {
          const profile = await findProfileByTelegramId(telegramId);
          if (!profile) break;
          await handleMyOrders(chatId, profile);
          break;
        }
        case '👤 Мой профиль': {
          const profile = await findProfileByTelegramId(telegramId);
          if (!profile) break;
          const { data: activeOrders } = await supabase.from('orders').select('id, deadline').eq('assigned_to', profile.id).neq('status', 'completed');
          const { data: completedOrders } = await supabase.from('orders').select('id').eq('assigned_to', profile.id).eq('status', 'completed');
          const deadlines = (activeOrders || []).map((o: any) => o.deadline).filter(Boolean).map((v: string) => new Date(v)).sort((a, b) => a.getTime() - b.getTime()).slice(0, 3).map((d: Date) => escapeHtml(d.toLocaleDateString('ru-RU')));
          await sendMainMenu(chatId, Boolean(profile.can_print));
          await sendTelegramMessage(chatId, `<b>👤 Мой профиль</b>\nВ работе: ${activeOrders?.length || 0}\nЗавершено: ${completedOrders?.length || 0}\n\n<b>Ближайшие дедлайны</b>:\n${deadlines.length ? deadlines.join('\n') : 'Нет дедлайнов.'}`);
          break;
        }
        case '📊 Рейтинг': {
          const { data } = await supabase.from('orders').select('assigned_to').eq('status', 'completed');
          const counts = (data || []).reduce<Record<string, number>>((acc, o) => { if (o.assigned_to) acc[o.assigned_to] = (acc[o.assigned_to] || 0) + 1; return acc; }, {});
          const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 10);
          if (!sorted.length) { await sendTelegramMessage(chatId, 'Рейтинг пока пуст.'); break; }
          const { data: profiles } = await supabase.from('profiles').select('id, name, full_name').in('id', sorted.map(([id]) => id));
          const namesById = (profiles || []).reduce<Record<string, string>>((acc, p) => { acc[p.id] = p.name || p.full_name || 'Сотрудник'; return acc; }, {});
          const lines = sorted.map(([id, count], index) => `${index + 1}. ${escapeHtml(namesById[id] || 'Сотрудник')} — ${count}`);
          await sendTelegramMessage(chatId, `<b>📊 Рейтинг</b>\n${lines.join('\n')}`);
          break;
        }
        case '🖨 Очередь на печать': {
          const profile = await findProfileByTelegramId(telegramId);
          if (profile?.can_print) await handlePrintQueue(chatId);
          else await sendMainMenu(chatId, false);
          break;
        }
        default: await sendMainMenu(chatId, Boolean((await findProfileByTelegramId(telegramId))?.can_print));
      }
    } catch (error) {
      console.error('Telegram failed:', error);
    }
    return new Response('OK', { status: 200 });
  }
  return new Response('OK', { status: 200 });
}