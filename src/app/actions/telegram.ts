'use server';

interface OrderData {
  title: string;
  description?: string;
  department?: string;
  deadline?: string;
  is_general?: boolean;
  assigned_to?: string;
  dimensions?: string;
  material?: string;
  source_link?: string;
  creator_id?: string; 
  created_by?: string; 
  creator_full_name?: string; // Самый надежный способ — передать имя сразу
}

export async function notifyNewOrderToGroup(orderData: OrderData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;

  if (!botToken || !groupChatId) {
    console.warn('⚠️ Telegram config missing');
    return { success: false, error: 'Telegram config missing' };
  }

  try {
    // 1. Пытаемся взять имя, если оно уже передано (самый быстрый вариант)
    let creatorName = orderData.creator_full_name;

    // 2. Если имени нет, но есть ID — идем в базу
    const creatorId = orderData.created_by || orderData.creator_id;
    
    if (!creatorName && creatorId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Проверь, что этот ключ есть в .env!
        );
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', creatorId)
          .single();
        
        if (error) console.error('❌ Ошибка запроса профиля:', error.message);
        if (profile?.full_name) {
          creatorName = profile.full_name;
        }
      } catch (err) {
        console.error('⚠️ Ошибка при подключении к Supabase в Telegram Action:', err);
      }
    }

    // Если всё равно пусто — пишем дефолт
    const finalCreatorName = creatorName || 'Неизвестный пользователь';

    const departmentLabel = orderData.department === 'print' ? '🖨 Печать' : '🛠 Монтаж';
    const typeLabel = orderData.is_general ? '🌍 Общий' : '👤 Личный';
    const deadline = orderData.deadline 
      ? new Date(orderData.deadline).toLocaleDateString('ru-RU')
      : 'Не указан';

    const messageText = `
🆕 <b>Новый заказ (создан на сайте)</b>

📦 <b>Название:</b> ${escapeHtml(orderData.title)}
${orderData.description ? `📝 <b>Описание:</b> ${escapeHtml(orderData.description)}` : ''}

🏢 <b>Отдел:</b> ${departmentLabel}
📌 <b>Тип:</b> ${typeLabel}
📅 <b>Дедлайн:</b> ${deadline}

${orderData.dimensions ? `📐 <b>Размеры:</b> ${escapeHtml(orderData.dimensions)}` : ''}
${orderData.material ? `🎨 <b>Материал:</b> ${escapeHtml(orderData.material)}` : ''}
${orderData.source_link ? `🔗 <b>Ссылка на макет:</b> <a href="${orderData.source_link}">открыть</a>` : ''}

👤 <b>Создал:</b> ${escapeHtml(finalCreatorName)}
⏱ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}
    `.trim();

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: groupChatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    return { success: response.ok };
  } catch (error) {
    console.error('❌ Error sending Telegram notification:', error);
    return { success: false, error: 'Internal error' };
  }
}

/** Вспомогательные функции **/
export async function notifyOrderToUser(chatId: string, title: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { success: false };

  const messageText = `🔔 <b>ЛИЧНЫЙ ЗАКАЗ!</b>\n\nТебе назначили новый объект: <b>${escapeHtml(title)}</b>\n\nЗайди в «📦 Мои заказы».`;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: messageText, parse_mode: 'HTML' }),
  });
  return { success: response.ok };
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}