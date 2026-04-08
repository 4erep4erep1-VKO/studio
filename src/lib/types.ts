export type OrderStatus = 'В работе' | 'Завершен';
export type UserRole = 'admin' | 'installer' | null;

export interface Order {
  id: string;
  objectName: string;
  description: string;
  photoDataUri?: string;
  dueDate: string;
  installer: string;
  status: OrderStatus;
  createdAt: string;
  aiEstimation?: {
    complexities: string[];
    requiredTools: string[];
    estimatedDuration: string;
  };
}

export interface AppSettings {
  adminPin: string;
}

export const DEFAULT_INSTALLERS = [
  'Иван Петров',
  'Сергей Соколов',
  'Алексей Морозов',
  'Дмитрий Волков',
  'Андрей Кузнецов'
];
