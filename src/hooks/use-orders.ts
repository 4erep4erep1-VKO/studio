import { useState, useEffect } from 'react';
import { Order } from '@/lib/types';
import { useToast } from './use-toast';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('creative_dispatch_orders');
    if (stored) {
      try {
        setOrders(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse orders from localStorage', e);
      }
    }
  }, []);

  const saveOrders = (newOrders: Order[]) => {
    setOrders(newOrders);
    localStorage.setItem('creative_dispatch_orders', JSON.stringify(newOrders));
  };

  const addOrder = (order: Order) => {
    saveOrders([order, ...orders]);
    toast({
      title: "Заказ создан",
      description: `Объект "${order.objectName}" успешно добавлен.`,
    });
  };

  const updateOrder = (updatedOrder: Order) => {
    saveOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    toast({
      title: "Заказ обновлен",
      description: `Данные объекта "${updatedOrder.objectName}" успешно изменены.`,
    });
  };

  const deleteOrder = (id: string) => {
    saveOrders(orders.filter(o => o.id !== id));
    toast({
      title: "Заказ удален",
      variant: "destructive",
    });
  };

  return { orders, addOrder, updateOrder, deleteOrder };
}
