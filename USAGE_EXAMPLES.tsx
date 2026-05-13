// ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ OrderListManager

// ============================================
// ПРИМЕР 1: На странице со своим состоянием
// ============================================

'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import OrderListManager from '@/components/orders/OrderListManager';

export default function CustomOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      setOrders(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (orderId: string) => {
    console.log('Edit order:', orderId);
    // Откройте модаль редактирования
  };

  const handleDelete = (id: string, creatorId: string, title: string, status: string) => {
    console.log('Delete order:', id);
    // Удалите заказ
  };

  const handleComplete = (id: string, title: string) => {
    console.log('Complete order:', id);
    // Завершите заказ
  };

  const handleAssign = (orderId: string) => {
    console.log('Assign order:', orderId);
    // Назначьте исполнителя
  };

  const handleTransfer = (orderId: string) => {
    console.log('Transfer to installation:', orderId);
    // Передайте на монтаж
  };

  const handleView = (order: any) => {
    console.log('View order:', order);
    // Покажите полную информацию
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="p-6 bg-background min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Управление заказами</h1>
      
      <OrderListManager
        orders={orders}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onComplete={handleComplete}
        onAssignOrder={handleAssign}
        onTransferToInstallation={handleTransfer}
        onView={handleView}
        isAdmin={true}
      />
    </div>
  );
}

// ============================================
// ПРИМЕР 2: С фильтрацией по статусу
// ============================================

'use client';

import React, { useState } from 'react';
import OrderListManager from '@/components/orders/OrderListManager';

export default function ActiveOrdersPage({ allOrders }: { allOrders: any[] }) {
  const [status, setStatus] = useState('all');

  // Фильтруем заказы перед передачей в компонент
  const filteredOrders = status === 'all'
    ? allOrders
    : allOrders.filter(o => o.status === status);

  return (
    <div className="p-6">
      <div className="mb-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">Все</option>
          <option value="new">Новые</option>
          <option value="in_progress">В работе</option>
          <option value="completed">Завершено</option>
        </select>
      </div>

      <OrderListManager
        orders={filteredOrders}
        onEdit={() => {}}
        onDelete={() => {}}
        onComplete={() => {}}
        onAssignOrder={() => {}}
        onTransferToInstallation={() => {}}
        onView={() => {}}
      />
    </div>
  );
}

// ============================================
// ПРИМЕР 3: Интеграция в модальном окне
// ============================================

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import OrderListManager from '@/components/orders/OrderListManager';

export default function SelectOrderModal({
  orders,
  onSelectOrder,
  open,
  onOpenChange,
}: {
  orders: any[];
  onSelectOrder: (order: any) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <h2 className="text-2xl font-bold mb-4">Выберите заказ</h2>
        
        <OrderListManager
          orders={orders}
          onEdit={() => {}}
          onDelete={() => {}}
          onComplete={() => {}}
          onAssignOrder={() => {}}
          onTransferToInstallation={() => {}}
          onView={(order) => {
            onSelectOrder(order);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// ПРИМЕР 4: С автозагрузкой и подписками
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import OrderListManager from '@/components/orders/OrderListManager';

export default function RealtimeOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    // Первая загрузка
    loadOrders();

    // Подписка на изменения в реальном времени
    const channel = supabase
      .channel('orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          loadOrders(); // Перезагружаем при любых изменениях
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadOrders = async () => {
    const { data } = await supabase.from('orders').select('*');
    if (data) setOrders(data);
  };

  return (
    <div className="p-6">
      <OrderListManager
        orders={orders}
        onEdit={(id) => console.log('Edit:', id)}
        onDelete={(id) => console.log('Delete:', id)}
        onComplete={(id) => console.log('Complete:', id)}
        onAssignOrder={(id) => console.log('Assign:', id)}
        onTransferToInstallation={(id) => console.log('Transfer:', id)}
        onView={(order) => console.log('View:', order)}
        isAdmin={true}
      />
    </div>
  );
}

// ============================================
// ПРИМЕР 5: С импортом данных и экспортом
// ============================================

'use client';

import { useState } from 'react';
import OrderListManager from '@/components/orders/OrderListManager';
import * as XLSX from 'xlsx';

export default function OrdersWithExport({ initialOrders }: { initialOrders: any[] }) {
  const [orders, setOrders] = useState(initialOrders);

  const handleExport = () => {
    // Подготовка данных для экспорта
    const dataToExport = orders.map((o) => ({
      'ID': o.id,
      'Название': o.title,
      'Статус': o.status,
      'Дедлайн': o.deadline ? new Date(o.deadline).toLocaleDateString() : '-',
      'Исполнитель': o.profiles?.full_name || 'Не назначен',
      'Дата создания': new Date(o.created_at).toLocaleDateString(),
    }));

    // Создание Excel файла
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Заказы');
    XLSX.writeFile(workbook, 'orders.xlsx');
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Заказы</h1>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-emerald-600 text-white rounded font-bold"
        >
          📥 Экспортировать
        </button>
      </div>

      <OrderListManager
        orders={orders}
        onEdit={() => {}}
        onDelete={() => {}}
        onComplete={() => {}}
        onAssignOrder={() => {}}
        onTransferToInstallation={() => {}}
        onView={() => {}}
      />
    </div>
  );
}

// ============================================
// ПРИМЕР 6: С кастомными обработчиками
// ============================================

'use client';

import { useState } from 'react';
import OrderListManager from '@/components/orders/OrderListManager';
import { useToast } from '@/hooks/use-toast';

export default function OrdersWithHandlers({ orders }: { orders: any[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = (orderId: string) => {
    setEditingId(orderId);
    toast({ title: `Открыто редактирование заказа ${orderId}` });
  };

  const handleDelete = async (id: string, creatorId: string, title: string) => {
    if (confirm(`Удалить "${title}"?`)) {
      try {
        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (!error) {
          toast({ title: 'Заказ удален' });
        }
      } catch (err) {
        toast({ title: 'Ошибка при удалении' });
      }
    }
  };

  const handleComplete = async (id: string, title: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', id);
      
      if (!error) {
        toast({ title: `"${title}" завершен!` });
      }
    } catch (err) {
      toast({ title: 'Ошибка' });
    }
  };

  return (
    <div className="p-6">
      <OrderListManager
        orders={orders}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onComplete={handleComplete}
        onAssignOrder={(id) => toast({ title: `Назначение ${id}` })}
        onTransferToInstallation={(id) => toast({ title: `Передача ${id}` })}
        onView={(order) => console.log('View:', order)}
        isAdmin={true}
      />
    </div>
  );
}
