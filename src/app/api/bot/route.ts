import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'https://studio-cherepok.vercel.app').replace(/\/$/, '');
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

async function sendTelegram(chatId: string | number, payload: Record<string, any>) {
  if (!TELEGRAM_TOKEN) {
    console.error('Telegram token is not configured');
    return null;
  }

  return fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${payload.method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload.body),
  });
}

async function sendTelegramMessage(chatId: string | number, text: string, extra: Record<string, any> = {}) {
  return sendTelegram(chatId, {
    method: 'sendMessage',
    body: {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    },
  });
}

async function sendTelegramPhoto(chatId: string | number, photoUrl: string, caption: string, extra: Record<string, any> = {}) {
  return sendTelegram(chatId, {
    method: 'sendPhoto',
    body: {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
      ...extra,
    },
  });
}

async function sendTelegramMessageOrPhoto(chatId: string | number, text: string, replyMarkup?: Record<string, any>, photoUrl?: string | null) {
  if (photoUrl) {
    return sendTelegramPhoto(chatId, photoUrl, text, { reply_markup: replyMarkup });
  }

  return sendTelegramMessage(chatId, text, { reply_markup: replyMarkup });
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  if (!TELEGRAM_TOKEN) {
    return null;
  }

  return sendTelegram(null as any, {
    method: 'answerCallbackQuery',
    body: { callback_query_id: callbackQueryId, text, show_alert: false },
  });
}

async function notifyGroup(text: string, photoUrl?: string | null) {
  if (!GROUP_CHAT_ID) {
    console.warn('GROUP_CHAT_ID is not configured, group notification skipped');
    return null;
  }

  if (photoUrl) {
    return sendTelegramPhoto(GROUP_CHAT_ID, photoUrl, text);
  }

  return sendTelegramMessage(GROUP_CHAT_ID, text);
}

async function findProfileByTelegramId(telegramId: string) {
  if (!telegramId) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, can_print, name, full_name')
    .eq('telegram_chat_id', telegramId)
    .single();

  if (error) {
    console.error('findProfileByTelegramId error:', error.message);
    return null;
  }

  return data;
}

function buildMainMenuKeyboard(canPrint: boolean) {
  const keyboard: any[] = [
    [
      { text: '➕ Создать заказ', web_app: { url: WEB_APP_URL } },
      { text: '📋 Активные заказы' },
    ],
    [
      { text: '🔓 Свободные заказы' },
      { text: '💼 Мои заказы' },
    ],
    [
      { text: '📊 Рейтинг' },
      { text: '👤 Мой профиль' },
    ],
  ];

  if (canPrint) {
    keyboard.splice(2, 0, [{ text: '🖨 Очередь на печать' }]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

async function sendMainMenu(chatId: string | number, canPrint: boolean) {
  await sendTelegramMessage(chatId, 'Главное меню. Выберите опцию ниже.', {
    reply_markup: buildMainMenuKeyboard(canPrint),
  });
}

function buildOrderPreview(order: any) {
  return `<b>${escapeHtml(order.title)}</b>`;
}

function buildOrderButtons(order: any) {
  const buttons: any[][] = [];

  if (order.department === 'print') {
    buttons.push([
      { text: '🏢 В ОФИС', callback_data: `office_${order.id}` },
      { text: '🔨 ИЗГОТОВЛЕНИЕ', callback_data: `print_${order.id}` },
      { text: '🚚 НА МОНТАЖ', callback_data: `install_${order.id}` },
    ]);
  } else if (order.department === 'production' || order.department === 'installation') {
    buttons.push([
      { text: '✅ ЗАВЕРШИТЬ ЗАКАЗ', callback_data: `complete_${order.id}` },
      { text: '🚫 ЗАВЕРШИТЬ БЕЗ ФОТО', callback_data: `complete_without_photo_${order.id}` },
    ]);
  }

  return buttons.length ? { inline_keyboard: buttons } : undefined;
}

async function handleStartCommand(chatId: number | string, telegramId: string) {
  const profile = await findProfileByTelegramId(telegramId);

  if (!profile) {
    await sendTelegramMessage(chatId, 'Ваш профиль не найден. Обратитесь к администратору и убедитесь, что telegram_chat_id указан в таблице profiles.');
    return;
  }

  await sendMainMenu(chatId, Boolean(profile.can_print));
}

async function handleActiveOrders(chatId: number | string) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, title, department, status, image_urls')
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('handleActiveOrders error:', error.message);
    await sendTelegramMessage(chatId, 'Не удалось получить активные заказы. Попробуйте позже.');
    return;
  }

  if (!orders || !orders.length) {
    await sendTelegramMessage(chatId, 'Активных заказов нет.');
    return;
  }

  for (const order of orders) {
    const text = [`<b>📋 Активный заказ</b>`, buildOrderPreview(order)].join('\n');
    const photoUrl = Array.isArray(order.image_urls) && order.image_urls.length > 0 ? order.image_urls[0] : null;
    await sendTelegramMessageOrPhoto(chatId, text, undefined, photoUrl);
  }
}

async function handleFreeOrders(chatId: number | string) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, title, deadline, department, image_urls')
    .is('assigned_to', null)
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('handleFreeOrders error:', error.message);
    await sendTelegramMessage(chatId, 'Не удалось получить свободные заказы. Попробуйте позже.');
    return;
  }

  if (!orders || !orders.length) {
    await sendTelegramMessage(chatId, 'Свободных заказов пока нет.');
    return;
  }

  for (const order of orders) {
    const itemText = [`<b>🔓 Свободный заказ</b>`, buildOrderPreview(order)].join('\n');
    const replyMarkup = {
      inline_keyboard: [[{ text: 'Забрать заказ', callback_data: `take_${order.id}` }]],
    };
    const photoUrl = Array.isArray(order.image_urls) && order.image_urls.length > 0 ? order.image_urls[0] : null;

    await sendTelegramMessageOrPhoto(chatId, itemText, replyMarkup, photoUrl);
  }
}

async function handleMyOrders(chatId: number | string, profile: any) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, title, department, status, image_urls')
    .eq('assigned_to', profile.id)
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('handleMyOrders error:', error.message);
    await sendTelegramMessage(chatId, 'Не удалось получить ваши заказы. Попробуйте позже.');
    return;
  }

  if (!orders || !orders.length) {
    await sendTelegramMessage(chatId, 'У вас пока нет заказов в работе.');
    return;
  }

  for (const order of orders) {
    const text = [`<b>💼 Мой заказ</b>`, buildOrderPreview(order)].join('\n');
    const photoUrl = Array.isArray(order.image_urls) && order.image_urls.length > 0 ? order.image_urls[0] : null;
    const replyMarkup = buildOrderButtons(order);

    await sendTelegramMessageOrPhoto(chatId, text, replyMarkup, photoUrl);
  }
}

async function handleRating(chatId: number | string) {
  const { data, error } = await supabase
    .from('orders')
    .select('assigned_to')
    .eq('status', 'completed');

  if (error) {
    console.error('handleRating error:', error.message);
    await sendTelegramMessage(chatId, 'Не удалось получить рейтинг. Попробуйте позже.');
    return;
  }

  const counts = (data || []).reduce<Record<string, number>>((acc, order) => {
    if (!order.assigned_to) return acc;
    acc[order.assigned_to] = (acc[order.assigned_to] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 10);

  if (!sorted.length) {
    await sendTelegramMessage(chatId, 'Рейтинг пока пуст. Никто ещё не завершил заказ.');
    return;
  }

  const ids = sorted.map(([id]) => id);
  const { data: profiles } = await supabase.from('profiles').select('id, name, full_name').in('id', ids);
  const namesById = (profiles || []).reduce<Record<string, string>>((acc, profile) => {
    acc[profile.id] = profile.name || profile.full_name || 'Сотрудник';
    return acc;
  }, {});

  const lines = sorted.map(([id, count], index) => `${index + 1}. ${escapeHtml(namesById[id] || 'Сотрудник')} — ${count}`);
  await sendTelegramMessage(chatId, `<b>📊 Рейтинг</b>\n${lines.join('\n')}`);
}

async function handleProfile(chatId: number | string, profile: any) {
  const [{ data: activeOrders, error }, { data: completedOrders, error: completedError }] = await Promise.all([
    supabase.from('orders').select('id, deadline').eq('assigned_to', profile.id).neq('status', 'completed'),
    supabase.from('orders').select('id').eq('assigned_to', profile.id).eq('status', 'completed'),
  ]);

  if (error) {
    console.error('handleProfile activeOrders error:', error.message);
    await sendTelegramMessage(chatId, 'Не удалось загрузить профиль. Попробуйте позже.');
    return;
  }

  if (completedError) {
    console.error('handleProfile completedOrders error:', completedError.message);
    await sendTelegramMessage(chatId, 'Не удалось загрузить профиль. Попробуйте позже.');
    return;
  }

  const deadlines = (activeOrders || [])
    .map((order: any) => order.deadline)
    .filter(Boolean)
    .map((value: string) => new Date(value))
    .filter((date: Date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, 3)
    .map((date: Date) => escapeHtml(date.toLocaleDateString('ru-RU')));

  const deadlineText = deadlines.length ? deadlines.join('\n') : 'Нет ближайших дедлайнов.';

  await sendTelegramMessage(chatId, `<b>👤 Мой профиль</b>\nВ работе: ${activeOrders?.length || 0}\nЗавершено: ${completedOrders?.length || 0}\n\n<b>Ближайшие дедлайны</b>:\n${deadlineText}`);
}

async function handlePrintQueue(chatId: number | string) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, title, deadline, image_urls')
    .eq('department', 'print')
    .is('assigned_to', null)
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('handlePrintQueue error:', error.message);
    await sendTelegramMessage(chatId, 'Не удалось получить очередь на печать. Попробуйте позже.');
    return;
  }

  if (!orders || !orders.length) {
    await sendTelegramMessage(chatId, 'Очередь на печать пуста.');
    return;
  }

  for (const order of orders) {
    const text = [`<b>🖨 Очередь на печать</b>`, buildOrderPreview(order)].join('\n');
    const replyMarkup = { inline_keyboard: [[{ text: 'Взять в работу', callback_data: `take_${order.id}` }]] };
    const photoUrl = Array.isArray(order.image_urls) && order.image_urls.length > 0 ? order.image_urls[0] : null;
    await sendTelegramMessageOrPhoto(chatId, text, replyMarkup, photoUrl);
  }
}

function parseCallbackData(data: string) {
  const normalized = data.replace(/:/g, '_');
  const knownActions = [
    'complete_without_photo',
    'complete_with_photo',
    'finish_without_photo',
    'print_to_office',
    'print_to_production',
    'print_to_installation',
    'take_print',
    'take',
    'office',
    'print',
    'install',
    'complete',
  ];

  for (const action of knownActions) {
    if (normalized.startsWith(`${action}_`)) {
      return { action, id: normalized.slice(action.length + 1) };
    }
  }

  const [action, ...rest] = normalized.split('_');
  return { action, id: rest.join('_') };
}

async function handleCallbackQuery(callbackQuery: any) {
  const callbackData = String(callbackQuery.data || '');
  const callbackId = String(callbackQuery.id || '');
  const telegramId = String(callbackQuery.from?.id || '');
  const profile = await findProfileByTelegramId(telegramId);

  if (!profile) {
    await answerCallbackQuery(callbackId, 'Профиль не найден. Обратитесь к администратору.');
    return;
  }

  const { action, id: orderId } = parseCallbackData(callbackData);

  if (!orderId) {
    await answerCallbackQuery(callbackId, 'Неверная команда.');
    return;
  }

  let resultMessage = 'Команда выполнена.';

  switch (action) {
    case 'take':
    case 'take_print':
      resultMessage = await handleTakeOrder(orderId, profile, callbackQuery);
      break;
    case 'office':
    case 'print_to_office':
      resultMessage = await handleMoveToOffice(orderId, profile);
      break;
    case 'print':
    case 'print_to_production':
      resultMessage = await handleMoveToPrint(orderId, profile);
      break;
    case 'install':
    case 'print_to_installation':
      resultMessage = await handleMoveToInstallation(orderId, profile);
      break;
    case 'complete':
      resultMessage = await handleCompleteOrder(orderId, profile);
      break;
    case 'complete_without_photo':
    case 'finish_without_photo':
      resultMessage = await handleCompleteOrder(orderId, profile, true);
      break;
    case 'complete_with_photo':
      resultMessage = await handleRequestPhotoOrder(orderId, profile);
      break;
    default:
      await answerCallbackQuery(callbackId, 'Команда не распознана.');
      return;
  }

  await answerCallbackQuery(callbackId, resultMessage);
}

async function handleTakeOrder(orderId: string, profile: any, callbackQuery: any) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();

  if (error || !order) {
    console.error('handleTakeOrder lookup error:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.status === 'completed') {
    return 'Этот заказ уже завершен.';
  }

  if (order.assigned_to) {
    return 'Этот заказ уже взят в работу.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ assigned_to: profile.id, status: 'in_progress' })
    .eq('id', orderId);

  if (updateError) {
    console.error('handleTakeOrder update error:', updateError.message);
    return 'Не удалось взять заказ. Попробуйте позже.';
  }

  await notifyGroup(`🟡 Заказ <b>${escapeHtml(order.title)}</b> взят в работу исполнителем ${escapeHtml(profile.name || profile.full_name || 'Сотрудник')}.`);

  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const text = `<b>✅ Заказ принят</b>\n${buildOrderPreview(order)}`;
    const replyMarkup = buildOrderButtons(order);
    await sendTelegramMessage(String(callbackQuery.message.chat.id), text, { reply_markup: replyMarkup });
  }

  return 'Вы успешно взяли заказ в работу.';
}

async function handleMoveToOffice(orderId: string, profile: any) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();

  if (error || !order) {
    console.error('handleMoveToOffice lookup error:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.assigned_to !== profile.id) {
    return 'Этот заказ закреплен не за вами.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', orderId);

  if (updateError) {
    console.error('handleMoveToOffice update error:', updateError.message);
    return 'Не удалось отметить заказ как переданный в офис.';
  }

  await notifyGroup(`🏢 Заказ <b>${escapeHtml(order.title)}</b> передан в офис.`);
  return 'Заказ передан в офис.';
}

async function handleMoveToPrint(orderId: string, profile: any) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();

  if (error || !order) {
    console.error('handleMoveToPrint lookup error:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.assigned_to !== profile.id) {
    return 'Этот заказ закреплен не за вами.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ department: 'print', status: 'in_progress' })
    .eq('id', orderId);

  if (updateError) {
    console.error('handleMoveToPrint update error:', updateError.message);
    return 'Не удалось перевести заказ в печать.';
  }

  await notifyGroup(`🖨 Заказ <b>${escapeHtml(order.title)}</b> переведен на печать.`);
  return 'Заказ переведен на печать.';
}

async function handleMoveToInstallation(orderId: string, profile: any) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();

  if (error || !order) {
    console.error('handleMoveToInstallation lookup error:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.assigned_to !== profile.id) {
    return 'Этот заказ закреплен не за вами.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ department: 'installation', status: 'in_progress' })
    .eq('id', orderId);

  if (updateError) {
    console.error('handleMoveToInstallation update error:', updateError.message);
    return 'Не удалось перевести заказ на монтаж.';
  }

  await notifyGroup(`🛠 Заказ <b>${escapeHtml(order.title)}</b> переведен на монтаж.`);
  return 'Заказ переведен на монтаж.';
}

async function handleRequestPhotoOrder(orderId: string, profile: any) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();

  if (error || !order) {
    console.error('handleRequestPhotoOrder lookup error:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.assigned_to !== profile.id) {
    return 'Этот заказ закреплен не за вами.';
  }

  if (!['installation', 'production'].includes(order.department)) {
    return 'Запрос фотоотчета возможен только для монтажных или производственных заказов.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'awaiting_photos' })
    .eq('id', orderId);

  if (updateError) {
    console.error('handleRequestPhotoOrder update error:', updateError.message);
    return 'Не удалось перейти в режим фотоотчета.';
  }

  return 'Пожалуйста, пришлите фотографию для завершения заказа.';
}

async function handleCompleteOrder(orderId: string, profile: any, withoutPhoto = false) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();

  if (error || !order) {
    console.error('handleCompleteOrder lookup error:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.assigned_to !== profile.id) {
    return 'Этот заказ закреплен не за вами.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', orderId);

  if (updateError) {
    console.error('handleCompleteOrder update error:', updateError.message);
    return 'Не удалось завершить заказ.';
  }

  const suffix = withoutPhoto ? 'без фото' : '';
  await notifyGroup(`✅ Заказ <b>${escapeHtml(order.title)}</b> завершен${suffix ? ` ${suffix}` : ''}.`);
  return withoutPhoto ? 'Заказ завершен без фото.' : 'Заказ отмечен как завершенный.';
}

export async function POST(request: Request) {
  if (!TELEGRAM_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Bot configuration missing' }, { status: 500 });
  }

  const update = await request.json().catch(() => null);
  if (!update) {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (update.message && update.message.chat?.type !== 'private') {
    return new Response('OK', { status: 200 });
  }

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return new Response('OK', { status: 200 });
  }

  if (update.message) {
    const chatId = update.message.chat?.id;
    const telegramId = String(update.message.from?.id || '');

    if (!chatId) {
      return NextResponse.json({ ok: false, error: 'Chat id missing' }, { status: 400 });
    }

    const text = typeof update.message.text === 'string' ? update.message.text.trim() : '';

    switch (text) {
      case '/start':
        await handleStartCommand(chatId, telegramId);
        break;
      case '📋 Активные заказы':
        await handleActiveOrders(chatId);
        break;
      case '🔓 Свободные заказы':
        await handleFreeOrders(chatId);
        break;
      case '💼 Мои заказы': {
        const profile = await findProfileByTelegramId(telegramId);
        if (!profile) {
          await sendTelegramMessage(chatId, 'Профиль не найден. Пройдите команду /start снова после регистрации.');
          break;
        }
        await handleMyOrders(chatId, profile);
        break;
      }
      case '📊 Рейтинг':
        await handleRating(chatId);
        break;
      case '👤 Мой профиль': {
        const profile = await findProfileByTelegramId(telegramId);
        if (!profile) {
          await sendTelegramMessage(chatId, 'Профиль не найден. Пройдите команду /start снова после регистрации.');
          break;
        }
        await handleProfile(chatId, profile);
        break;
      }
      case '🖨 Очередь на печать': {
        const profile = await findProfileByTelegramId(telegramId);
        if (!profile) {
          await sendTelegramMessage(chatId, 'Профиль не найден. Пройдите команду /start снова после регистрации.');
          break;
        }
        if (profile.can_print) {
          await handlePrintQueue(chatId);
        } else {
          await sendMainMenu(chatId, false);
        }
        break;
      }
      default:
        await sendMainMenu(chatId, Boolean((await findProfileByTelegramId(telegramId))?.can_print));
    }

    return new Response('OK', { status: 200 });
  }

  return new Response('OK', { status: 200 });
}
