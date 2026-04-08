
'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/lib/types';
import { useToast } from './use-toast';

export function useOrders(userId?: string, role?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadOrders = () => {
      const stored = localStorage.getItem('local_orders');
      let allOrders: Order[] = stored ? JSON.parse(stored) : [];
      
      if (role === 'installer' && userId) {
        // Монтажник видит свои заказы И общие заказы
        allOrders = allOrders.filter(o => o.installerId === userId || o.installerId === 'general');
      }
      
      setOrders(allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setIsLoading(false);
    };

    loadOrders();
    window.addEventListener('storage', loadOrders);
    return () => window.removeEventListener('storage', loadOrders);
  }, [userId, role]);

  const saveOrders = (newOrders: Order[]) => {
    localStorage.setItem('local_orders', JSON.stringify(newOrders));
    setOrders(newOrders);
    window.dispatchEvent(new Event('storage'));
  };

  const sendNotification = (toUserId: string, title: string, message: string) => {
    const now = new Date().toISOString();
    const notifStored = localStorage.getItem('local_notifications');
    const allNotifs = notifStored ? JSON.parse(notifStored) : [];
    const newNotif = {
      id: Math.random().toString(36).substr(2, 9),
      userId: toUserId,
      title,
      message,
      createdAt: now,
      read: false
    };
    localStorage.setItem('local_notifications', JSON.stringify([newNotif, ...allNotifs]));
    window.dispatchEvent(new Event('storage'));
  };

  const addOrder = (orderData: Partial<Order>) => {
    const stored = localStorage.getItem('local_orders');
    const allOrders: Order[] = stored ? JSON.parse(stored) : [];
    
    const now = new Date().toISOString();
    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      objectName: orderData.objectName || '',
      workDescription: orderData.workDescription || '',
      imageUrls: orderData.imageUrls || [],
      dueDate: orderData.dueDate || now,
      installerId: orderData.installerId || 'general',
      status: orderData.status || 'В работе',
      createdAt: now,
      updatedAt: now,
    };
    
    saveOrders([newOrder, ...allOrders]);

    // Уведомление исполнителю
    if (newOrder.installerId && newOrder.installerId !== 'general') {
      sendNotification(newOrder.installerId, 'Новый заказ', `Вам назначен объект: ${newOrder.objectName}`);
    } else if (newOrder.installerId === 'general') {
      // Можно было бы уведомить всех монтажников, но для простоты опустим или уведомим "общего"
      // sendNotification('all', 'Общий заказ', `Доступен новый объект: ${newOrder.objectName}`);
    }

    toast({ title: "Заказ создан", description: `Объект "${newOrder.objectName}" успешно добавлен.` });
  };

  const updateOrder = (orderId: string, updates: Partial<Order>, currentUserName?: string) => {
    const stored = localStorage.getItem('local_orders');
    const allOrders: Order[] = stored ? JSON.parse(stored) : [];
    
    const now = new Date().toISOString();
    const orderToUpdate = allOrders.find(o => o.id === orderId);
    
    if (!orderToUpdate) return;

    // Логика взятия общего заказа монтажником
    const isClaimingGeneral = orderToUpdate.installerId === 'general' && updates.installerId && updates.installerId !== 'general';

    const updatedOrders = allOrders.map(o => 
      o.id === orderId ? { ...o, ...updates, updatedAt: now } : o
    );
    
    saveOrders(updatedOrders);

    // Уведомление админу при различных действиях монтажника
    if (role === 'installer') {
      if (isClaimingGeneral) {
        sendNotification('admin-id', 'Заказ принят', `Монтажник ${currentUserName || 'Кто-то'} взял общий заказ: ${orderToUpdate.objectName}`);
        toast({ title: "Заказ принят", description: "Теперь этот объект закреплен за вами." });
      } else if (updates.status === 'Отклонен' || updates.status === 'Завершен') {
        const statusText = updates.status === 'Отклонен' ? 'отклонил' : 'завершил';
        sendNotification('admin-id', updates.status === 'Отклонен' ? 'Заказ отклонен' : 'Заказ выполнен', 
          `Монтажник ${currentUserName || ''} ${statusText} объект: ${orderToUpdate.objectName}`);
        toast({ title: updates.status === 'Завершен' ? "Заказ выполнен" : "Заказ отклонен" });
      }
    } 
    
    // Уведомление монтажнику при действиях админа
    if (role === 'admin' && updates.status) {
       if (orderToUpdate.installerId !== 'general') {
         sendNotification(orderToUpdate.installerId, 'Статус заказа изменен', `Администратор изменил статус объекта "${orderToUpdate.objectName}" на "${updates.status}"`);
       }
       toast({ title: "Заказ обновлен" });
    }
  };

  const deleteOrder = (id: string) => {
    const stored = localStorage.getItem('local_orders');
    const allOrders: Order[] = stored ? JSON.parse(stored) : [];
    saveOrders(allOrders.filter(o => o.id !== id));
    toast({ title: "Заказ удален", variant: "destructive" });
  };

  return { orders, isLoading, addOrder, updateOrder, deleteOrder };
}
