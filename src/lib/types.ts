export type OrderStatus = 'new' | 'in_progress' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: 'admin' | 'installer';
  pin_code: string | null;
  telegram_chat_id: string | null;
}

export interface Order {
  id: string;
  title: string;
  description: string;
  status: OrderStatus;
  assigned_to: string; // ID монтажника из таблицы profiles
  created_at: string;
  updated_at: string;
}