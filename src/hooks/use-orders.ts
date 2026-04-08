'use client';

import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, where, doc, orderBy, Query } from 'firebase/firestore';
import { Order } from '@/lib/types';
import { useToast } from './use-toast';

export function useOrders(userId?: string, role?: string) {
  const db = useFirestore();
  const { user: firebaseUser } = useUser();
  const { toast } = useToast();

  const ordersQuery = useMemoFirebase(() => {
    // Ждем полной инициализации авторизации и ролей
    if (!db || !firebaseUser || !role || !userId) return null;
    
    const baseQuery = collection(db, 'orders');
    
    if (role === 'installer') {
      return query(baseQuery, where('installerId', '==', userId));
    }
    
    if (role === 'admin') {
      return query(baseQuery, orderBy('createdAt', 'desc'));
    }
    
    return null;
  }, [db, userId, role, firebaseUser]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery as Query);

  const addOrder = (orderData: Partial<Order>) => {
    if (!db) return;
    const colRef = collection(db, 'orders');
    const now = new Date().toISOString();
    const newOrder = {
      ...orderData,
      createdAt: now,
      updatedAt: now,
      status: orderData.status || 'В работе',
    };
    
    addDocumentNonBlocking(colRef, newOrder);

    if (orderData.installerId) {
      const notifyRef = collection(db, 'notifications');
      addDocumentNonBlocking(notifyRef, {
        userId: orderData.installerId,
        title: 'Новый заказ',
        message: `Вам назначен объект: ${orderData.objectName}`,
        createdAt: now,
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
    const now = new Date().toISOString();
    updateDocumentNonBlocking(docRef, {
      ...updates,
      updatedAt: now,
    });

    if (updates.installerId) {
      const notifyRef = collection(db, 'notifications');
      addDocumentNonBlocking(notifyRef, {
        userId: updates.installerId,
        title: 'Обновление заказа',
        message: `Вы назначены на объект: ${updates.objectName || 'Заказ обновлен'}`,
        createdAt: now,
        read: false
      });
    }

    toast({
      title: "Заказ обновлен",
    });
  };

  const deleteOrder = (id: string) => {
    if (!db) return;
    const docRef = doc(db, id);
    deleteDocumentNonBlocking(docRef);
    toast({
      title: "Заказ удален",
      variant: "destructive",
    });
  };

  return { orders: orders || [], isLoading, addOrder, updateOrder, deleteOrder };
}