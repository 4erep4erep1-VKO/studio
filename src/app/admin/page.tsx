'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import OrderForm from '@/components/orders/OrderForm';

interface Order {
  id: string;
  title: string;
  deadline: string | null;
  status: string;
  is_general: boolean;
  profiles?: { full_name: string } | null;
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, profiles:assigned_to(full_name)')
      .order('created_at', { ascending: false });
    if (data) setOrders(data as any);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleEdit = (id: string) => {
    setEditingOrderId(id);
    setIsFormOpen(true);
  };

  const handleSave = () => {
    setIsFormOpen(false);
    fetchOrders();
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen text-black">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between mb-6">
          <h1 className="text-2xl font-bold">Заказы</h1>
          <button onClick={() => { setEditingOrderId(null); setIsFormOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded">+ Добавить</button>
        </div>

        {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg relative w-full max-w-lg">
              <button onClick={() => setIsFormOpen(false)} className="absolute top-2 right-4 text-2xl">×</button>
              {/* ВОТ ТА САМАЯ 88-Я СТРОЧКА */}
              <OrderForm orderId={editingOrderId} onSave={handleSave} />
            </div>
          </div>
        )}

        <div className="bg-white rounded shadow">
          {orders.map(order => (
            <div key={order.id} className="p-4 border-b flex justify-between items-center">
              <div>
                <div className="font-bold">{order.title}</div>
                <div className="text-sm text-gray-500">{order.is_general ? 'Общий' : (order.profiles?.full_name || 'Не назначен')}</div>
              </div>
              <button onClick={() => handleEdit(order.id)} className="text-blue-600 font-bold">Редактировать</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}