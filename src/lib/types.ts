export type OrderStatus =
  | 'new'
  | 'in_progress'
  | 'awaiting_photos'
  | 'completed'
  | 'cancelled';

export type UserRole = 'admin' | 'installer' | null;

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'installer';
  pin?: string;
}

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
  department?: 'installation' | 'print' | 'production';
  assigned_to: string | null; // ID монтажника из таблицы profiles
  deadline?: string | null;
  is_general?: boolean;
  dimensions?: string | null;
  material?: string | null;
  source_link?: string | null;
  preview_url?: string | null;
  image_urls?: string[];
  report_photos?: string[];
  report_photo?: string | null;
  created_by?: string | null;
  creator_name?: string | null;
  profiles?: {
    full_name?: string | null;
    telegram_chat_id?: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export type OrderTemplate = Pick<Order, 'title' | 'description'> & {
  department?: Order['department'];
  dimensions?: string | null;
  material?: string | null;
  source_link?: string | null;
};