import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isAdminTelegramId, logAdminAlert, getRecentAdminLogs, clearAdminLogs } from '@/lib/admin-logger';

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

function formatDepartment(department?: string | null): string {
  if (department === 'print') return '🖨 Печать';
  if (department === 'production') return '🏭 Изготовление';
  if (department === 'installation') return '🛠 Монтаж';
  return '';
}

function getAlmatyDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isOrderUrgent(deadline: unknown, todayStr: string): boolean {
  if (!deadline) return false;
  const raw = String(deadline).trim();
  if (!raw) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw <= todayStr;
  }
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return false;
  return getAlmatyDateString(parsed) <= todayStr;
}

async function sendTelegram(payload: Record<string, any>): Promise<Response | null> {
  if (!TELEGRAM_TOKEN) return null;
  const endpoint = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/${payload.method}`;
  const postTelegram = (body: Record<string, any>) =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

  try {
    const res = await postTelegram(payload.body);
    if (res.ok) return res;

    const errText = await res.text();
    console.error(`❌ Telegram Error [${payload.method}]:`, errText);

    if (res.status === 429) {
      let retryAfter = 1;
      try {
        const parsed = JSON.parse(errText);
        if (typeof parsed?.parameters?.retry_after === 'number') {
          retryAfter = parsed.parameters.retry_after;
        }
      } catch (_) {}
      const delayMs = Math.min(Math.max(retryAfter, 1), 3) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const retryRes = await postTelegram(payload.body);
      if (!retryRes.ok) {
        console.error(`❌ Telegram Retry Error [${payload.method}]:`, await retryRes.text());
      }
      return retryRes;
    }

    if (res.status === 400 && payload.body?.parse_mode && /parse entities/i.test(errText)) {
      const { parse_mode: _ignored, ...plainBody } = payload.body;
      const fallbackRes = await postTelegram(plainBody);
      if (!fallbackRes.ok) {
        console.error(`❌ Telegram Plain Fallback Error [${payload.method}]:`, await fallbackRes.text());
      }
      return fallbackRes;
    }

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

async function sendOrderToTelegram(chatId: string | number, text: string, replyMarkup: any, imageUrls: any) {
  const images = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  
  if (images.length === 0) {
    return sendTelegramMessage(chatId, text, { reply_markup: replyMarkup });
  }
  
  if (images.length === 1) {
    const res = await sendTelegramPhoto(chatId, images[0], text, { reply_markup: replyMarkup });
    if (!res || !res.ok) {
      return sendTelegramMessage(chatId, text, { reply_markup: replyMarkup });
    }
    return res;
  }
  
  const media = images.slice(0, 10).map((url, index) => ({
    type: 'photo',
    media: url,
    caption: index === 0 ? text : undefined,
    parse_mode: index === 0 ? 'HTML' : undefined
  }));
  
  const mediaRes = await sendTelegram({
    method: 'sendMediaGroup',
    body: { chat_id: chatId, media }
  });

  if (!mediaRes || !mediaRes.ok) {
    return sendTelegramMessage(chatId, text, { reply_markup: replyMarkup });
  }
  
  if (replyMarkup) {
    return sendTelegramMessage(chatId, '🎛 <b>Действия с заказом:</b>', { reply_markup: replyMarkup });
  }

  return mediaRes;
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
  const { data } = await supabase.from('profiles').select('*').eq('telegram_chat_id', telegramId).maybeSingle();
  return data;
}

async function handlePinAuthorization(chatId: number | string, telegramId: string, text: string, fromUser?: any): Promise<boolean> {
  try {
    const pin = (text || '').trim();
    if (!pin) return false;

    const fullNamePart = [fromUser?.first_name, fromUser?.last_name].filter(Boolean).join(' ').trim();
    const usernamePart = fromUser?.username ? `(@${fromUser.username})` : '';
    const userTag = [fullNamePart, usernamePart].filter(Boolean).join(' ') || 'Без имени';

    const isNumeric = /^\d+$/.test(pin);
    const pinAsNumber = isNumeric ? parseInt(pin, 10) : null;

    let profile = null;
    const fields = ['pin_code', 'pin', 'password'];

    for (const field of fields) {
      let query = supabase.from('profiles').select('*').eq(field, pin);
      let { data } = await query.limit(1).maybeSingle();
      
      if (!data && pinAsNumber !== null) {
        let queryNum = supabase.from('profiles').select('*').eq(field, pinAsNumber);
        const resNum = await queryNum.limit(1).maybeSingle();
        data = resNum.data;
      }

      if (data) {
        profile = data;
        break;
      }
    }

    if (!profile) {
      await logAdminAlert({
        level: 'SECURITY',
        source: 'Авторизация в боте',
        message: `Введён неверный ПИН-код: "${pin}"`,
        details: `TG ID: ${telegramId} | Пользователь: ${userTag}`,
      });
      await sendTelegramMessage(chatId, `❌ Неверный ПИН-код. Код "${escapeHtml(pin)}" не найден в системе. Проверьте цифры на сайте.`);
      return true;
    }

    if (profile.telegram_chat_id) {
      const ownerName = profile.full_name || profile.name || profile.id;
      await logAdminAlert({
        level: 'SECURITY',
        source: 'Авторизация в боте',
        message: `Попытка входа по уже занятому ПИН-коду сотрудника "${ownerName}"`,
        details: `TG ID: ${telegramId} | Пользователь: ${userTag}`,
      });
      await sendTelegramMessage(chatId, '⚠️ Этот ПИН-код уже активирован другим устройством.');
      return true;
    }

    const { error: updateError } = await supabase.from('profiles').update({ telegram_chat_id: String(telegramId) }).eq('id', profile.id);
    if (updateError) {
      console.error('❌ Ошибка обновления профиля при привязке Telegram:', updateError);
      await logAdminAlert({
        level: 'ERROR',
        source: 'Авторизация в боте',
        message: `Ошибка БД при привязке Telegram к профилю "${profile.full_name || profile.name || profile.id}"`,
        details: updateError.message,
      });
      await sendTelegramMessage(chatId, '❌ Ошибка при привязке профиля в БД. Попробуйте позже.');
      return true;
    }

    const name = profile.full_name || profile.name || 'сотрудник';
    await logAdminAlert({
      level: 'SECURITY',
      source: 'Авторизация в боте',
      message: `Сотрудник "${name}" успешно привязал Telegram`,
      details: `TG ID: ${telegramId} | Пользователь: ${userTag}`,
    });
    await sendTelegramMessage(
      chatId,
      `✅ Авторизация успешна! ${escapeHtml(name)}, вы привязаны к системе Montazhka PRO.`,
      { reply_markup: buildMainMenuKeyboard(Boolean(profile.can_print), chatId) }
    );
    return true;
  } catch (err: any) {
    console.error('❌ Ошибка в handlePinAuthorization:', err);
    await logAdminAlert({
      level: 'ERROR',
      source: 'handlePinAuthorization',
      message: 'Исключение при проверке ПИН-кода',
      details: String(err?.message || err),
    });
    try { await sendTelegramMessage(chatId, `❌ Внутренняя ошибка авторизации: ${escapeHtml(String(err?.message || err))}`); } catch (_) {}
    return true;
  }
}

function buildMainMenuKeyboard(canPrint: boolean, chatId: string | number) {
  const keyboard = [
    [{ text: '➕ Создать заказ', web_app: { url: `${WEB_APP_URL}?tg_id=${chatId}` } }, { text: '📋 Активные заказы' }],
    [{ text: '🔓 Свободные заказы' }, { text: '💼 Мои заказы' }],
    [{ text: '👥 Занятость' }, { text: '👤 Мой профиль' }],
  ];
  if (canPrint) keyboard.splice(2, 0, [{ text: '🖨 Очередь на печать' }]);
  if (isAdminTelegramId(chatId)) keyboard.push([{ text: '📜 Логи' }]);
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

// ДИНАМИЧЕСКИЕ КНОПКИ ЗАКАЗА С ФУНКЦИЕЙ ОТКАЗА
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
    // Добавляем кнопку отказа, если заказ находится в стадии выполнения
    if (order.status === 'in_progress' || order.status === 'awaiting_photos') {
      buttons.push([{ text: '🚫 ОТКАЗАТЬСЯ ОТ ЗАКАЗА', callback_data: `reject_${order.id}` }]);
    }
  }
  buttons.push([{ text: '📄 ОПИСАНИЕ ЗАКАЗА', callback_data: `desc_${order.id}` }]);
  return buttons.length ? { inline_keyboard: buttons } : undefined;
}

async function handleStartCommand(chatId: number | string, telegramId: string) {
  const profile = await findProfileByTelegramId(telegramId);
  if (!profile) {
    await sendTelegramMessage(chatId, `Привет! Ваш Telegram не привязан к системе Montazhka PRO.\n\nВведите <b>персональный ПИН-код</b>, который вам выдал администратор:`);
    return;
  }
  await sendMainMenu(chatId, Boolean(profile.can_print));
}

async function handleActiveOrders(chatId: number | string) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, title, department, status, image_urls, deadline, assigned_to')
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('❌ Ошибка загрузки активных заказов:', error);
    await logAdminAlert({ level: 'ERROR', source: 'handleActiveOrders', message: 'Ошибка загрузки данных из Supabase', details: error.message });
  }
  if (!orders || !orders.length) return sendTelegramMessage(chatId, 'Active orders empty.');

  const statusMap: Record<string, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    awaiting_photos: 'Ожидание фотоотчета',
    completed: 'Завершен'
  };

  const userIds = Array.from(new Set(orders.map(o => o.assigned_to).filter(Boolean)));
  const profilesMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, name, full_name').in('id', userIds);
    if (profiles) {
      profiles.forEach(p => { profilesMap[p.id] = p.name || p.full_name || 'Сотрудник'; });
    }
  }

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    let text = [`<b>📋 Активный заказ</b>`, buildOrderPreview(order)].join('\n');
    const statusText = statusMap[order.status] || order.status;
    text += `\n⚡ Статус: <b>${escapeHtml(statusText)}</b>`;
    
    if (order.assigned_to && profilesMap[order.assigned_to]) {
      text += `\n👤 Исполнитель: <b>${escapeHtml(profilesMap[order.assigned_to])}</b>`;
    } else {
      text += `\n👤 Исполнитель: <b>Не назначен (Свободный)</b>`;
    }

    await sendOrderToTelegram(chatId, text, undefined, order.image_urls);

    if (i < orders.length - 1 && Array.isArray(order.image_urls) && order.image_urls.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

async function handleFreeOrders(chatId: number | string) {
  const { data: orders, error } = await supabase.from('orders').select('id, title, deadline, department, image_urls').is('assigned_to', null).neq('status', 'completed').order('deadline', { ascending: true });
  if (error) {
    console.error('❌ Ошибка загрузки свободных заказов:', error);
    await logAdminAlert({ level: 'ERROR', source: 'handleFreeOrders', message: 'Ошибка загрузки данных из Supabase', details: error.message });
  }
  if (!orders || !orders.length) return sendTelegramMessage(chatId, 'Свободных заказов пока нет.');
  
  for (const order of orders) {
    const deptLabel = formatDepartment(order.department);
    const itemParts = [`<b>🔓 Свободный заказ</b>`, buildOrderPreview(order)];
    if (deptLabel) itemParts.push(`🏢 Цех: <b>${deptLabel}</b>`);
    const itemText = itemParts.join('\n');
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '✋ Забрать заказ', callback_data: `take_${order.id}` },
          { text: '📄 Описание заказа', callback_data: `desc_${order.id}` },
        ],
      ],
    };
    await sendOrderToTelegram(chatId, itemText, replyMarkup, order.image_urls);
  }
}

async function handleMyOrders(chatId: number | string, profile: any) {
  const { data: orders, error } = await supabase.from('orders').select('id, title, department, status, image_urls, deadline').eq('assigned_to', profile.id).neq('status', 'completed').order('deadline', { ascending: true });
  if (error) {
    console.error('❌ Ошибка загрузки моих заказов:', error);
    await logAdminAlert({ level: 'ERROR', source: 'handleMyOrders', message: 'Ошибка загрузки данных из Supabase', details: error.message });
  }
  
  const filteredOrders = (orders || []).filter(order => {
    if (order.department === 'print' && order.status === 'new') return false;
    return true;
  });

  if (!filteredOrders || !filteredOrders.length) return sendTelegramMessage(chatId, 'У вас пока нет активных заказов в работе.');
  for (const order of filteredOrders) {
    const text = [`<b>💼 Мой заказ</b>`, buildOrderPreview(order)].join('\n');
    const replyMarkup = buildOrderButtons(order);
    await sendOrderToTelegram(chatId, text, replyMarkup, order.image_urls);
  }
}

async function handleIncomingPhoto(chatId: number | string, telegramId: string, photoArray: any[], mediaGroupId?: string) {
  await new Promise(resolve => setTimeout(resolve, Math.random() * 300));

  const profile = await findProfileByTelegramId(telegramId);
  if (!profile) return;

  let order = null;
  let isAlbumAppend = false;

  if (mediaGroupId) {
    const { data } = await supabase.from('orders').select('*').like('description', `%[album:${mediaGroupId}]%`).limit(1).maybeSingle();
    if (data) { order = data; isAlbumAppend = true; }
  }

  if (!order) {
    const { data } = await supabase.from('orders').select('*').eq('assigned_to', profile.id).eq('status', 'awaiting_photos').limit(1).maybeSingle();
    if (data) order = data;
  }

  if (!order) {
    return sendTelegramMessage(chatId, '⚠️ Не удалось связать фото с active заказом. Убедитесь, что нажали кнопку "✅ ЗАВЕРШИТЬ ЗАКАЗ" в меню "Мои заказы".');
  }

  const photo = photoArray[photoArray.length - 1];
  const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${photo.file_id}`, {
    signal: AbortSignal.timeout(10000),
  }).then(r => r.json());
  if (!fileRes.ok) {
    console.error('❌ Telegram не смог получить фотоотчет:', fileRes);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Фотоотчет (getFile)',
      message: `Telegram не отдал файл для заказа "${order.title}" (${profile.full_name || profile.name || 'Сотрудник'})`,
      details: JSON.stringify(fileRes),
    });
    await sendTelegramMessage(chatId, '❌ Не удалось загрузить фотоотчет. Попробуйте отправить фотографию еще раз.');
    return;
  }

  const downloadRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileRes.result.file_path}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!downloadRes.ok) {
    console.error('❌ Telegram не смог скачать файл фотоотчета:', downloadRes.status);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Фотоотчет (download)',
      message: `Не удалось скачать фото из Telegram для заказа "${order.title}"`,
      details: `HTTP ${downloadRes.status}`,
    });
    await sendTelegramMessage(chatId, '❌ Не удалось скачать фотоотчет. Попробуйте отправить фотографию еще раз.');
    return;
  }
  const blob = await downloadRes.blob();
  const storagePath = `completed/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
  
  const { error: uploadErr } = await supabase.storage.from('order-photos').upload(storagePath, blob, { contentType: 'image/jpeg' });
  if (uploadErr) {
    console.error('❌ Ошибка загрузки фотоотчета в Supabase Storage:', uploadErr);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Фотоотчет (Storage)',
      message: `Ошибка загрузки фото в Supabase Storage для заказа "${order.title}"`,
      details: uploadErr.message,
    });
    await sendTelegramMessage(chatId, '❌ Не удалось сохранить фотоотчет. Попробуйте отправить фотографию еще раз.');
    return;
  }

  const { data: urlData } = supabase.storage.from('order-photos').getPublicUrl(storagePath);
  const { data: freshData, error: fetchError } = await supabase
    .from('orders')
    .select('image_urls, description')
    .eq('id', order.id)
    .maybeSingle();
  if (fetchError) {
    console.error('❌ Ошибка загрузки текущего фотоотчета:', fetchError);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Фотоотчет (БД)',
      message: `Ошибка чтения фотоотчета в БД для заказа "${order.title}"`,
      details: fetchError.message,
    });
    await sendTelegramMessage(chatId, '❌ Не удалось обновить фотоотчет. Попробуйте отправить фотографию еще раз.');
    return;
  }

  const currentImages = Array.isArray(freshData?.image_urls)
    ? freshData.image_urls
    : Array.isArray(order.image_urls)
      ? order.image_urls
      : [];
  const updatePayload: Record<string, any> = {
    status: 'completed',
    image_urls: [...currentImages, urlData.publicUrl],
  };

  if (mediaGroupId && !isAlbumAppend) {
    const currentDesc = freshData?.description || order.description || '';
    updatePayload.description = `${currentDesc}\n[album:${mediaGroupId}]`.trim();
  }

  const { error: updateError } = await supabase.from('orders').update(updatePayload).eq('id', order.id);
  if (updateError) {
    console.error('❌ Ошибка сохранения фотоотчета:', updateError);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Фотоотчет (БД)',
      message: `Ошибка сохранения фотоотчета в БД для заказа "${order.title}"`,
      details: updateError.message,
    });
    await sendTelegramMessage(chatId, '❌ Не удалось сохранить фотоотчет. Попробуйте отправить фотографию еще раз.');
    return;
  }
  const empName = profile.name || profile.full_name || 'Сотрудник';

  if (isAlbumAppend) {
    await notifyGroup(`📸 Дополнительное фото к объекту <b>${escapeHtml(order.title)}</b> от ${escapeHtml(empName)}`, urlData.publicUrl);
  } else {
    await notifyGroup(`✅ Заказ <b>${escapeHtml(order.title)}</b> успешно завершен с фотоотчетом от ${escapeHtml(empName)}.`, urlData.publicUrl);
    await sendTelegramMessage(chatId, `🎉 Объект <b>${escapeHtml(order.title)}</b> успешно закрыт! Фотоотчет отправлен в группу.`);
  }
}

// ОБРАБОТЧИК ОТКАЗА ОТ ЗАКАЗА
async function handleRejectOrder(orderId: string, profile: any, callbackQuery: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка доступа.';

  // Сбрасываем исполнителя и возвращаем статус "новый"
  const { error } = await supabase
    .from('orders')
    .update({ assigned_to: null, status: 'new' })
    .eq('id', orderId)
    .eq('assigned_to', profile.id);

  if (error) {
    await logAdminAlert({
      level: 'ERROR',
      source: 'Действие с заказом в боте',
      message: `Ошибка БД при отказе от заказа (${order?.title || orderId})`,
      details: error.message,
    });
    return `Ошибка БД: ${error.message}`;
  }

  const employeeName = profile.name || profile.full_name || 'Сотрудник';
  // Оповещаем чат производства
  await notifyGroup(`⚠️ Исполнитель ${escapeHtml(employeeName)} <b>отказался</b> от заказа <b>${escapeHtml(order.title)}</b>. Объект снова свободен.`);

  // Обновляем сообщение у самого монтажника в чате
  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const isPhoto = Boolean(callbackQuery.message.photo || callbackQuery.message.document);
    const text = `<b>⚠️ Вы отказались от заказа (передан в свободные)</b>\n${buildOrderPreview(order)}`;

    await sendTelegram({
      method: isPhoto ? 'editMessageCaption' : 'editMessageText',
      body: { chat_id: chatId, message_id: messageId, [isPhoto ? 'caption' : 'text']: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } },
    });
  }

  return 'Вы успешно отказались от заказа.';
}

async function handleCallbackQuery(callbackQuery: any) {
  const callbackData = String(callbackQuery.data || '');
  const callbackId = String(callbackQuery.id || '');
  const telegramId = String(callbackQuery.from?.id || '');
  const { action, id: orderId } = parseCallbackData(callbackData);
  if (!orderId) return answerCallbackQuery(callbackId, 'Ошибка команды.');

  if (action === 'logs') {
    if (!isAdminTelegramId(telegramId)) {
      return answerCallbackQuery(callbackId, 'Доступ запрещен.');
    }

    const msgChatId = callbackQuery.message?.chat?.id;
    const msgId = callbackQuery.message?.message_id;

    if (orderId === 'clear') {
      clearAdminLogs();
    } else if (orderId === 'test') {
      await logAdminAlert({
        level: 'INFO',
        source: 'Проверка связи',
        message: 'Тестовый алерт администратора работает исправно!',
      });
    }

    if (orderId === 'refresh' || orderId === 'clear' || orderId === 'test') {
      const view = await buildAdminLogsView();
      if (msgChatId && msgId) {
        await sendTelegram({
          method: 'editMessageText',
          body: {
            chat_id: msgChatId,
            message_id: msgId,
            text: view.text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: view.reply_markup,
          },
        });
      } else if (msgChatId) {
        await sendTelegramMessage(msgChatId, view.text, { reply_markup: view.reply_markup });
      }
      const feedback =
        orderId === 'clear'
          ? 'Журнал очищен'
          : orderId === 'test'
            ? 'Тестовый алерт отправлен'
            : 'Обновлено';
      await answerCallbackQuery(callbackId, feedback);
      return;
    }

    await answerCallbackQuery(callbackId, 'Неизвестная команда.');
    return;
  }

  const profile = await findProfileByTelegramId(telegramId);
  if (!profile) return answerCallbackQuery(callbackId, 'Ошибка профиля.');

  if (action === 'busy') {
    if (orderId === 'refresh') {
      const view = await buildWorkloadView();
      const msgChatId = callbackQuery.message?.chat?.id;
      const msgId = callbackQuery.message?.message_id;
      if (msgChatId && msgId) {
        await sendTelegram({
          method: 'editMessageText',
          body: {
            chat_id: msgChatId,
            message_id: msgId,
            text: view.text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: view.reply_markup,
          },
        });
      } else if (msgChatId) {
        await sendTelegramMessage(msgChatId, view.text, view.reply_markup ? { reply_markup: view.reply_markup } : {});
      }
      await answerCallbackQuery(callbackId, 'Обновлено');
      return;
    }

    if (callbackQuery.message?.chat?.id) {
      await handleEmployeeWorkload(callbackQuery.message.chat.id, orderId);
    }
    await answerCallbackQuery(callbackId, 'Список загружен');
    return;
  }

  if (action === 'desc') {
    const { data: order } = await supabase
      .from('orders')
      .select('title, description, department, dimensions, material, source_link, deadline')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      await answerCallbackQuery(callbackId, 'Заказ не найден.');
      return;
    }

    const lines: string[] = [`<b>📄 Описание объекта:</b> ${escapeHtml(order.title || '')}`];
    const deptLabel = formatDepartment(order.department);
    if (deptLabel) lines.push(`🏢 <b>Цех:</b> ${deptLabel}`);

    if (order.deadline) {
      const rawDeadline = String(order.deadline).trim();
      const deadlineDate = new Date(rawDeadline);
      const formattedDeadline = !isNaN(deadlineDate.getTime())
        ? deadlineDate.toLocaleDateString('ru-RU')
        : rawDeadline;
      lines.push(`📅 <b>Дедлайн:</b> ${escapeHtml(formattedDeadline)}`);
    }

    if (order.dimensions) {
      lines.push(`📐 <b>Размеры:</b> ${escapeHtml(String(order.dimensions))}`);
    }
    if (order.material) {
      lines.push(`🎨 <b>Материал:</b> ${escapeHtml(String(order.material))}`);
    }
    if (order.source_link) {
      const link = String(order.source_link).trim();
      if (/^https?:\/\//i.test(link)) {
        lines.push(`🔗 <b>Макет:</b> <a href="${escapeHtml(link)}">открыть</a>`);
      } else {
        lines.push(`🔗 <b>Макет:</b> ${escapeHtml(link)}`);
      }
    }

    const descText = String(order.description || '').replace(/\[album:.*?\]/g, '').trim();
    lines.push('', escapeHtml(descText || 'Деталей нет.'));

    if (callbackQuery.message?.chat?.id) {
      await sendTelegramMessage(callbackQuery.message.chat.id, lines.join('\n'));
    }
    await answerCallbackQuery(callbackId, 'Описание выведено!');
    return;
  }

  let msg = 'Выполнено.';
  if (action === 'take' || action === 'take_print') msg = await handleTakeOrder(orderId, profile, callbackQuery);
  else if (action === 'reject') msg = await handleRejectOrder(orderId, profile, callbackQuery); // Экшен отказа
  else if (action === 'office' || action === 'print_to_office') msg = await handleMoveToOffice(orderId, profile, callbackQuery);
  else if (action === 'production' || action === 'print_to_production') msg = await handleMoveToProduction(orderId, profile, callbackQuery);
  else if (action === 'installation' || action === 'print_to_installation') msg = await handleMoveToInstallation(orderId, profile, callbackQuery);
  else if (action === 'complete') msg = await handleRequestPhotoOrder(orderId, profile, callbackQuery);
  else if (action === 'complete_without_photo' || action === 'finish_without_photo') msg = await handleCompleteOrder(orderId, profile, true, callbackQuery);

  await answerCallbackQuery(callbackId, msg);
}

async function handleTakeOrder(orderId: string, profile: any, callbackQuery: any) {
  const { data: order, error: fetchError } = await supabase.from('orders').select('*').eq('id', orderId).single();
  const assignedToAnother = Boolean(order?.assigned_to && order.assigned_to !== profile.id);
  if (
    fetchError ||
    !order ||
    order.status === 'completed' ||
    assignedToAnother ||
    (order.assigned_to === profile.id && order.status !== 'new')
  ) {
    return 'Заказ недоступен или уже кем-то занят.';
  }

  let updateQuery = supabase
    .from('orders')
    .update({ assigned_to: profile.id, status: 'in_progress', is_general: false })
    .eq('id', orderId);

  if (!order.assigned_to) {
    updateQuery = updateQuery.is('assigned_to', null).neq('status', 'completed');
  } else {
    updateQuery = updateQuery.eq('assigned_to', profile.id).eq('status', 'new');
  }

  const { data: updatedOrder, error: updateError } = await updateQuery.select('id').maybeSingle();

  if (updateError) {
    console.error('❌ Ошибка Supabase при попытке взять заказ:', updateError);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Действие с заказом в боте',
      message: `Ошибка БД при взятии заказа (${order?.title || orderId})`,
      details: updateError.message,
    });
    return `Ошибка БД: ${updateError.message}`;
  }

  if (!updatedOrder) {
    return 'Заказ недоступен или уже кем-то занят.';
  }

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

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'awaiting_photos' })
    .eq('id', orderId)
    .eq('assigned_to', profile.id);
  if (updateError) {
    console.error('❌ Ошибка перевода в awaiting_photos:', updateError);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Действие с заказом в боте',
      message: `Ошибка БД при переводе в awaiting_photos (${order?.title || orderId})`,
      details: updateError.message,
    });
    return 'Ошибка обновления статуса.';
  }

  if (callbackQuery?.message?.chat?.id && callbackQuery?.message?.message_id) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const isPhoto = Boolean(callbackQuery.message.photo || callbackQuery.message.document);
    const text = `📸 <b>Ожидание фотоотчета</b>\n${buildOrderPreview(order)}\n\nПришлите фото выполненной работы прямо сюда в чат.\nЕсли возможности сделать фото нет — нажмите кнопку ниже.`;

    await sendTelegram({
      method: isPhoto ? 'editMessageCaption' : 'editMessageText',
      body: { chat_id: chatId, message_id: messageId, [isPhoto ? 'caption' : 'text']: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🚫 ЗАВЕРШИТЬ БЕЗ ФОТО', callback_data: `complete_without_photo_${order.id}` }]] } },
    });
  }
  return 'Жду фотографию...';
}

async function handleCompleteOrder(orderId: string, profile: any, withoutPhoto = false, callbackQuery: any) {
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order || order.assigned_to !== profile.id) return 'Ошибка доступа.';

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', orderId)
    .eq('assigned_to', profile.id);
  if (updateError) {
    console.error('❌ Ошибка закрытия заказа:', updateError);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Действие с заказом в боте',
      message: `Ошибка БД при закрытии заказа (${order?.title || orderId})`,
      details: updateError.message,
    });
    return 'Ошибка закрытия заказа.';
  }

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
  if (!order || order.assigned_to !== profile.id) return 'Ошибка доступа.';

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', orderId)
    .eq('assigned_to', profile.id);
  if (updateError) {
    console.error('❌ Ошибка передачи в офис:', updateError);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Действие с заказом в боте',
      message: `Ошибка БД при передаче в офис (${order?.title || orderId})`,
      details: updateError.message,
    });
    return 'Ошибка передачи в офис.';
  }

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
  if (!order || (order.assigned_to !== profile.id && !profile.can_print && profile.role !== 'admin')) {
    return 'Ошибка доступа.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ department: 'production', status: 'new', assigned_to: null })
    .eq('id', orderId);
  if (updateError) {
    console.error('❌ Ошибка перевода на изготовление:', updateError);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Действие с заказом в боте',
      message: `Ошибка БД при переводе на изготовление (${order?.title || orderId})`,
      details: updateError.message,
    });
    return 'Ошибка перевода на изготовление.';
  }

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
  if (!order || (order.assigned_to !== profile.id && !profile.can_print && profile.role !== 'admin')) {
    return 'Ошибка доступа.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ department: 'installation', status: 'new', assigned_to: null })
    .eq('id', orderId);
  if (updateError) {
    console.error('❌ Ошибка перевода на монтаж:', updateError);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Действие с заказом в боте',
      message: `Ошибка БД при переводе на монтаж (${order?.title || orderId})`,
      details: updateError.message,
    });
    return 'Ошибка перевода на монтаж.';
  }

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
  if (error) {
    await logAdminAlert({ level: 'ERROR', source: 'handlePrintQueue', message: 'Ошибка загрузки данных из Supabase', details: error.message });
    return sendTelegramMessage(chatId, 'Ошибка загрузки очереди.');
  }

  const filteredOrders = (orders || []).filter(order => !order.assigned_to || (order.assigned_to === profile.id && order.status === 'new'));
  if (!filteredOrders.length) return sendTelegramMessage(chatId, 'Очередь на печать пуста.');

  for (const order of filteredOrders) {
    const text = [`<b>🖨 Очередь на печать</b>`, buildOrderPreview(order)].join('\n');
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: 'Взять в работу', callback_data: `take_${order.id}` },
          { text: '📄 Описание заказа', callback_data: `desc_${order.id}` },
        ],
      ],
    };
    await sendOrderToTelegram(chatId, text, replyMarkup, order.image_urls);
  }
}

async function buildWorkloadView(): Promise<{ text: string; reply_markup?: { inline_keyboard: any[][] } }> {
  const [{ data: profiles, error: profilesError }, { data: activeOrders, error: ordersError }] = await Promise.all([
    supabase.from('profiles').select('id, name, full_name, role'),
    supabase
      .from('orders')
      .select('id, assigned_to, deadline, status')
      .not('status', 'in', '("completed","cancelled")'),
  ]);

  if (profilesError || ordersError) {
    console.error('❌ Ошибка загрузки занятости:', profilesError || ordersError);
    await logAdminAlert({
      level: 'ERROR',
      source: 'buildWorkloadView',
      message: 'Ошибка загрузки данных из Supabase',
      details: (profilesError || ordersError)?.message,
    });
    return { text: '❌ Не удалось загрузить занятость сотрудников. Попробуйте позже.' };
  }

  const todayStr = getAlmatyDateString(new Date());
  const statsByUser: Record<string, { total: number; urgent: number }> = {};
  let freeCount = 0;
  let assignedTotal = 0;

  for (const order of activeOrders || []) {
    if (!order.assigned_to) {
      freeCount++;
      continue;
    }
    assignedTotal++;
    const current = statsByUser[order.assigned_to] || { total: 0, urgent: 0 };
    current.total += 1;
    if (isOrderUrgent(order.deadline, todayStr)) {
      current.urgent += 1;
    }
    statsByUser[order.assigned_to] = current;
  }

  const staffList = (profiles || [])
    .filter((p: any) => p.role !== 'admin' || (statsByUser[p.id]?.total || 0) > 0)
    .map((p: any) => {
      const counts = statsByUser[p.id] || { total: 0, urgent: 0 };
      const displayName = String(p.full_name || p.name || 'Сотрудник');
      return {
        id: p.id,
        displayName,
        total: counts.total,
        urgent: counts.urgent,
      };
    })
    .sort((a, b) => a.total - b.total || a.displayName.localeCompare(b.displayName, 'ru'));

  const inline_keyboard = staffList.map((emp) => {
    const icon = emp.total === 0 ? '🟢' : emp.total <= 2 ? '🟡' : '🔴';
    const urgentSuffix = emp.urgent > 0 ? ` (${emp.urgent} 🔥)` : '';
    return [
      {
        text: `${icon} ${emp.displayName} — ${emp.total}${urgentSuffix}`,
        callback_data: `busy_${emp.id}`,
      },
    ];
  });
  inline_keyboard.push([{ text: '🔄 Обновить', callback_data: 'busy_refresh' }]);

  const text = [
    '<b>👥 Занятость сотрудников</b>',
    `В работе у сотрудников: <b>${assignedTotal}</b> | Свободных: <b>${freeCount}</b>`,
    '',
    staffList.length ? 'Нажмите на сотрудника, чтобы посмотреть его заказы:' : 'Сотрудники не найдены.',
  ].join('\n');

  return { text, reply_markup: { inline_keyboard } };
}

async function handleWorkloadMenu(chatId: number | string) {
  const view = await buildWorkloadView();
  await sendTelegramMessage(chatId, view.text, view.reply_markup ? { reply_markup: view.reply_markup } : {});
}

async function handleEmployeeWorkload(chatId: number | string, employeeId: string) {
  const [{ data: employee }, { data: orders, error }] = await Promise.all([
    supabase.from('profiles').select('id, name, full_name').eq('id', employeeId).maybeSingle(),
    supabase
      .from('orders')
      .select('title')
      .eq('assigned_to', employeeId)
      .not('status', 'in', '("completed","cancelled")')
      .order('deadline', { ascending: true }),
  ]);

  if (error) {
    console.error('❌ Ошибка загрузки заказов сотрудника:', error);
    await logAdminAlert({ level: 'ERROR', source: 'handleEmployeeWorkload', message: 'Ошибка загрузки данных из Supabase', details: error.message });
    await sendTelegramMessage(chatId, '❌ Не удалось загрузить заказы сотрудника.');
    await handleWorkloadMenu(chatId);
    return;
  }

  const empName = String(employee?.full_name || employee?.name || 'Сотрудник');
  const activeOrders = orders || [];

  let text: string;
  if (activeOrders.length > 0) {
    const titles = activeOrders
      .map((o: any, idx: number) => `${idx + 1}. ${escapeHtml(String(o.title || 'Без названия'))}`)
      .join('\n');
    text = `<b>👷 ${escapeHtml(empName)}</b> — активных заказов: <b>${activeOrders.length}</b>\n\n${titles}`;
  } else {
    text = `<b>👷 ${escapeHtml(empName)}</b>\n\nСейчас свободен — активных заказов нет.`;
  }

  await sendTelegramMessage(chatId, text);
  await handleWorkloadMenu(chatId);
}

async function buildAdminLogsView(): Promise<{ text: string; reply_markup: { inline_keyboard: any[][] } }> {
  const t0 = Date.now();
  const [profilesRes, activeOrdersRes, recentOrdersRes, storageRes] = await Promise.all([
    supabase.from('profiles').select('id, name, full_name'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("completed","cancelled")'),
    supabase
      .from('orders')
      .select('id, title, status, department, assigned_to, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.storage.from('order-photos').list('', { limit: 1 }),
  ]);
  const latencyMs = Date.now() - t0;

  const profilesList = profilesRes.data || [];
  const namesMap: Record<string, string> = {};
  for (const p of profilesList) {
    namesMap[p.id] = String(p.full_name || p.name || 'Сотрудник');
  }

  const dbError = profilesRes.error || activeOrdersRes.error || recentOrdersRes.error;
  const dbStatus = dbError
    ? `❌ Ошибка (${escapeHtml(dbError.message)})`
    : `✅ OK (${latencyMs} мс)`;
  const storageStatus = storageRes.error
    ? `❌ Ошибка (${escapeHtml(storageRes.error.message)})`
    : '✅ OK';
  const telegramStatus = TELEGRAM_TOKEN && GROUP_CHAT_ID
    ? '✅ Токен и группа настроены'
    : `⚠️ Неполный конфиг (Бот: ${TELEGRAM_TOKEN ? 'да' : 'нет'}, Группа: ${GROUP_CHAT_ID ? 'да' : 'нет'})`;

  const statusIcons: Record<string, string> = {
    new: '🆕',
    in_progress: '⏳',
    awaiting_photos: '📸',
    completed: '✅',
    cancelled: '🚫',
  };

  const recentOrders = recentOrdersRes.data || [];
  const ordersLines = recentOrders.length
    ? recentOrders.map((ord: any) => {
        const icon = statusIcons[ord.status] || '📦';
        const dept = formatDepartment(ord.department);
        const worker = ord.assigned_to ? (namesMap[ord.assigned_to] || 'Сотрудник') : 'Свободен';
        const createdAt = ord.created_at
          ? new Date(ord.created_at).toLocaleString('ru-RU', {
              timeZone: 'Asia/Almaty',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        return `${icon} <b>${escapeHtml(String(ord.title || 'Без названия'))}</b>\n   ${dept ? `${dept} | ` : ''}${escapeHtml(worker)}${createdAt ? ` • ${escapeHtml(createdAt)}` : ''}`;
      })
    : ['Заказов пока нет.'];

  const recentLogs = getRecentAdminLogs().slice(0, 8);
  const logsLines = recentLogs.length
    ? recentLogs.map((entry) => {
        const icon = entry.level === 'ERROR' ? '🚨' : entry.level === 'SECURITY' ? '🔐' : 'ℹ️';
        const detailsLine = entry.details
          ? `\n   <code>${escapeHtml(entry.details.slice(0, 140))}</code>`
          : '';
        return `${icon} [${escapeHtml(entry.time)}] <b>${escapeHtml(entry.source)}</b>: ${escapeHtml(entry.message)}${detailsLine}`;
      })
    : ['✅ Ошибок и подозрительных событий не зафиксировано.'];

  const updatedAt = new Date().toLocaleTimeString('ru-RU', { timeZone: 'Asia/Almaty' });
  const text = [
    '<b>🛡 Админ-панель и Логи системы</b>',
    '',
    '<b>🩺 Здоровье системы:</b>',
    `• База данных Supabase: ${dbStatus}`,
    `• Хранилище (order-photos): ${storageStatus}`,
    `• Telegram: ${telegramStatus}`,
    `• Сотрудников: <b>${profilesList.length}</b> | Активных заказов: <b>${activeOrdersRes.count ?? 0}</b>`,
    '',
    '<b>🕒 Последние 5 заказов в БД:</b>',
    ...ordersLines,
    '',
    '<b>🚨 Журнал событий (ошибки и входы):</b>',
    ...logsLines,
    '',
    `<i>Обновлено: ${escapeHtml(updatedAt)} (Алматы)</i>`,
  ].join('\n');

  return {
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔄 Обновить', callback_data: 'logs_refresh' },
          { text: '🧪 Тест алерта', callback_data: 'logs_test' },
        ],
        [{ text: '🧹 Очистить журнал', callback_data: 'logs_clear' }],
      ],
    },
  };
}

async function handleAdminLogsMenu(chatId: number | string) {
  const view = await buildAdminLogsView();
  await sendTelegramMessage(chatId, view.text, { reply_markup: view.reply_markup });
}

function parseCallbackData(data: string) {
  const normalized = data.replace(/:/g, '_');
  const knownActions = ['reject', 'complete_without_photo', 'complete_with_photo', 'finish_without_photo', 'print_to_office', 'print_to_production', 'print_to_installation', 'take_print', 'take', 'office', 'production', 'installation', 'complete', 'desc', 'busy', 'logs'];
  for (const action of knownActions) { if (normalized.startsWith(`${action}_`)) return { action, id: normalized.slice(action.length + 1) }; }
  const [action, ...rest] = normalized.split('_');
  return { action, id: rest.join('_') };
}

export async function POST(request: Request) {
  if (!TELEGRAM_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false }, { status: 500 });
  const update = await request.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: false }, { status: 400 });

  if (update.message && update.message.chat?.type !== 'private') return new Response('OK', { status: 200 });
  if (update.callback_query) {
    try {
      await handleCallbackQuery(update.callback_query);
    } catch (error: any) {
      console.error('Telegram callback failed:', error);
      await logAdminAlert({
        level: 'ERROR',
        source: 'Webhook callback_query',
        message: 'Необработанная ошибка при обработке кнопки в Telegram',
        details: String(error?.message || error),
      });
    }
    return new Response('OK', { status: 200 });
  }

  if (update.message) {
    const chatId = update.message.chat?.id;
    const telegramId = String(update.message.from?.id || '');
    if (!chatId) return NextResponse.json({ ok: false }, { status: 400 });

    try {
      // Решение проблемы 3: Жесткий блок PDF и других некорректных документов
      if (update.message.document) {
        const doc = update.message.document;
        const mimeType = doc.mime_type || '';
        const fileName = doc.file_name || '';
        const isPdf = mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

        if (isPdf || !mimeType.startsWith('image/')) {
          await sendTelegramMessage(chatId, `⚠️ <b>Ошибка загрузки файла!</b>\nФормат PDF и другие документы не поддерживаются системой. Пожалуйста, отправляйте только изображения (картинки с расширением JPEG, PNG, WEBP).`);
          return new Response('OK', { status: 200 });
        }
      }

      if (update.message.photo) {
        await handleIncomingPhoto(chatId, telegramId, update.message.photo, update.message.media_group_id);
        return new Response('OK', { status: 200 });
      }

      const text = typeof update.message.text === 'string' ? update.message.text.trim() : '';
      if ((text === '📜 Логи' || text === '/logs') && (isAdminTelegramId(telegramId) || isAdminTelegramId(chatId))) {
        await handleAdminLogsMenu(chatId);
        return new Response('OK', { status: 200 });
      }

      const currentProfile = await findProfileByTelegramId(telegramId);
      
      if (!currentProfile) {
        if (text === '/start') {
          await handleStartCommand(chatId, telegramId);
          return NextResponse.json({ ok: true }, { status: 200 });
        }

        const handled = await handlePinAuthorization(chatId, telegramId, text, update.message.from);
        if (handled) return NextResponse.json({ ok: true }, { status: 200 });
        
        await sendTelegramMessage(chatId, 'Пожалуйста, введите ваш персональный ПИН-код:');
        return new Response('OK', { status: 200 });
      }

      switch (text) {
        case '/start': await handleStartCommand(chatId, telegramId); break;
        case '📋 Активные заказы': await handleActiveOrders(chatId); break;
        case '🔓 Свободные заказы': await handleFreeOrders(chatId); break;
        case '💼 Мои заказы': await handleMyOrders(chatId, currentProfile); break;
        case '👤 Мой профиль': {
          const { data: activeOrders } = await supabase.from('orders').select('id, deadline').eq('assigned_to', currentProfile.id).neq('status', 'completed');
          const { data: completedOrders } = await supabase.from('orders').select('id').eq('assigned_to', currentProfile.id).eq('status', 'completed');
          const deadlines = (activeOrders || []).map((o: any) => o.deadline).filter(Boolean).map((v: string) => new Date(v)).sort((a, b) => a.getTime() - b.getTime()).slice(0, 3).map((d: Date) => escapeHtml(d.toLocaleDateString('ru-RU')));
          await sendMainMenu(chatId, Boolean(currentProfile.can_print));
          await sendTelegramMessage(chatId, `<b>👤 Мой профиль</b>\nВ работе: ${activeOrders?.length || 0}\nЗавершено: ${completedOrders?.length || 0}\n\n<b>Ближайшие дедлайны</b>:\n${deadlines.length ? deadlines.join('\n') : 'Нет дедлайнов.'}`);
          break;
        }
        case '👥 Занятость': {
          await handleWorkloadMenu(chatId);
          break;
        }
        case '🖨 Очередь на печать': {
          if (currentProfile?.can_print) await handlePrintQueue(chatId, currentProfile);
          else await sendMainMenu(chatId, false);
          break;
        }
        case '📜 Логи':
        case '/logs': {
          if (isAdminTelegramId(telegramId) || isAdminTelegramId(chatId)) {
            await handleAdminLogsMenu(chatId);
          } else {
            await sendMainMenu(chatId, Boolean(currentProfile?.can_print));
          }
          break;
        }
        default: {
          await sendMainMenu(chatId, Boolean(currentProfile?.can_print));
          break;
        }
      }
    } catch (error: any) {
      console.error('Telegram failed:', error);
      await logAdminAlert({
        level: 'ERROR',
        source: 'Webhook POST',
        message: 'Необработанная ошибка в Telegram webhook',
        details: String(error?.message || error),
      });
    }
    return new Response('OK', { status: 200 });
  }
  return new Response('OK', { status: 200 });
}