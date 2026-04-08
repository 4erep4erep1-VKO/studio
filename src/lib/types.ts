export type OrderStatus = 'В работе' | 'Завершен' | 'Отклонен';
export type UserRole = 'admin' | 'installer' | null;
export type Theme = 'light' | 'dark' | 'system';

export interface Order {
  id: string;
  objectName: string;
  workDescription: string;
  imageUrls?: string[];
  dueDate: string;
  installerId: string;
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

export interface AppSettings {
  adminPin: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}