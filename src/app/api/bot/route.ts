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

function buildMainMenuKeyboard(canPrint: boolean, chatId: string | number) {
  const keyboard = [
    [{ text: '➕ Создать заказ', web_app: { url: `${WEB_APP_URL}?tg_id=${chatId}` } }, { text: '📋 Активные заказы' }], 
    [{ text: '🔓 Свободные заказы' }, { text: '💼 Мои заказы' }], 
    [{ text: '📊 Рейтинг' }, { text: '👤 Мой профиль' }]
  ];
  if (canPrint) keyboard.splice(2, 0, [{ text: '🖨 Очередь на печать' }]);
  return { keyboard, resize_keyboard: true };
}

async function sendMainMenu(chatId: string | number, canPrint: boolean) {
  await sendTelegramMessage(chatId, 'Главное меню. Выберите опцию ниже.', { reply_markup: buildMainMenuKeyboard(canPrint, chatId) });
}

function buildOrderPreview(order: any) {
  let text = `<b>${escapeHtml(order.title)}</b>`;
  if (order.deadline) {
    try {
      const date = new Date(order.deadline);
      text += `\n📅 Дедлайн: <b>${date.toLocaleDateString('ru-RU')}</b>`;
    } catch (e) {
      text += `\n📅 Дедлайн: <b>${escapeHtml(order.deadline)}</b>`;
    }
  }
  return text;
}

function buildOrderButtons(order: any) {
  const buttons: any[][] = [];
  if (order.department === 'print') {
    buttons.push([
      { text: '🏢 В ОФИС', callback_data: `office_${order.id}` }, 
      { text: '🔨 ИЗГОТОВЛЕНИЕ', callback_data: `production_${order.id}` }, 
      { text: '🚚 НА МОНТАЖ', callback_data: `installation_${order.id}` }
    ]);
  } else if (order.department === 'production' || order.department === 'installation') {
    buttons.push([{ text: '✅ ЗАВЕРШИТЬ ЗАКАЗ', callback_data: `complete_${order.id}` }]);
  }
  buttons.push([{ text: '📄 ОПИСАНИЕ ЗАКАЗА', callback_data: `desc_${order.id}` }]);
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
  // ИСПРАВЛЕНО: Явно связываем через внешний ключ assigned_to, чтобы подтягивать исполнителя, а не создателя
  const { data: orders } = await supabase
    .from('orders')
    .select('id, title, department, status, image_urls, deadline, executor:profiles!assigned_to(name, full_name)')
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (!orders || !orders.length) return sendTelegramMessage(chatId, 'Активных заказов нет.');

  const statusMap: Record<string, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    awaiting_photos: 'Ожидание фотоотчета',
    completed: 'Завершен'
  };

  for (const order of orders) {
    let text = [`<b>📋 Активный заказ</b>`, buildOrderPreview(order)].join('\n');
    
    const statusText = statusMap[order.status] || order.status;
    text += `\n⚡ Статус: <b>${escapeHtml(statusText)}</b>`;
    
    const executor = order.executor as any;
    if (executor) {
      const empName = executor.name || executor.full_name || 'Сотрудник';
      text += `\n👤 Исполнитель: <b>${escapeHtml(empName)}</b>`;
    } else {
      text += `\n👤 Исполнитель: <b>Не назначен (Свободный)</b>`;
    }

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
  const { data: orders } = await supabase.from('orders').select('id, title, department, status, image_urls, deadline').eq('assigned_to', profile.id).neq('status', 'completed').order('deadline', { ascending: true });
  
  const filteredOrders = (orders || []).filter(order => {
    if (order.department === 'print' && order.status === 'new') {
      return false;
    }
    return true;
  });

  if (!filteredOrders || !filteredOrders.length) return sendTelegramMessage(chatId, 'У вас пока нет активных заказов в работе.');
  for (const order of filteredOrders) {
    const text = [`<b>💼 Мой заказ</b>`, buildOrderPreview(order)].join('\n');
    const photoUrl = Array.isArray(order.image_urls) && order.image_urls.length > 0 ? order.image_urls[0] : null;
    const replyMarkup = buildOrderButtons(order);
    await sendTelegramMessageOrPhoto(chatId, text, replyMarkup, photoUrl);
  }
}

async function handleIncomingPhoto(chatId: number | string, telegramId: string, photoArray: any[], mediaGroupId?: string) {
  await new Promise(resolve => setTimeout(resolve, Math.random() * 300));

  const profile = await findProfileByTelegramId(telegramId);
  if (!profile) return;

  let order = null;
  let isAlbumAppend = false;

  if (mediaGroupId) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .like('description', `%[album:${mediaGroupId}]%`)
      .limit(1)
      .maybeSingle();
    if (data) {
      order = data;
      isAlbumAppend = true;
    }
  }

  if (!order) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('assigned_to', profile.id)
      .eq('status', 'awaiting_photos')
      .limit(1)
      .maybeSingle();
    if (data) {
      order = data;
    }
  }

  if (!order) {
    return sendTelegramMessage(chatId, '⚠️ Не удалось связать фото с активным заказом. Убедитесь, что нажали кнопку "✅ ЗАВЕРШИТЬ ЗАКАЗ" in меню "Мои заказы".');
  }

  const photo = photoArray[photoArray.length - 1];
  const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${photo.file_id}`).then(r => r.json());
  if (!fileRes.ok) return;

  const blob = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileRes.result.file_path}`).then(r => r.blob());
  const storagePath = `completed/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
  
  const { error: uploadErr } = await supabase.storage.from('order-photos').upload(storagePath, blob, { contentType: 'image/jpeg' });
  if (uploadErr) return;

  const { data: urlData } = supabase.storage.from('order-photos').getPublicUrl(storagePath);
  
  const { data: freshData } = await supabase.from('orders').select('image_urls, description').eq('id', order.id).maybeSingle();
  
  const currentImages = freshData && Array.isArray(freshData.image_urls)
    ? freshData.image_urls
    : (order && Array.isArray(order.image_urls) ? order.image_urls : []);
    
  const updatedImages = [...currentImages, urlData.publicUrl];

  const updatePayload: Record<string, any> = {
    status: 'completed',
    image_urls: updatedImages
  };

  if (mediaGroupId && !isAlbumAppend) {
    const currentDesc = freshData?.description || order.description || '';
    updatePayload.description = `${currentDesc}\n[album:${mediaGroupId}]`.trim();
  }

  await supabase.from('orders').update(updatePayload).eq('id', order.id);
  
  const empName = profile.name || profile.full_name || 'Сотрудник';

  if (isAlbumAppend) {
    await notifyGroup(`📸 Дополнительное фото к объекту <b>${escapeHtml(order.title)}</b> от ${escapeHtml(empName)}`, urlData.publicUrl);
  } else {
    await notifyGroup(`✅ Заказ <b>${escapeHtml(order.title)}</b> успешно завершен с фотоотчетом от ${escapeHtml(empName)}.`, urlData.publicUrl);
    await sendTelegramMessage(chatId, `🎉 Объект <b>${escapeHtml(order.title)}</b> успешно закрыт! Фотоотчет отправлен в группу.`);
  }
}

async function handleCallbackQuery(callbackQuery: any) {
  const callbackData = String(callbackQuery.data || '');
  const callbackId = String(callbackQuery.id || '');
  const telegramId = String(callbackQuery.from?.id || '');
  const profile = await findProfileByTelegramId(telegramId);

  if (!profile) return answerCallbackQuery(callbackId, 'Ошибка профиля.');
  const { action, id: orderId } = parseCallbackData(callbackData);
  if (!orderId) return answerCallbackQuery(callbackId, 'Ошибка команды.');

  if (action === 'desc') {
    const { data: order } = await supabase.from('orders').select('title, description').eq('id', orderId).single();
    let descText = order?.description || 'Описание отсутствует.';
    descText = descText.replace(/\[album:.*?\]/g, '').trim();
    const fullMsg = `<b>📄 Описание объекта:</b> ${escapeHtml(order?.title || '')}\n\n${escapeHtml(descText || 'Деталей нет.')}`;
    if (callbackQuery.message?.chat?.id) {
      await sendTelegramMessage(callbackQuery.message.chat.id, fullMsg);
    }
    await answerCallbackQuery(callbackId, 'Описание выведено!');
    return;
  }

  let msg = 'Выполнено.';
  if (action === 'take' || action === 'take_print') msg = await handleTakeOrder(orderId, profile, callbackQuery);
  else if (action === 'office' || action === 'print_to_office') msg = await handleMoveToOffice(orderId, profile, callbackQuery);
  else if (action === 'production' || action === 'print_to_production') msg = await handleMoveToProduction(orderId, profile, callbackQuery);
  else if (action === 'installation' || action === 'print_to_installation') msg = await handleMoveToInstallation(orderId, profile, callbackQuery);
  else if (action === 'complete') msg = await handleRequestPhotoOrder(orderId, profile, callbackQuery);
  else if (action === 'complete_without_photo' || action === 'finish_without_photo') msg = await handleCompleteOrder(orderId, profile, true, callbackQuery);

  await answerCallbackQuery(callbackId, msg);
}

async function handleTakeOrder(orderId: string, profile: any, callbackQuery: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.status === 'completed' || (order.assigned_to && order.status !== 'new')) return 'Заказ недоступен.';

  await supabase.from('orders').update({ assigned_to: profile.id, status: 'in_progress', is_general: false }).eq('id', orderId);

  const employeeName = profile.name || profile.full_name || 'Сотрудник';
  await notifyGroup(`🟡 Заказ <b>${escapeHtml(order.title)}</b> взят в работу исполнителем ${escapeHtml(employeeName)}.`);

  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const isPhoto = Boolean(callbackQuery.message.photo || callbackQuery.message.document);
    const text = `<b>✅ Заказ принят в работу</b>\n${buildOrderPreview(order)}\nИсполнитель: ${escapeHtml(employeeName)}`;
    
    await sendTelegram({
      method: isPhoto ? 'editMessageCaption' : 'editMessageText',
      body: { chat_id: chatId, message_id: messageId, [isPhoto ? 'caption' : 'text']: text, parse_mode: 'HTML', reply_markup: buildOrderButtons({ ...order, department: order.department, status: 'in_progress' }) || { inline_keyboard: [] } },
    });
  }
  return 'Вы успешно взяли заказ.';
}

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

async function handleMoveToOffice(orderId: string, profile: any, callbackQuery: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка.';
  await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
  await notifyGroup(`🏢 Заказ <b>${escapeHtml(order.title)}</b> передан в офис.`);

  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const isPhoto = Boolean(callbackQuery.message.photo || callbackQuery.message.document);
    const text = `<b>🏢 Передано в офис</b>\n${buildOrderPreview(order)}`;
    
    await sendTelegram({
      method: isPhoto ? 'editMessageCaption' : 'editMessageText',
      body: { chat_id: chatId, message_id: messageId, [isPhoto ? 'caption' : 'text']: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } },
    });
  }
  return 'Заказ передан в офис.';
}

async function handleMoveToProduction(orderId: string, profile: any, callbackQuery: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка доступа.';

  await supabase.from('orders').update({ department: 'production', status: 'new', assigned_to: null }).eq('id', orderId);
  await notifyGroup(`🏭 Заказ <b>${escapeHtml(order.title)}</b> переведен на изготовление.`);

  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const isPhoto = Boolean(callbackQuery.message.photo || callbackQuery.message.document);
    const text = `<b>🏭 Передано в изготовление</b>\n${buildOrderPreview(order)}`;
    
    await sendTelegram({
      method: isPhoto ? 'editMessageCaption' : 'editMessageText',
      body: { chat_id: chatId, message_id: messageId, [isPhoto ? 'caption' : 'text']: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } },
    });
  }
  return 'Заказ переведен на изготовление.';
}

async function handleMoveToInstallation(orderId: string, profile: any, callbackQuery: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка доступа.';

  await supabase.from('orders').update({ department: 'installation', status: 'new', assigned_to: null }).eq('id', orderId);
  await notifyGroup(`🛠 Заказ <b>${escapeHtml(order.title)}</b> переведен на монтаж.`);

  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const isPhoto = Boolean(callbackQuery.message.photo || callbackQuery.message.document);
    const text = `<b>🛠 Передано на монтаж</b>\n${buildOrderPreview(order)}`;
    
    await sendTelegram({
      method: isPhoto ? 'editMessageCaption' : 'editMessageText',
      body: { chat_id: chatId, message_id: messageId, [isPhoto ? 'caption' : 'text']: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } },
    });
  }
  return 'Заказ переведен на монтаж.';
}

async function handlePrintQueue(chatId: number | string, profile: any) {
  const { data: orders, error } = await supabase.from('orders').select('id, title, deadline, image_urls, assigned_to, status').eq('department', 'print').neq('status', 'completed').order('deadline', { ascending: true });
  if (error) return sendTelegramMessage(chatId, 'Ошибка загрузки очереди.');

  const filteredOrders = (orders || []).filter(order => !order.assigned_to || (order.assigned_to === profile.id && order.status === 'new'));
  if (!filteredOrders.length) return sendTelegramMessage(chatId, 'Очередь на печать пуста.');

  for (const order of filteredOrders) {
    const text = [`<b>🖨 Очередь на печать</b>`, buildOrderPreview(order)].join('\n');
    const replyMarkup = { inline_keyboard: [[{ text: 'Взять в работу', callback_data: `take_${order.id}` }]] };
    const photoUrl = Array.isArray(order.image_urls) && order.image_urls.length > 0 ? order.image_urls[0] : null;
    await sendTelegramMessageOrPhoto(chatId, text, replyMarkup, photoUrl);
  }
}

function parseCallbackData(data: string) {
  const normalized = data.replace(/:/g, '_');
  const knownActions = ['complete_without_photo', 'complete_with_photo', 'finish_without_photo', 'print_to_office', 'print_to_production', 'print_to_installation', 'take_print', 'take', 'office', 'production', 'installation', 'complete', 'desc'];
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
      if (update.message.photo) {
        await handleIncomingPhoto(chatId, telegramId, update.message.photo, update.message.media_group_id);
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
          if (profile?.can_print) await handlePrintQueue(chatId, profile);
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