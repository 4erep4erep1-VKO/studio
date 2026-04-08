export type OrderStatus = 'В работе' | 'Завершен';

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

export const INSTALLERS = [
  'Иван Петров',
  'Сергей Соколов',
  'Алексей Морозов',
  'Дмитрий Волков',
  'Андрей Кузнецов'
];
