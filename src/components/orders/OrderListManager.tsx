'use client';

import React, { useState, useMemo } from 'react';
import { Grid3x3, List, LayoutGrid, ChevronDown, Eye, Pencil, Copy } from 'lucide-react';
import { OrderCard } from './OrderCard';
import { useRouter } from 'next/navigation';
import { OrderTemplate } from '@/lib/types';

interface OrderListManagerProps {
  orders: any[];
  totalOrdersCount?: number;
  onSearch?: (query: string) => void;
  onEdit: (orderId: string) => void;
  onDuplicate?: (order: OrderTemplate) => void;
  onDelete: (id: string, creatorId: string, title: string, status: string) => void;
  onComplete: (id: string, title: string) => void;
  onAssignOrder: (orderId: string) => void;
  onTransferToInstallation: (orderId: string) => void;
  onRestore?: (orderId: string) => void;
  onView: (order: any) => void;
  isAdmin?: boolean;
}

export default function OrderListManager({
  orders,
  totalOrdersCount,
  onSearch,
  onEdit,
  onDuplicate,
  onDelete,
  onComplete,
  onAssignOrder,
  onTransferToInstallation,
  onRestore,
  onView,
  isAdmin = false,
}: OrderListManagerProps) {
  // Добавили 'compact' в типы режима отображения
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'deadline'>('newest');

  const sortedOrders = useMemo(() => {
    const arr = [...orders];
    switch (sortBy) {
      case 'newest':
        return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'name_asc':
        return arr.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
      case 'deadline':
        return arr.sort((a, b) => {
          const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return dateA - dateB;
        });
      default:
        return arr;
    }
  }, [orders, sortBy]);

  return (
    <div className="space-y-4">
      {/* ПАНЕЛЬ УПРАВЛЕНИЯ */}
      <div className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4">
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Поиск по названию или описанию..."
            value={searchQuery}
            onChange={(e) => {
              const query = e.target.value;
              setSearchQuery(query);
              onSearch?.(query);
            }}
            className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-3 text-[#d0d6e0] outline-none transition placeholder:text-[#8a8f98] focus:border-[#C62828]"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="w-full md:w-auto flex items-center gap-2">
            <label className="whitespace-nowrap text-sm font-normal text-[#8a8f98]">Сортировка:</label>
            <div className="relative w-full md:w-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full appearance-none rounded-md border border-[#23252a] bg-[#08090a] py-2 pl-3 pr-9 text-sm font-normal text-[#d0d6e0] outline-none transition focus:border-[#C62828] md:w-max"
              >
                <option value="newest">📌 Сначала новые</option>
                <option value="oldest">📅 Сначала старые</option>
                <option value="name_asc">🔤 По названию (А-Я)</option>
                <option value="deadline">⏰ По дедлайну</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Кнопки переключения вида (Добавлена плитка) */}
          <div className="flex w-full overflow-x-auto rounded-md border border-[#23252a] bg-[#08090a] p-1 md:w-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-normal transition ${viewMode === 'grid' ? 'bg-[#C62828] text-white' : 'text-[#8a8f98] hover:text-white'}`}
              title="Крупная сетка"
            >
              <Grid3x3 className="w-4 h-4" />
              <span className="hidden lg:inline">Плитки</span>
            </button>
            
            <button
              onClick={() => setViewMode('compact')}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-normal transition ${viewMode === 'compact' ? 'bg-[#C62828] text-white' : 'text-[#8a8f98] hover:text-white'}`}
              title="Мелкая сетка"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden lg:inline">Мелкая плитка</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-normal transition ${viewMode === 'list' ? 'bg-[#C62828] text-white' : 'text-[#8a8f98] hover:text-white'}`}
              title="Вид списком"
            >
              <List className="w-4 h-4" />
              <span className="hidden lg:inline">Список</span>
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs font-normal text-[#8a8f98]">
          Найдено заказов: <span className="font-medium text-white">{sortedOrders.length}</span> / {totalOrdersCount ?? orders.length}
        </div>
      </div>

      {/* ОТОБРАЖЕНИЕ ЗАКАЗОВ */}
      <div>
        {sortedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-muted-foreground font-medium">{searchQuery ? 'Заказов не найдено' : 'Нет заказов'}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedOrders.map((order) => (
              <div key={order.id} className="h-full">
                <OrderCard order={order} onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={(id, cid, title) => onDelete(id, cid, title, order.status)} onComplete={onComplete} onAssignOrder={onAssignOrder} onTransferToInstallation={onTransferToInstallation} onRestore={onRestore} isAdmin={isAdmin} />
              </div>
            ))}
          </div>
        ) : viewMode === 'compact' ? (
          /* РЕЖИМ МЕЛКОЙ ПЛИТКИ */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
            {sortedOrders.map((order) => (
              <div 
                key={order.id} 
                className="group relative flex h-32 cursor-pointer flex-col justify-between rounded-xl border border-[#23252a] bg-[#0f1011] p-2 transition hover:border-[#C62828]"
                onClick={() => onView(order)}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="rounded-md border border-[#23252a] bg-[#161718] px-1 text-[8px] font-normal uppercase text-[#8a8f98]">
                      {order.department === 'print' ? 'ПЕЧАТЬ' : order.department === 'production' ? 'ИЗГОТОВЛЕНИЕ' : 'МОНТАЖ'}
                    </span>
                    <span className="text-[10px]">{order.status === 'completed' ? '✅' : order.status === 'in_progress' ? '⏳' : '🆕'}</span>
                  </div>
                  <h4 className="line-clamp-2 text-xs font-medium uppercase leading-tight text-white transition group-hover:text-[#C62828]">
                    {order.title}
                  </h4>
                </div>

                <div className="mt-auto">
                   {order.deadline && (
                      <div className="flex items-center gap-1 text-[9px] font-normal text-[#8a8f98]">
                        📅 {new Date(order.deadline).toLocaleDateString('ru-RU', { month: 'numeric', day: 'numeric' })}
                      </div>
                   )}
                   <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onDuplicate && <button onClick={(e) => { e.stopPropagation(); onDuplicate(order); }} className="rounded-md border border-[#23252a] bg-[#08090a] p-1 text-[#8a8f98] transition hover:bg-[#C62828]/15 hover:text-[#C62828]" title="Как образец" aria-label={`Создать заказ по образцу: ${order.title}`}><Copy className="w-3 h-3"/></button>}
                      <button onClick={(e) => { e.stopPropagation(); onEdit(order.id); }} className="rounded-md border border-[#23252a] bg-[#08090a] p-1 text-[#8a8f98] hover:bg-[#C62828] hover:text-white"><Pencil className="w-3 h-3"/></button>
                      <button onClick={(e) => { e.stopPropagation(); onView(order); }} className="rounded-md border border-[#23252a] bg-[#08090a] p-1 text-[#8a8f98] hover:bg-[#C62828] hover:text-white"><Eye className="w-3 h-3"/></button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* РЕЖИМ СПИСКА */
          <div className="space-y-2">
            {sortedOrders.map((order) => (
              <div key={order.id} className="group flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#23252a] bg-[#0f1011] p-3 transition hover:border-[#C62828]" onClick={() => onView(order)}>
                <div className="flex-grow min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="truncate font-medium uppercase text-white transition group-hover:text-[#C62828]">{order.title}</h4>
                    <span className={`whitespace-nowrap rounded-md border border-[#23252a] px-2 py-0.5 text-[9px] font-normal ${order.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : order.status === 'in_progress' ? 'bg-[#C62828]/15 text-[#d0d6e0]' : 'bg-[#161718] text-[#8a8f98]'}`}>
                      {order.status === 'completed' ? '✅ ГОТОВО' : order.status === 'in_progress' ? '⏳ В РАБОТЕ' : '🆕 НОВЫЙ'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    {order.deadline && <span className="flex items-center gap-1 whitespace-nowrap">📅 {new Date(order.deadline).toLocaleDateString('ru-RU')}</span>}
                    <span className="text-[10px] font-normal text-[#8a8f98]">
                       {order.department === 'print' ? '🖨 ПЕЧАТЬ' : order.department === 'production' ? '🏭 ИЗГОТОВЛЕНИЕ' : '🛠 МОНТАЖ'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onView(order)} className="rounded-md border border-[#23252a] bg-[#08090a] px-2 py-1 text-xs font-normal text-[#d0d6e0] transition hover:bg-[#C62828] hover:text-white">👁</button>
                  {onDuplicate && <button onClick={() => onDuplicate(order)} className="rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#8a8f98] transition hover:bg-[#C62828]/15 hover:text-[#C62828]" title="Как образец" aria-label={`Создать заказ по образцу: ${order.title}`}><Copy className="w-4 h-4"/></button>}
                  <button onClick={() => onEdit(order.id)} className="rounded-md border border-[#23252a] bg-[#08090a] px-2 py-1 text-xs font-normal text-[#d0d6e0] transition hover:bg-[#C62828] hover:text-white">✏️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}