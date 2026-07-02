'use client';

import React, { useState, useMemo } from 'react';
import { Grid3x3, List, LayoutGrid, ChevronDown, Eye, Pencil } from 'lucide-react';
import { OrderCard } from './OrderCard';
import { useRouter } from 'next/navigation';

interface OrderListManagerProps {
  orders: any[];
  onEdit: (orderId: string) => void;
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
  onEdit,
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

  const searchedOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchLower = searchQuery.toLowerCase();
      const titleMatch = (order.title || '').toLowerCase().includes(searchLower);
      const descriptionMatch = (order.description || '').toLowerCase().includes(searchLower);
      return titleMatch || descriptionMatch;
    });
  }, [orders, searchQuery]);

  const sortedOrders = useMemo(() => {
    const arr = [...searchedOrders];
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
  }, [searchedOrders, sortBy]);

  return (
    <div className="space-y-4">
      {/* ПАНЕЛЬ УПРАВЛЕНИЯ */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Поиск по названию или описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 bg-background text-foreground placeholder:text-muted-foreground border border-border rounded-lg outline-none focus:border-primary transition"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="w-full md:w-auto flex items-center gap-2">
            <label className="text-sm font-bold text-muted-foreground whitespace-nowrap">Сортировка:</label>
            <div className="relative w-full md:w-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none w-full md:w-max pl-3 pr-9 py-2 bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary transition text-sm font-medium"
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
          <div className="flex bg-background border border-border rounded-lg p-1 w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition whitespace-nowrap ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Крупная сетка"
            >
              <Grid3x3 className="w-4 h-4" />
              <span className="hidden lg:inline">Плитки</span>
            </button>
            
            <button
              onClick={() => setViewMode('compact')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition whitespace-nowrap ${viewMode === 'compact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Мелкая сетка"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden lg:inline">Мелкая плитка</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition whitespace-nowrap ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Вид списком"
            >
              <List className="w-4 h-4" />
              <span className="hidden lg:inline">Список</span>
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground font-medium">
          Найдено заказов: <span className="font-bold text-foreground">{sortedOrders.length}</span> / {orders.length}
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
                <OrderCard order={order} onView={onView} onEdit={onEdit} onDelete={(id, cid, title) => onDelete(id, cid, title, order.status)} onComplete={onComplete} onAssignOrder={onAssignOrder} onTransferToInstallation={onTransferToInstallation} onRestore={onRestore} isAdmin={isAdmin} />
              </div>
            ))}
          </div>
        ) : viewMode === 'compact' ? (
          /* РЕЖИМ МЕЛКОЙ ПЛИТКИ */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
            {sortedOrders.map((order) => (
              <div 
                key={order.id} 
                className="bg-card border border-border p-2 rounded-lg hover:border-primary transition flex flex-col justify-between h-32 cursor-pointer group relative shadow-sm"
                onClick={() => onView(order)}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[8px] px-1 rounded font-black uppercase ${order.department === 'print' ? 'bg-purple-500/20 text-purple-500' : order.department === 'production' ? 'bg-brand/20 text-brand' : 'bg-blue-500/20 text-blue-500'}`}>
                      {order.department === 'print' ? 'ПЕЧАТЬ' : order.department === 'production' ? 'ИЗГОТОВЛЕНИЕ' : 'МОНТАЖ'}
                    </span>
                    <span className="text-[10px]">{order.status === 'completed' ? '✅' : order.status === 'in_progress' ? '⏳' : '🆕'}</span>
                  </div>
                  <h4 className="text-xs font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition uppercase">
                    {order.title}
                  </h4>
                </div>

                <div className="mt-auto">
                   {order.deadline && (
                      <div className="text-[9px] text-muted-foreground flex items-center gap-1 font-medium">
                        📅 {new Date(order.deadline).toLocaleDateString('ru-RU', { month: 'numeric', day: 'numeric' })}
                      </div>
                   )}
                   <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(order.id); }} className="p-1 bg-background border border-border rounded hover:text-primary"><Pencil className="w-3 h-3"/></button>
                      <button onClick={(e) => { e.stopPropagation(); onView(order); }} className="p-1 bg-background border border-border rounded hover:text-primary"><Eye className="w-3 h-3"/></button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* РЕЖИМ СПИСКА */
          <div className="space-y-2">
            {sortedOrders.map((order) => (
              <div key={order.id} className="bg-card border border-border p-3 rounded-lg hover:border-primary transition flex items-center justify-between gap-4 cursor-pointer group" onClick={() => onView(order)}>
                <div className="flex-grow min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-foreground truncate group-hover:text-primary transition uppercase">{order.title}</h4>
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600' : order.status === 'in_progress' ? 'bg-brand/20 text-brand' : 'bg-blue-500/20 text-blue-600'}`}>
                      {order.status === 'completed' ? '✅ ГОТОВО' : order.status === 'in_progress' ? '⏳ В РАБОТЕ' : '🆕 НОВЫЙ'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    {order.deadline && <span className="flex items-center gap-1 whitespace-nowrap">📅 {new Date(order.deadline).toLocaleDateString('ru-RU')}</span>}
                    <span className={`text-[10px] font-bold ${order.department === 'print' ? 'text-purple-400' : order.department === 'production' ? 'text-brand' : 'text-blue-400'}`}>
                       {order.department === 'print' ? '🖨 ПЕЧАТЬ' : order.department === 'production' ? '🏭 ИЗГОТОВЛЕНИЕ' : '🛠 МОНТАЖ'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onView(order)} className="text-xs px-2 py-1 bg-background border border-border rounded hover:bg-primary hover:text-primary-foreground transition font-bold">👁</button>
                  <button onClick={() => onEdit(order.id)} className="text-xs px-2 py-1 bg-background border border-border rounded hover:bg-primary hover:text-primary-foreground transition font-bold">✏️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}