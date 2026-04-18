'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/lib/types';
import { useToast } from './use-toast';
import { supabase } from '@/lib/supabase';
import {
  getOrders as fetchOrdersApi,
  createOrder as createOrderApi,
  updateOrder as updateOrderApi,
  deleteOrder as deleteOrderApi,
} from '@/lib/api';

// Простое и надежное хранилище для тостов, чтобы избежать дубликатов
const recentToasts = new Set<string>();
const TOAST_TIMEOUT = 5000; // 5 секунд

export function useOrders(userId?: string, role?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const showUniqueToast = useCallback((options: any) => {
    const toastKey = JSON.stringify(options);
    if (!recentToasts.has(toastKey)) {
      toast(options);
      recentToasts.add(toastKey);
      setTimeout(() => recentToasts.delete(toastKey), TOAST_TIMEOUT);
    }
  }, [toast]);

  const refetchOrders = useCallback(async (showLoadingSpinner = false) => {
    if (!navigator.onLine) {
      setError('Нет подключения к интернету.');
      return;
    }
    if (showLoadingSpinner) setIsLoading(true);
    
    try {
      setError(null);
      const allOrders = await fetchOrdersApi();
      const visibleOrders = role === 'installer' && userId
        ? allOrders.filter(o => o.installerId === userId || o.installerId === 'general')
        : allOrders;
      setOrders(visibleOrders);
    } catch (err: any) {
      const errorMsg = err.message || 'Не удалось загрузить заказы.';
      setError(errorMsg);
      showUniqueToast({ title: 'Ошибка загрузки', description: errorMsg, variant: 'destructive' });
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  }, [role, userId, showUniqueToast]);

  // Эффект для первоначальной загрузки и real-time подписки
  useEffect(() => {
    refetchOrders(true);

    const channel = supabase
      .channel('orders-realtime-update')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, 
        () => refetchOrders(false) // Тихая фоновая перезагрузка
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchOrders]);

  // Эффект для отслеживания состояния сети
  useEffect(() => {
    const handleOnline = () => {
        showUniqueToast({ title: 'Соединение восстановлено', description: 'Обновляем данные...' });
        refetchOrders(true);
    };
    const handleOffline = () => {
        showUniqueToast({ title: 'Нет подключения к интернету', description: 'Изменения не будут сохранены.', variant: 'destructive' });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refetchOrders, showUniqueToast]);
  
  const makeApiCall = async <T extends any[]>(apiFunc: (...args: T) => Promise<any>, ...args: T) => {
    if (!navigator.onLine) {
        const error = new Error('Нет подключения к интернету. Попробуйте позже.');
        toast({ title: 'Ошибка сети', description: error.message, variant: 'destructive' });
        throw error;
    }
    try {
        return await apiFunc(...args);
    } catch (error: any) {
        toast({ title: 'Ошибка сервера', description: error.message, variant: 'destructive' });
        throw error;
    }
  };

  const addOrder = async (orderData: Partial<Order>) => {
    await makeApiCall(createOrderApi, orderData);
    toast({ title: 'Успешно', description: 'Заказ создан' });
  };

  const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    await makeApiCall(updateOrderApi, orderId, updates);
    toast({ title: 'Успешно', description: 'Заказ обновлен' });
  };

  const deleteOrder = async (id: string) => {
    await makeApiCall(deleteOrderApi, id);
    toast({ title: 'Успешно', description: 'Заказ удален' });
  };

  return { orders, isLoading, error, addOrder, updateOrder, deleteOrder, refetchOrders };
}
