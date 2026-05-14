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
  creator_id?: string; // ID пользователя, создавшего заказ в клиентских запросах
  created_by?: string; // ID пользователя, создавшего заказ из строки заказа в БД
  creator_full_name?: string; // Если профиль уже был подтянут ранее
}

/**
 * Отправляет уведомление о новом заказе в Telegram группу
 * Используется для уведомления всей команды о создании заказа на сайте
 */
export async function notifyNewOrderToGroup(orderData: OrderData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;

  // Проверка наличия необходимых переменных окружения
  if (!botToken || !groupChatId) {
    console.warn('⚠️ Telegram config missing. Set TELEGRAM_BOT_TOKEN and TELEGRAM_GROUP_CHAT_ID in .env');
    return { success: false, error: 'Telegram config not configured' };
  }

  try {
    // Получаем информацию о создателе заказа
    let creatorName = orderData.creator_full_name || 'Неизвестный пользователь';
    const creatorId = orderData.created_by || orderData.creator_id;
    if (creatorId) {
      try {
        // Динамический импорт Supabase (только на server-side)
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', creatorId)
          .single();
        
        if (profile?.full_name) {
          creatorName = profile.full_name;
        }
      } catch (err) {
        console.error('⚠️ Не удалось получить информацию о создателе:', err);
        // Продолжаем с значением по умолчанию
      }
    }

    // Формирование красивого HTML сообщения
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

👤 <b>Создал:</b> ${escapeHtml(creatorName)}
⏱ Время создания: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}
    `.trim();

    // Отправка POST запроса к Telegram Bot API
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: groupChatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Telegram API Error:', errorData);
      return {
        success: false,
        error: `Telegram API Error: ${errorData.description || 'Unknown error'}`,
      };
    }

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Telegram notification sent successfully:', result.result.message_id);
      return { success: true, messageId: result.result.message_id };
    } else {
      console.error('❌ Telegram API returned error:', result);
      return { success: false, error: result.description };
    }
  } catch (error) {
    console.error('❌ Error sending Telegram notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Отправляет уведомление конкретному пользователю (исполнителю)
 * Используется для уведомления назначенного на заказ монтажника
 */
export async function notifyOrderToUser(chatId: string, title: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set in .env');
    return { success: false, error: 'Telegram config not configured' };
  }

  try {
    const messageText = `🔔 <b>ЛИЧНЫЙ ЗАКАЗ!</b>\n\nТебе назначили новый объект: <b>${escapeHtml(title)}</b>\n\nЗайди в раздел «📦 Мои заказы», чтобы посмотреть детали.`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Telegram API Error:', errorData);
      return { success: false, error: errorData.description };
    }

    const result = await response.json();

    if (result.ok) {
      console.log('✅ Personal notification sent successfully');
      return { success: true, messageId: result.result.message_id };
    } else {
      return { success: false, error: result.description };
    }
  } catch (error) {
    console.error('❌ Error sending personal notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Экранирует специальные символы для HTML в Telegram
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
