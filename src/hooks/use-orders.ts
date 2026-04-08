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
        allOrders = allOrders.filter(o => o.installerId === userId);
      }
      
      setOrders(allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setIsLoading(false);
    };

    loadOrders();
    // Listen for changes in other components
    window.addEventListener('storage', loadOrders);
    return () => window.removeEventListener('storage', loadOrders);
  }, [userId, role]);

  const saveOrders = (newOrders: Order[]) => {
    localStorage.setItem('local_orders', JSON.stringify(newOrders));
    setOrders(newOrders);
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
      installerId: orderData.installerId || '',
      status: orderData.status || 'В работе',
      createdAt: now,
      updatedAt: now,
    };
    
    saveOrders([newOrder, ...allOrders]);

    if (newOrder.installerId) {
      const notifStored = localStorage.getItem('local_notifications');
      const allNotifs = notifStored ? JSON.parse(notifStored) : [];
      const newNotif = {
        id: Math.random().toString(36).substr(2, 9),
        userId: newOrder.installerId,
        title: 'Новый заказ',
        message: `Вам назначен объект: ${newOrder.objectName}`,
        createdAt: now,
        read: false
      };
      localStorage.setItem('local_notifications', JSON.stringify([newNotif, ...allNotifs]));
      window.dispatchEvent(new Event('storage'));
    }

    toast({ title: "Заказ создан", description: `Объект "${newOrder.objectName}" успешно добавлен.` });
  };

  const updateOrder = (orderId: string, updates: Partial<Order>) => {
    const stored = localStorage.getItem('local_orders');
    const allOrders: Order[] = stored ? JSON.parse(stored) : [];
    
    const now = new Date().toISOString();
    const updatedOrders = allOrders.map(o => 
      o.id === orderId ? { ...o, ...updates, updatedAt: now } : o
    );
    
    saveOrders(updatedOrders);
    toast({ title: "Заказ обновлен" });
  };

  const deleteOrder = (id: string) => {
    const stored = localStorage.getItem('local_orders');
    const allOrders: Order[] = stored ? JSON.parse(stored) : [];
    saveOrders(allOrders.filter(o => o.id !== id));
    toast({ title: "Заказ удален", variant: "destructive" });
  };

  return { orders, isLoading, addOrder, updateOrder, deleteOrder };
}
