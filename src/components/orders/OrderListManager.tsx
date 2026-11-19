'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Grid3x3, List, LayoutGrid, ChevronDown, Eye, Pencil, Copy, Image as ImageIcon } from 'lucide-react';
import { OrderCard } from './OrderCard';
import { OrderTemplate } from '@/lib/types';

interface OrderListManagerProps {
  orders: any[];
  totalOrdersCount?: number;
  onSearch?: (query: string) => void;
  onEdit: (orderId: string) => void;
  onDuplicate?: (order: OrderTemplate) => void;
  onDelete: (id: string, assignedToChatId: string | null, title: string, status?: string) => void;
  onComplete: (id: string) => void;
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
  const isFirstSearchRun = useRef(true);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return;
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      onSearchRef.current?.('');
      return;
    }

    const timer = setTimeout(() => {
      onSearchRef.current?.(searchQuery);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
          <div className="flex bg-background border border-border rounded-lg p-1 w-full md:w-auto gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex-1 md:flex-none h-9 flex items-center justify-center gap-2 px-3 rounded-md text-sm font-bold transition whitespace-nowrap ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Крупная сетка"
            >
              <Grid3x3 className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">Плитки</span>
            </button>
            
            <button
              onClick={() => setViewMode('compact')}
              className={`flex-1 md:flex-none h-9 flex items-center justify-center gap-2 px-3 rounded-md text-sm font-bold transition whitespace-nowrap ${viewMode === 'compact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Мелкая сетка"
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">Мелкая плитка</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 md:flex-none h-9 flex items-center justify-center gap-2 px-3 rounded-md text-sm font-bold transition whitespace-nowrap ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Вид списком"
            >
              <List className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">Список</span>
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground font-medium">
          Найдено заказов: <span className="font-bold text-foreground">{sortedOrders.length}</span> / {totalOrdersCount ?? orders.length}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedOrders.map((order) => (
              <div key={order.id} className="h-full min-w-0">
                <OrderCard order={order} onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} onComplete={onComplete} onAssignOrder={onAssignOrder} onTransferToInstallation={onTransferToInstallation} onRestore={onRestore} isAdmin={isAdmin} />
              </div>
            ))}
          </div>
        ) : viewMode === 'compact' ? (
          /* РЕЖИМ МЕЛКОЙ ПЛИТКИ */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {sortedOrders.map((order) => (
              <div 
                key={order.id} 
                className="bg-card border border-border p-2.5 rounded-lg hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[136px] cursor-pointer group relative shadow-sm min-w-0"
                onClick={() => onView(order)}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase truncate max-w-[75%] ${order.department === 'print' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : order.department === 'production' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'}`}>
                      {order.department === 'print' ? 'ПЕЧАТЬ' : order.department === 'production' ? 'ИЗГОТОВЛЕНИЕ' : 'МОНТАЖ'}
                    </span>
                    <span className="text-[10px] shrink-0">{order.status === 'completed' ? '✅' : order.status === 'in_progress' ? '⏳' : '🆕'}</span>
                  </div>
                  <h4 className="text-xs font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition uppercase break-words">
                    {order.title}
                  </h4>
                </div>

                <div className="mt-auto pt-2">
                   {order.deadline && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium mb-1.5">
                        📅 {new Date(order.deadline).toLocaleDateString('ru-RU', { month: 'numeric', day: 'numeric' })}
                      </div>
                   )}
                   <div className="flex items-center gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); onDuplicate?.(order); }} className="h-7 w-7 inline-flex items-center justify-center bg-background border border-border rounded hover:text-primary hover:border-primary transition active:scale-[0.97]" title="Как образец" aria-label={`Создать заказ по образцу: ${order.title}`}><Copy className="w-3.5 h-3.5"/></button>
                      <button onClick={(e) => { e.stopPropagation(); onEdit(order.id); }} className="h-7 w-7 inline-flex items-center justify-center bg-background border border-border rounded hover:text-primary hover:border-primary transition active:scale-[0.97]" title="Редактировать" aria-label={`Редактировать заказ: ${order.title}`}><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={(e) => { e.stopPropagation(); onView(order); }} className="h-7 w-7 inline-flex items-center justify-center bg-background border border-border rounded hover:text-primary hover:border-primary transition active:scale-[0.97]" title="Открыть" aria-label={`Открыть заказ: ${order.title}`}><Eye className="w-3.5 h-3.5"/></button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* РЕЖИМ СПИСКА */
          <div className="space-y-2">
            {sortedOrders.map((order) => {
              const photoCount = Array.isArray(order.image_urls) ? order.image_urls.filter(Boolean).length : 0;
              return (
                <div key={order.id} className="bg-card border border-border p-3 rounded-lg hover:border-primary/40 hover:shadow-sm transition-all duration-150 flex items-center justify-between gap-4 cursor-pointer group" onClick={() => onView(order)}>
                  <div className="flex-grow min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-foreground truncate group-hover:text-primary transition uppercase">{order.title}</h4>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : order.status === 'in_progress' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                        {order.status === 'completed' ? '✅ ГОТОВО' : order.status === 'in_progress' ? '⏳ В РАБОТЕ' : '🆕 НОВЫЙ'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2.5 flex-wrap">
                      {order.deadline && <span className="flex items-center gap-1 whitespace-nowrap">📅 {new Date(order.deadline).toLocaleDateString('ru-RU')}</span>}
                      <span className={`text-[10px] font-bold ${order.department === 'print' ? 'text-purple-500 dark:text-purple-400' : order.department === 'production' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-500 dark:text-blue-400'}`}>
                         {order.department === 'print' ? '🖨 ПЕЧАТЬ' : order.department === 'production' ? '🏭 ИЗГОТОВЛЕНИЕ' : '🛠 МОНТАЖ'}
                      </span>
                      {photoCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                          <ImageIcon className="w-3 h-3" /> {photoCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onView(order)} className="h-8 w-8 inline-flex items-center justify-center bg-background border border-border rounded-md hover:bg-primary hover:text-primary-foreground transition active:scale-[0.97]" title="Открыть" aria-label={`Открыть заказ: ${order.title}`}><Eye className="w-4 h-4"/></button>
                    <button onClick={() => onDuplicate?.(order)} className="h-8 w-8 inline-flex items-center justify-center bg-background border border-border rounded-md hover:bg-primary hover:text-primary-foreground transition active:scale-[0.97]" title="Как образец" aria-label={`Создать заказ по образцу: ${order.title}`}><Copy className="w-4 h-4"/></button>
                    <button onClick={() => onEdit(order.id)} className="h-8 w-8 inline-flex items-center justify-center bg-background border border-border rounded-md hover:bg-primary hover:text-primary-foreground transition active:scale-[0.97]" title="Редактировать" aria-label={`Редактировать заказ: ${order.title}`}><Pencil className="w-4 h-4"/></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}