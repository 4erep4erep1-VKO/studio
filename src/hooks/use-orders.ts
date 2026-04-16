'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/lib/types';
import { useToast } from './use-toast';
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

  const fetchAndSetOrders = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);
      const allOrders = await fetchOrders();
      const visibleOrders = role === 'installer' && userId
        ? allOrders.filter(o => o.installerId === userId || o.installerId === 'general')
        : allOrders;

      setOrders(visibleOrders);
    } catch (error: any) {
      const errorMsg = error.message || 'Не удалось загрузить заказы.';
      setError(errorMsg);
      if (showLoading) {
        toast({ title: 'Ошибка загрузки', description: errorMsg, variant: 'destructive' });
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [role, userId, toast]);

  // При первом входе загружаем заказы, потом слушаем базу в фоне
  useEffect(() => {
    fetchAndSetOrders(true);

    const channel = supabase
      .channel('orders-silent-update')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        // База изменилась? Просто тихо обновляем список в фоне без блокировки кнопок
        fetchAndSetOrders(false);
      })
      .subscribe();

    const handleOnline = () => fetchAndSetOrders(false);
    window.addEventListener('online', handleOnline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchAndSetOrders]);

  const addOrder = async (orderData: Partial<Order>) => {
    try {
      setIsLoading(true);
      await createOrderApi(orderData);
      toast({ title: 'Успешно', description: 'Заказ создан' });
      await fetchAndSetOrders(false);
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
      await updateOrderApi(orderId, updates);
      toast({ title: 'Успешно', description: 'Заказ обновлен' });
      await fetchAndSetOrders(false);
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      await deleteOrderApi(id);
      toast({ title: 'Успешно', description: 'Заказ удален', variant: 'destructive' });
      await fetchAndSetOrders(false);
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  return { orders, isLoading, error, addOrder, updateOrder, deleteOrder };
}