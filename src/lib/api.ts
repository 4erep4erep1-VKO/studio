import { supabase } from '@/lib/supabase';
import type { Order, Comment, User, UserRole } from '@/lib/types';

// ##################################################################
// ##                      Типы и Мапперы                          ##
// ##################################################################

// Тип для сырых данных из таблицы 'orders'
type SupabaseOrderRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  image_urls: string[];
  assigned_to: string | null;
  created_at: string;
  due_date: string | null;
};

// Тип для сырых данных из таблицы 'profiles'
type SupabaseProfileRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
    pin_code: string | null;
    created_at: string;
    updated_at: string;
}

// Фронтенд-тип для полного профиля пользователя
export type Profile = User & {
    pin?: string;
}

// Конвертирует сырые данные заказа из БД в формат приложения
const mapRowToOrder = (row: SupabaseOrderRow): Order => ({
  id: row.id,
  objectName: row.title,
  workDescription: row.description,
  status: row.status as Order['status'],
  imageUrls: row.image_urls || [],
  installerId: row.assigned_to || 'general',
  createdAt: row.created_at,
  updatedAt: row.created_at, // supabase не предоставляет это поле, используем created_at
  dueDate: row.due_date || new Date().toISOString(),
});

// Конвертирует сырые данные профиля из БД в формат User (для списков)
const mapRowToUser = (row: SupabaseProfileRow): User => ({
    id: row.id,
    name: row.full_name || 'Имя не указано',
    email: row.email || 'Email не указан',
    role: (row.role || 'installer') as UserRole,
});

// Конвертирует сырые данные профиля из БД в формат Profile (детальный)
const mapRowToProfile = (row: SupabaseProfileRow): Profile => ({
    id: row.id,
    name: row.full_name || 'Имя не указано',
    email: row.email || 'Email не указан',
    role: (row.role || 'installer') as UserRole,
    pin: row.pin_code || undefined,
});

// ##################################################################
// ##                 Централизованный обработчик ошибок           ##
// ##################################################################

async function handleApiError(error: any, defaultMessage: string) {
    if (error) {
        console.error(`API Error: ${defaultMessage}`, error);
        throw new Error(error.message || defaultMessage);
    }
}

// ##################################################################
// ##                        Orders API                            ##
// ##################################################################

export async function getOrders(): Promise<Order[]> {
  try {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    await handleApiError(error, 'Ошибка загрузки заказов');
    return (data || []).map(mapRowToOrder);
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось получить заказы.');
  }
}

export async function createOrder(order: Partial<Order>): Promise<Order> {
  try {
    const { data, error } = await supabase.from('orders').insert({
        title: order.objectName,
        description: order.workDescription,
        status: order.status,
        image_urls: order.imageUrls,
        assigned_to: order.installerId === 'general' ? null : order.installerId,
        due_date: order.dueDate,
    }).select().single();
    await handleApiError(error, 'Ошибка создания заказа');
    return mapRowToOrder(data);
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось создать заказ.');
  }
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
  try {
    const { data, error } = await supabase.from('orders').update({
        title: updates.objectName,
        description: updates.workDescription,
        status: updates.status,
        image_urls: updates.imageUrls,
        assigned_to: updates.installerId === 'general' ? null : updates.installerId,
        due_date: updates.dueDate,
    }).eq('id', id).select().single();
    await handleApiError(error, 'Ошибка обновления заказа');
    return mapRowToOrder(data);
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось обновить заказ.');
  }
}

export async function deleteOrder(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    await handleApiError(error, 'Ошибка удаления заказа');
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось удалить заказ.');
  }
}

// ##################################################################
// ##                         Users API                            ##
// ##################################################################

export async function getUsers(): Promise<User[]> {
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        await handleApiError(error, 'Ошибка получения списка пользователей');
        return (data || []).map(mapRowToUser);
    } catch (err: any) {
        throw new Error(err.message || 'Не удалось получить пользователей.');
    }
}

export async function createUser(userData: { name: string; email: string; password?: string; role: UserRole; }): Promise<User> {
    try {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: userData.email,
            password: userData.password!,
            email_confirm: true, // Сразу подтверждаем email
            user_metadata: { full_name: userData.name },
        });
        await handleApiError(authError, 'Ошибка создания аутентификации пользователя.');

        const { data: profileData, error: profileError } = await supabase.from('profiles').update({ 
            full_name: userData.name,
            role: userData.role // ИСПРАВЛЕНО: Используем переданную роль
        }).eq('id', authData.user.id).select().single();
        
        await handleApiError(profileError, 'Ошибка обновления профиля пользователя.');

        return mapRowToUser(profileData);
    } catch (err: any) {
        throw new Error(err.message || 'Не удалось создать пользователя.');
    }
}

export async function deleteUser(userId: string): Promise<void> {
    try {
        const { error } = await supabase.auth.admin.deleteUser(userId);
        await handleApiError(error, 'Ошибка удаления пользователя.');
    } catch (err: any) {
        throw new Error(err.message || 'Не удалось удалить пользователя.');
    }
}

// ##################################################################
// ##                        Profile API                           ##
// ##################################################################

export async function getProfile(userId: string): Promise<Profile | null> {
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (error?.code === 'PGRST116') return null; // Не найдено, не считаем ошибкой
        await handleApiError(error, 'Ошибка получения профиля');
        return data ? mapRowToProfile(data) : null;
    } catch (err: any) {
        throw new Error(err.message || 'Не удалось получить профиль.');
    }
}

export async function updateProfile(userId: string, updates: { name?: string; pin?: string }): Promise<Profile> {
    try {
        const payload: { full_name?: string; pin_code?: string } = {};
        if (updates.name) payload.full_name = updates.name;
        if (updates.pin) payload.pin_code = updates.pin;

        if (Object.keys(payload).length === 0) {
            throw new Error("Нет данных для обновления.");
        }

        const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select().single();
        await handleApiError(error, 'Ошибка обновления профиля');
        return mapRowToProfile(data);
    } catch (err: any) {
        throw new Error(err.message || 'Не удалось обновить профиль.');
    }
}

// ##################################################################
// ##                       Image Upload API                       ##
// ##################################################################

export async function uploadImage(file: File): Promise<string> {
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Размер файла не должен превышать 5MB');

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `order-photos/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('order-photos').upload(filePath, file);
    await handleApiError(uploadError, 'Ошибка загрузки изображения');

    const { data } = supabase.storage.from('order-photos').getPublicUrl(filePath);
    if (!data?.publicUrl) throw new Error('Не удалось получить URL изображения');
    
    return data.publicUrl;
  } catch (err: any) {
    throw new Error(err.message || 'Неизвестная ошибка при загрузке изображения.');
  }
}

// ##################################################################
// ##                       Comments API                           ##
// ##################################################################

export async function getComments(orderId: string): Promise<Comment[]> {
  try {
    const { data, error } = await supabase.from('order_comments').select('*').eq('order_id', orderId).order('created_at', { ascending: true });
    await handleApiError(error, 'Ошибка загрузки комментариев');
    return (data || []).map((row: any) => ({
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      userName: row.user_name,
      message: row.content,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось получить комментарии.');
  }
}

export async function addComment(orderId: string, content: string): Promise<Comment> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Пользователь не авторизован');

    const { data, error } = await supabase.from('order_comments').insert({
        order_id: orderId,
        user_id: user.id,
        user_name: user.user_metadata.full_name || user.email,
        content: content.trim(),
    }).select().single();

    await handleApiError(error, 'Ошибка добавления комментария');
    return { ...data, message: data.content, orderId: data.order_id, userId: data.user_id, userName: data.user_name };
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось добавить комментарий.');
  }
}
