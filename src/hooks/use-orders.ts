
'use client';

import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { Order } from '@/lib/types';
import { useToast } from './use-toast';

export function useOrders(userId?: string, role?: string) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const ordersQuery = useMemoFirebase(() => {
    // Ждем, пока сессия и роль будут полностью инициализированы
    if (!db || !user || !role) return null;
    
    const baseQuery = collection(db, 'orders');
    
    if (role === 'installer') {
      if (!userId) return null;
      // Для монтажников обязательно добавляем фильтр, чтобы правила разрешили чтение
      return query(baseQuery, where('installerId', '==', userId));
    }
    
    if (role === 'admin') {
      return query(baseQuery, orderBy('createdAt', 'desc'));
    }
    
    return null;
  }, [db, userId, role, user]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const addOrder = (orderData: Partial<Order>) => {
    if (!db) return;
    const colRef = collection(db, 'orders');
    const newOrder = {
      ...orderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: orderData.status || 'В работе',
    };
    
    addDocumentNonBlocking(colRef, newOrder);

    if (orderData.installerId) {
      const notifyRef = collection(db, 'notifications');
      addDocumentNonBlocking(notifyRef, {
        userId: orderData.installerId,
        title: 'Новый заказ',
        message: `Вам назначен объект: ${orderData.objectName}`,
        createdAt: new Date().toISOString(),
        read: false
      });
    }

    toast({
      title: "Заказ создан",
      description: `Объект "${orderData.objectName}" успешно добавлен.`,
    });
  };

  const updateOrder = (orderId: string, updates: Partial<Order>) => {
    if (!db) return;
    const docRef = doc(db, 'orders', orderId);
    updateDocumentNonBlocking(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    if (updates.installerId) {
      const notifyRef = collection(db, 'notifications');
      addDocumentNonBlocking(notifyRef, {
        userId: updates.installerId,
        title: 'Обновление заказа',
        message: `Вы назначены на объект: ${updates.objectName || 'Заказ обновлен'}`,
        createdAt: new Date().toISOString(),
        read: false
      });
    }

    toast({
      title: "Заказ обновлен",
    });
  };

  const deleteOrder = (id: string) => {
    if (!db) return;
    const docRef = doc(db, 'orders', id);
    deleteDocumentNonBlocking(docRef);
    toast({
      title: "Заказ удален",
      variant: "destructive",
    });
  };

  return { orders: orders || [], isLoading, addOrder, updateOrder, deleteOrder };
}
