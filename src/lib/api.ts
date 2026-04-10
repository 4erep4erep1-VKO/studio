import { createClient } from '@supabase/supabase-js'
import type { Order as AppOrder, Comment, Profile } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Order = AppOrder

type SupabaseOrderRow = {
  id: string
  title: string
  description: string
  status: string
  image_urls: string[]
  assigned_to: string
  created_at: string
}

const mapRowToOrder = (row: SupabaseOrderRow): AppOrder => ({
  id: row.id,
  objectName: row.title,
  workDescription: row.description,
  status: row.status as AppOrder['status'],
  imageUrls: row.image_urls || [],
  installerId: row.assigned_to || 'general',
  createdAt: row.created_at,
  updatedAt: row.created_at,
  dueDate: row.created_at,
})

const mapOrderToRow = (order: Partial<AppOrder>) => ({
  title: order.objectName || '',
  description: order.workDescription || '',
  status: order.status || 'В работе',
  image_urls: order.imageUrls || [],
  assigned_to: order.installerId || 'general',
})

export async function getOrders(): Promise<AppOrder[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message || 'Ошибка загрузки заказов')
    }

    return ((data as SupabaseOrderRow[]) ?? []).map(mapRowToOrder)
  } catch (err: any) {
    throw new Error(
      err.message || 'Не удалось загрузить заказы. Проверьте интернет-соединение.'
    )
  }
}

export async function createOrder(order: Partial<AppOrder>): Promise<AppOrder> {
  try {
    const row = {
      ...mapOrderToRow(order),
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('orders')
      .insert(row)
      .select()
      .single()

    if (error) {
      throw new Error(error.message || 'Ошибка создания заказа')
    }

    return mapRowToOrder(data as SupabaseOrderRow)
  } catch (err: any) {
    throw new Error(
      err.message || 'Не удалось создать заказ. Проверьте данные и повторите попытку.'
    )
  }
}

export async function getProfiles(): Promise<Profile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('Profiles table unavailable or error:', error.message)
      return []
    }

    return (data as Profile[]) || []
  } catch (err: any) {
    console.warn('Ошибка получения профилей:', err.message)
    return []
  }
}

export async function createProfile(profile: Omit<Profile, 'id'>): Promise<Profile> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert({ ...profile, created_at: new Date().toISOString() })
      .select()
      .single()

    if (error) {
      throw new Error(error.message || 'Ошибка создания профиля')
    }

    return data as Profile
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось создать профиль. Проверьте данные и повторите попытку.')
  }
}

export async function updateProfilePin(id: string, pin: string): Promise<Profile> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ pin })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message || 'Ошибка обновления PIN-кода')
    }

    return data as Profile
  } catch (err: any) {
    throw new Error(err.message || 'Не удалось обновить PIN-код. Попробуйте еще раз.')
  }
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      if (error.details?.includes('Не найдено')) return null
      throw error
    }

    return data as Profile
  } catch (err: any) {
    console.warn('Ошибка поиска профиля по email:', err.message)
    return null
  }
}

export async function getProfileById(id: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.details?.includes('Не найдено')) return null
      throw error
    }

    return data as Profile
  } catch (err: any) {
    console.warn('Ошибка поиска профиля по id:', err.message)
    return null
  }
}

export async function updateOrderStatus(
  id: string,
  status: string,
  assigned_to: string
): Promise<AppOrder> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, assigned_to })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message || 'Ошибка обновления статуса')
    }

    return mapRowToOrder(data as SupabaseOrderRow)
  } catch (err: any) {
    throw new Error(
      err.message || 'Не удалось обновить статус заказа. Проверьте интернет-соединение.'
    )
  }
}

export async function updateOrder(
  id: string,
  updates: Partial<AppOrder>
): Promise<AppOrder> {
  try {
    const payload: Partial<SupabaseOrderRow> = {}

    if (updates.objectName !== undefined) payload.title = updates.objectName
    if (updates.workDescription !== undefined) payload.description = updates.workDescription
    if (updates.status !== undefined) payload.status = updates.status
    if (updates.imageUrls !== undefined) payload.image_urls = updates.imageUrls
    if (updates.installerId !== undefined) payload.assigned_to = updates.installerId

    if (Object.keys(payload).length === 0) {
      throw new Error('Не внесены изменения.')
    }

    const { data, error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message || 'Ошибка обновления заказа')
    }

    return mapRowToOrder(data as SupabaseOrderRow)
  } catch (err: any) {
    throw new Error(
      err.message || 'Не удалось обновить заказ. Проверьте интернет-соединение.'
    )
  }
}

export async function deleteOrder(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('orders').delete().eq('id', id)

    if (error) {
      throw new Error(error.message || 'Ошибка удаления заказа')
    }
  } catch (err: any) {
    throw new Error(
      err.message || 'Не удалось удалить заказ. Проверьте интернет-соединение.'
    )
  }
}

export async function uploadImage(file: File): Promise<string> {
  try {
    if (!file) {
      throw new Error('Файл не найден')
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Размер файла не должен превышать 5MB')
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
    const filePath = `order-photos/${fileName}`

    const { data, error: uploadError } = await supabase.storage
      .from('order-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message || 'Ошибка загрузки изображения')
    }

    const { data: urlData } = supabase.storage
      .from('order-photos')
      .getPublicUrl(filePath)

    if (!urlData?.publicUrl) {
      throw new Error('Не удалось получить URL изображения')
    }

    return urlData.publicUrl
  } catch (err: any) {
    throw new Error(
      err.message || 'Не удалось загрузить изображение. Проверьте формат и размер файла.'
    )
  }
}
// Comments API
export async function getComments(orderId: string): Promise<Comment[]> {
  try {
    const { data, error } = await supabase
      .from('order_comments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(error.message || 'Ошибка загрузки комментариев')
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      userName: row.user_name,
      message: row.content ?? row.message,
      createdAt: row.created_at,
    }))
  } catch (err: any) {
    throw new Error(
      err.message || 'Не удалось загрузить комментарии. Проверьте интернет-соединение.'
    )
  }
}

export async function addComment(orderId: string, content: string): Promise<Comment> {
  try {
    if (!content.trim()) {
      throw new Error('Сообщение не может быть пустым')
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) {
      throw new Error(userError.message || 'Не удалось получить информацию о пользователе')
    }

    const user = userData.user
    if (!user) {
      throw new Error('Пользователь не авторизован')
    }

    const userName =
      (user.user_metadata as any)?.name ||
      (user.user_metadata as any)?.full_name ||
      user.email ||
      'Пользователь'

    const { data: commentData, error } = await supabase
      .from('order_comments')
      .insert({
        order_id: orderId,
        user_id: user.id,
        user_name: userName,
        content: content.trim(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.message || 'Ошибка добавления комментария')
    }

    return {
      id: commentData.id,
      orderId: commentData.order_id,
      userId: commentData.user_id,
      userName: commentData.user_name,
      message: commentData.content ?? commentData.message,
      createdAt: commentData.created_at,
    }
  } catch (err: any) {
    throw new Error(
      err.message || 'Не удалось добавить комментарий. Проверьте интернет-соединение.'
    )
  }
}

export function subscribeToComments(
  orderId: string,
  callback: (comment: Comment) => void
) {
  const channel = supabase
    .channel(`order-comments-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'order_comments',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        const newComment: Comment = {
          id: payload.new.id,
          orderId: payload.new.order_id,
          userId: payload.new.user_id,
          userName: payload.new.user_name,
          message: payload.new.content ?? payload.new.message,
          createdAt: payload.new.created_at,
        }
        callback(newComment)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}