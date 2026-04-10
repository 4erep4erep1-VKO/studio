
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Order } from '@/lib/types';
import { useToast } from './use-toast';
import { playNotificationSound } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  getOrders as fetchOrders,
  createOrder as createOrderApi,
  updateOrder as updateOrderApi,
  deleteOrder as deleteOrderApi,
} from '@/lib/api';

export function useOrders(userId?: string, role?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const orderEventRef = useRef({ lastCreatedOrderId: '', lastUpdatedOrderId: '' });

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const allOrders = await fetchOrders();
      const visibleOrders = role === 'installer' && userId
        ? allOrders.filter(o => o.installerId === userId || o.installerId === 'general')
        : allOrders;

      setOrders(visibleOrders);
    } catch (error: any) {
      const errorMsg = error.message || 'Не удалось загрузить заказы.';
      const isNetworkError = !navigator.onLine || errorMsg.includes('network');
      
      setError(errorMsg);
      toast({
        title: isNetworkError ? 'Нет интернета' : 'Ошибка загрузки',
        description: isNetworkError 
          ? 'Проверьте соединение. Заказы обновятся автоматически.'
          : errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [role, userId, toast]);

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
        if (payload.new?.id === orderEventRef.current.lastCreatedOrderId) {
          orderEventRef.current.lastCreatedOrderId = ''
          return
        }

        toast({
          title: 'Новый заказ',
          description: `Поступил объект: ${payload.new?.title || 'новый заказ'}`,
        })
        playNotificationSound()
        loadOrders()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
        if (payload.new?.id === orderEventRef.current.lastUpdatedOrderId) {
          orderEventRef.current.lastUpdatedOrderId = ''
          return
        }

        const oldStatus = payload.old?.status
        const newStatus = payload.new?.status
        if (oldStatus && newStatus && oldStatus !== newStatus) {
          toast({
            title: 'Статус заказа изменен',
            description: `Объект ${payload.new?.title || ''} теперь ${newStatus}`,
          })
          playNotificationSound()
        }
        loadOrders()
      })
      .subscribe();

    // Добавляем слушатель для восстановления соединения
    const handleOnline = () => {
      loadOrders();
      toast({ title: 'Соединение восстановлено', description: 'Загружаю обновления...' });
    };

    window.addEventListener('online', handleOnline);

    return () => {
      channel.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, [loadOrders, toast]);

  const addOrder = async (orderData: Partial<Order>) => {
    try {
      const newOrder = await createOrderApi(orderData);
      toast({ title: 'Заказ создан', description: `Объект "${newOrder.objectName}" успешно добавлен.` });
      playNotificationSound()
      orderEventRef.current.lastCreatedOrderId = newOrder.id
      await loadOrders();
    } catch (error: any) {
      const errorMsg = error.message || 'Не удалось создать заказ.';
      const isNetworkError = !navigator.onLine;
      
      toast({
        title: isNetworkError ? 'Нет интернета' : 'Ошибка создания',
        description: isNetworkError 
          ? 'Проверьте соединение и повторите попытку.'
          : errorMsg,
        variant: 'destructive',
      });
    }
  };

  const updateOrder = async (orderId: string, updates: Partial<Order>, currentUserName?: string) => {
    try {
      const orderToUpdate = orders.find(o => o.id === orderId);
      if (!orderToUpdate) return;

      const isClaimingGeneral = orderToUpdate.installerId === 'general' && updates.installerId && updates.installerId !== 'general';
      orderEventRef.current.lastUpdatedOrderId = orderId;
      const updatedOrder = await updateOrderApi(orderId, updates);
      await loadOrders();

      if (role === 'installer') {
        if (isClaimingGeneral) {
          toast({ title: 'Заказ принят', description: 'Теперь этот объект закреплен за вами.' });
          playNotificationSound();
        } else if (updates.status === 'Отклонен' || updates.status === 'Завершен') {
          toast({ title: updates.status === 'Завершен' ? 'Заказ выполнен' : 'Заказ отклонен' });
          playNotificationSound();
        }
      }

      if (role === 'admin' && updates.status) {
        toast({ title: 'Заказ обновлен' });
        playNotificationSound();
      }

      return updatedOrder;
    } catch (error: any) {
      const errorMsg = error.message || 'Не удалось обновить заказ.';
      const isNetworkError = !navigator.onLine;

      toast({
        title: isNetworkError ? 'Нет интернета' : 'Ошибка обновления',
        description: isNetworkError
          ? 'Проверьте соединение и повторите попытку.'
          : errorMsg,
        variant: 'destructive',
      });
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      await deleteOrderApi(id);
      toast({ title: 'Заказ удален', variant: 'destructive' });
      await loadOrders();
    } catch (error: any) {
      const errorMsg = error.message || 'Не удалось удалить заказ.';
      const isNetworkError = !navigator.onLine;
      
      toast({
        title: isNetworkError ? 'Нет интернета' : 'Ошибка удаления',
        description: isNetworkError
          ? 'Проверьте соединение и повторите попытку.'
          : errorMsg,
        variant: 'destructive',
      });
    }
  };

  return { orders, isLoading, error, addOrder, updateOrder, deleteOrder };
}
