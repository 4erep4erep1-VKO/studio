'use client';

import React, { useState, useMemo } from 'react';
import { Grid3x3, List, ChevronDown } from 'lucide-react';
import { OrderCard } from './OrderCard';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'deadline'>('newest');

  // Фильтрация по поиску (по title и description, без учета регистра)
  const searchedOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchLower = searchQuery.toLowerCase();
      const titleMatch = (order.title || '').toLowerCase().includes(searchLower);
      const descriptionMatch = (order.description || '').toLowerCase().includes(searchLower);
      return titleMatch || descriptionMatch;
    });
  }, [orders, searchQuery]);

  // Сортировка
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
        {/* Первая строка: поиск */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Поиск по названию или описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 bg-background text-foreground placeholder:text-muted-foreground border border-border rounded-lg outline-none focus:border-primary transition"
          />
        </div>

        {/* Вторая строка: сортировка и переключение вида */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Выпадающий список сортировки */}
          <div className="w-full md:w-auto flex items-center gap-2">
            <label className="text-sm font-bold text-muted-foreground whitespace-nowrap">
              Сортировка:
            </label>
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

          {/* Кнопки переключения вида */}
          <div className="flex bg-background border border-border rounded-lg p-1 w-full md:w-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Вид сеткой"
            >
              <Grid3x3 className="w-4 h-4" />
              <span className="hidden sm:inline">Плитки</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Вид списком"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Список</span>
            </button>
          </div>
        </div>

        {/* Счетчик результатов */}
        <div className="mt-3 text-xs text-muted-foreground font-medium">
          Найдено заказов: <span className="font-bold text-foreground">{sortedOrders.length}</span> / {orders.length}
        </div>
      </div>

      {/* ОТОБРАЖЕНИЕ ЗАКАЗОВ */}
      <div>
        {sortedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-muted-foreground font-medium">
              {searchQuery ? 'Заказов не найдено' : 'Нет заказов'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          // РЕЖИМ СЕТКИ (ПЛИТКИ)
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedOrders.map((order) => (
              <div key={order.id} className="h-full">
                <OrderCard
                  order={order}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={(id, cid, title) => onDelete(id, cid, title, order.status)}
                  onComplete={onComplete}
                  onAssignOrder={onAssignOrder}
                  onTransferToInstallation={onTransferToInstallation}
                  onRestore={onRestore}
                  isAdmin={isAdmin}
                />
              </div>
            ))}
          </div>
        ) : (
          // РЕЖИМ СПИСКА (КОМПАКТНЫЕ СТРОКИ)
          <div className="space-y-2">
            {sortedOrders.map((order) => (
              <div
                key={order.id}
                className="bg-card border border-border p-3 rounded-lg hover:border-primary transition flex items-center justify-between gap-4 cursor-pointer group"
                onClick={() => onView(order)}
              >
                {/* Левая часть: основная информация */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-foreground truncate group-hover:text-primary transition">
                      {order.title}
                    </h4>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${
                        order.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-600'
                          : order.status === 'in_progress'
                          ? 'bg-amber-500/20 text-amber-600'
                          : 'bg-blue-500/20 text-blue-600'
                      }`}
                    >
                      {order.status === 'completed'
                        ? '✅'
                        : order.status === 'in_progress'
                        ? '⏳'
                        : '🆕'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    {order.description && (
                      <span className="truncate">{order.description.substring(0, 40)}...</span>
                    )}
                    {order.deadline && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        📅 {new Date(order.deadline).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {!order.is_general && order.profiles?.full_name && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        👤 {order.profiles.full_name}
                      </span>
                    )}
                    {order.is_general && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        🌍 Общий
                      </span>
                    )}
                  </div>
                </div>

                {/* Правая часть: действия */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onView(order)}
                    className="text-xs px-2 py-1 bg-background border border-border rounded hover:bg-primary hover:text-primary-foreground transition font-bold"
                    title="Просмотр"
                  >
                    👁
                  </button>
                  <button
                    onClick={() => onEdit(order.id)}
                    className="text-xs px-2 py-1 bg-background border border-border rounded hover:bg-primary hover:text-primary-foreground transition font-bold"
                    title="Редактирование"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
