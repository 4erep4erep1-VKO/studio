export type OrderStatus = 'В работе' | 'Завершен' | 'Отклонен';
export type UserRole = 'admin' | 'installer' | null;
export type Theme = 'light' | 'dark' | 'system';

export interface Order {
  id: string;
  objectName: string;
  workDescription: string; // Updated to match backend.json
  imageUrls?: string[]; // Updated to match backend.json
  dueDate: string;
  installerId: string; // Using ID for Firebase relations
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Installer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface AccessLog {
  id: string;
  timestamp: string;
  accessedByRole: string;
  userName?: string;
}

export interface UserPreferences {
  theme: Theme;
  notificationsEnabled: boolean;
}

export const DEFAULT_INSTALLERS = [
  'Иван Петров',
  'Сергей Соколов',
  'Алексей Морозов',
  'Дмитрий Волков',
  'Андрей Кузнецов'
];
