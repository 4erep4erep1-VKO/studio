'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/lib/types';
import { useToast } from './use-toast';
import {
  getOrders as fetchOrdersApi,
  createOrder as createOrderApi,
  updateOrder as updateOrderApi,
  deleteOrder as deleteOrderApi,
} from '@/lib/api';

const OFFLINE_ERROR = 'Нет интернет-соединения. Проверьте подключение и попробуйте снова.';

/**
 * Хук для управления заказами.
 * Упрощенная версия: без Realtime-подписок, только явные запросы.
 */
export function useOrders(userId?: string, role?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAndSetOrders = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setError(null);

    if (typeof window !== 'undefined' && !navigator.onLine) {
        setError(OFFLINE_ERROR);
        if (showLoading) setIsLoading(false);
        return;
    }

    try {
      const allOrders = await fetchOrdersApi();
      const visibleOrders = role === 'installer' && userId
        ? allOrders.filter(o => o.installerId === userId || o.installerId === 'general')
        : allOrders;

      setOrders(visibleOrders);
    } catch (err: any) {
      const errorMsg = err.message || 'Не удалось загрузить заказы.';
      setError(errorMsg);
      if (showLoading) {
        toast({
          title: 'Ошибка загрузки',
          description: errorMsg,
          variant: 'destructive'
        });
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [role, userId, toast]);

  useEffect(() => {
    fetchAndSetOrders(true);

    const handleOnline = () => {
        toast({ title: 'Соединение восстановлено', description: 'Данные автоматически обновляются.' });
        fetchAndSetOrders(true);
    };
    const handleOffline = () => {
        setError(OFFLINE_ERROR);
        toast({ title: 'Нет интернет-соединения', description: 'Вы перешли в оффлайн-режим.', variant: 'destructive' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, [fetchAndSetOrders, toast]);

  const addOrder = async (orderData: Partial<Order>) => {
    if (typeof window !== 'undefined' && !navigator.onLine) throw new Error(OFFLINE_ERROR);
    try {
      await createOrderApi(orderData);
      toast({ title: 'Успешно', description: 'Заказ создан' });
      await fetchAndSetOrders(false);
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    if (typeof window !== 'undefined' && !navigator.onLine) throw new Error(OFFLINE_ERROR);
    try {
      await updateOrderApi(orderId, updates);
      toast({ title: 'Успешно', description: 'Заказ обновлен' });
      await fetchAndSetOrders(false);
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  const deleteOrder = async (id: string) => {
    if (typeof window !== 'undefined' && !navigator.onLine) throw new Error(OFFLINE_ERROR);
    try {
      await deleteOrderApi(id);
      toast({ title: 'Успешно', description: 'Заказ удален', variant: 'destructive' });
      await fetchAndSetOrders(false);
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  return {
    orders,
    isLoading,
    error,
    addOrder,
    updateOrder,
    deleteOrder,
    refetchOrders: fetchAndSetOrders
  };
}
