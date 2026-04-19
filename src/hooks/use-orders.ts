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

/**
 * Хук для управления заказами. 
 * Упрощенная версия: без Realtime-подписок, только явные запросы.
 */
export function useOrders(userId?: string, role?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Основная функция загрузки данных
  const fetchAndSetOrders = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const allOrders = await fetchOrdersApi();
      
      // Фильтрация (на случай если монтажник все же зайдет через web)
      const visibleOrders = role === 'installer' && userId
        ? allOrders.filter(o => o.installerId === userId || o.installerId === 'general')
        : allOrders;

      setOrders(visibleOrders);
    } catch (err: any) {
      const errorMsg = err.message || 'Не удалось загрузить заказы.';
      setError(errorMsg);
      // Показываем тост только если это была явная загрузка со спиннером
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

  // Загружаем данные только при монтировании компонента
  useEffect(() => {
    fetchAndSetOrders(true);
  }, [fetchAndSetOrders]);

  // СОЗДАНИЕ: API -> Обновление списка -> Тост
  const addOrder = async (orderData: Partial<Order>) => {
    try {
      await createOrderApi(orderData);
      toast({ title: 'Успешно', description: 'Заказ создан' });
      await fetchAndSetOrders(false); // "Тихое" обновление данных
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
      throw err; 
    }
  };

  // ОБНОВЛЕНИЕ: API -> Обновление списка -> Тост
  const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
      await updateOrderApi(orderId, updates);
      toast({ title: 'Успешно', description: 'Заказ обновлен' });
      await fetchAndSetOrders(false); // "Тихое" обновление данных
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  // УДАЛЕНИЕ: API -> Обновление списка -> Тост
  const deleteOrder = async (id: string) => {
    try {
      await deleteOrderApi(id);
      toast({ title: 'Успешно', description: 'Заказ удален', variant: 'destructive' });
      await fetchAndSetOrders(false); // "Тихое" обновление данных
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
