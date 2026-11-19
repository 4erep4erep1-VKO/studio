import { supabase } from '@/lib/supabase';
import type { User } from '@/lib/types';

export type { User };

// Тип для сырых данных из таблицы 'profiles'
type SupabaseProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  pin_code: string | null;
  created_at: string;
  updated_at: string;
};

// Фронтенд-тип для полного профиля пользователя
export type Profile = User & {
  pin?: string;
};

// Конвертирует сырые данные профиля из БД в формат User (для списков)
const mapRowToUser = (row: SupabaseProfileRow): User => ({
  id: row.id,
  name: row.full_name || 'Имя не указано',
  email: row.email || 'Email не указан',
  role: (row.role === 'admin' ? 'admin' : 'installer'),
  pin: row.pin_code || undefined,
});

// Конвертирует сырые данные профиля из БД в формат Profile (детальный)
const mapRowToProfile = (row: SupabaseProfileRow): Profile => ({
  id: row.id,
  name: row.full_name || 'Имя не указано',
  email: row.email || 'Email не указан',
  role: (row.role === 'admin' ? 'admin' : 'installer'),
  pin: row.pin_code || undefined,
});

async function handleApiError(error: any, defaultMessage: string) {
  if (error) {
    console.error(`API Error: ${defaultMessage}`, error);
    throw new Error(error.message || defaultMessage);
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    await handleApiError(error, 'Ошибка получения списка пользователей');
    return (data || []).map(mapRowToUser);
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось получить пользователей.');
  }
}

export async function createUser(userData: {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'installer';
}): Promise<User> {
  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password!,
      email_confirm: true,
      user_metadata: { full_name: userData.name },
    });
    await handleApiError(authError, 'Ошибка создания аутентификации пользователя.');

    if (!authData.user) {
      throw new Error('Не удалось получить данные созданного пользователя.');
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: userData.name,
        role: userData.role,
      })
      .eq('id', authData.user.id)
      .select()
      .single();

    await handleApiError(profileError, 'Ошибка обновления профиля пользователя.');

    return mapRowToUser(profileData);
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось создать пользователя.');
  }
}

export async function createProfile(userData: {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'installer';
  pin?: string;
}): Promise<User> {
  if (userData.id) {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userData.id,
            full_name: userData.name,
            email: userData.email,
            role: userData.role,
            pin_code: userData.pin ?? '0000',
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      await handleApiError(profileError, 'Ошибка создания профиля пользователя.');
      return mapRowToUser(profileData);
    } catch (err: any) {
      throw new Error(err.message || 'Не удалось создать профиль пользователя.');
    }
  }

  return createUser(userData);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error?.code === 'PGRST116') return null;
    await handleApiError(error, 'Ошибка получения профиля');
    return data ? mapRowToProfile(data) : null;
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось получить профиль.');
  }
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  return getProfile(userId);
}

export async function updateProfile(
  userId: string,
  updates: { name?: string; pin?: string }
): Promise<Profile> {
  try {
    const payload: { full_name?: string; pin_code?: string } = {};
    if (updates.name) payload.full_name = updates.name;
    if (updates.pin) payload.pin_code = updates.pin;

    if (Object.keys(payload).length === 0) {
      throw new Error('Нет данных для обновления.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();
    await handleApiError(error, 'Ошибка обновления профиля');
    return mapRowToProfile(data);
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось обновить профиль.');
  }
}

export async function updateProfilePin(userId: string, pin: string): Promise<Profile> {
  return updateProfile(userId, { pin });
}
