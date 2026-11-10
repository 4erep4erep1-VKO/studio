// components/orders/OrderCard.tsx
import React from 'react';
import { Trash2, CheckCircle, ExternalLink, User, UserPlus, Truck, Copy } from 'lucide-react';
import { OrderTemplate } from '@/lib/types';
import confetti from 'canvas-confetti';

interface OrderCardProps {
  order: any;
  onView: (order: any) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, assignedToChatId: string | null, title: string) => void;
  onComplete: (id: string) => void;
  onDuplicate?: (order: OrderTemplate) => void;
  onAssignOrder?: (id: string) => void;
  onTransferToInstallation?: (id: string) => void;
  onRestore?: (id: string) => void;
  isAdmin?: boolean;
}

export function OrderCard({ order, onView, onEdit, onDelete, onComplete, onDuplicate, onAssignOrder, onTransferToInstallation, onRestore, isAdmin }: OrderCardProps) {
  const chatId = order.profiles?.telegram_chat_id || null;

  const handleComplete = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF7F50', '#4B2C20', '#10B981']
    });
    onComplete(order.id);
  };

  // Функция расчета статуса дедлайна
  const getDeadlineStatus = () => {
    if (order.status === 'completed') return 'normal'; // Завершенные не пульсируют
    if (!order.deadline) return 'normal';

    const deadlineDate = new Date(order.deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return 'critical'; // Просрочено, сегодня или завтра
    if (diffDays <= 3) return 'warning';  // 2-3 дня
    return 'normal';
  };

  const deadlineStatus = getDeadlineStatus();

  // Добавили relative, чтобы абсолютная рамка легла ровно по краям карточки
  const containerClass = `relative flex h-full flex-col rounded-xl border border-[#23252a] bg-[#0f1011] p-5 transition hover:border-[#C62828]`;

  return (
    <div className={containerClass}>
      {/* Слой пульсации дедлайна */}
      {deadlineStatus === 'critical' && (
        <div className="absolute inset-0 rounded-xl border-2 border-red-500 animate-pulse pointer-events-none z-10" />
      )}
      {deadlineStatus === 'warning' && (
        <div className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-xl border-2 border-[#C62828]" />
      )}

      {/* ЗАГОЛОВОК И ОПИСАНИЕ - КЛИКАБЕЛЬНЫЕ */}
      <div onClick={() => onView(order)} className="cursor-pointer group mb-4 -mx-5 -mt-5 px-5 pt-5 pb-4 relative z-20">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className="mb-2 text-lg font-medium text-white transition group-hover:text-[#C62828]">{order.title}</h3>
          </div>
          <div className="flex gap-2">
             {order.preview_url && <span className="rounded-md border border-[#23252a] bg-[#161718] px-2 py-1 text-[10px] font-normal uppercase text-[#d0d6e0]">Эскиз</span>}
             <span className={`rounded-md border border-[#23252a] bg-[#161718] px-2 py-1 text-[10px] font-normal uppercase text-[#d0d6e0]`}>
               {order.department === 'print' ? '🖨 Печать' : order.department === 'production' ? '🏭 Изготовление' : '🛠 Монтаж'}
             </span>
          </div>
        </div>
        
        <p className="line-clamp-2 flex-grow text-sm text-[#d0d6e0]">
          {order.description || 'Нет описания'}
        </p>
      </div>
      
      <div className="relative z-20 mb-4 space-y-2 rounded-md border border-[#23252a] bg-[#08090a] p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[#8a8f98]">Дедлайн:</span>
          <span className={`font-medium ${deadlineStatus === 'critical' ? 'text-red-400' : deadlineStatus === 'warning' ? 'text-[#C62828]' : 'text-[#8a8f98]'}`}>
            {order.deadline ? new Date(order.deadline).toLocaleDateString('ru-RU') : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#8a8f98]">Исполнитель:</span>
          <span className="font-medium text-[#d0d6e0]">
            {order.is_general ? (
              <span className="text-xs font-medium uppercase text-[#C62828]">Общий заказ</span>
            ) : (
              order.profiles?.full_name || 'Не назначен'
            )}
          </span>
        </div>
        
        <div className="flex justify-between items-center border-t border-border/80 pt-2 mt-2">
          <span className="text-xs font-normal uppercase tracking-wider text-[#8a8f98]">Создал:</span>
          <div className="flex items-center gap-1 text-[#8a8f98]">
            <User className="w-3 h-3" />
            <span className="text-xs">{order.creator_name || 'Админ'}</span>
          </div>
        </div>
      </div>

      {order.report_photo && (
        <div className="relative z-20 mb-4 rounded-md border border-[#23252a] bg-[#08090a] p-2">
          <p className="mb-2 text-[10px] font-normal uppercase text-[#8a8f98]">📸 Отчет:</p>
          <a href={order.report_photo} target="_blank" rel="noopener noreferrer" className="block relative group">
            <img src={order.report_photo} alt="Отчет" className="h-24 w-full rounded-md border border-[#23252a] object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition rounded-md">
              <ExternalLink className="text-white w-5 h-5" />
            </div>
          </a>
        </div>
      )}

      <div className="pt-4 border-t border-border flex flex-wrap gap-2 justify-between items-center mt-auto relative z-20">
        <div className="flex items-center gap-2">
          <span className={`rounded-md border border-[#23252a] px-2 py-1 text-[10px] font-normal uppercase tracking-wider ${
            order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 
            order.status === 'in_progress' ? 'bg-[#C62828]/15 text-[#d0d6e0]' :
            'bg-muted text-muted-foreground border border-border'
          }`}>
            {order.status === 'completed' ? 'Завершен' : order.status === 'in_progress' ? 'В работе' : 'Новый'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(order)}
              className="flex items-center gap-1 rounded-md p-2 text-[#8a8f98] transition hover:bg-[#C62828]/15 hover:text-[#C62828]"
              title="Как образец"
              aria-label={`Создать заказ по образцу: ${order.title}`}
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          {order.status === 'new' && onAssignOrder && (
            <button onClick={() => onAssignOrder(order.id)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-normal text-[#d0d6e0] transition hover:bg-[#C62828]/15 hover:text-white" title="Назначить исполнителя">
              <UserPlus className="w-4 h-4"/> Назначить
            </button>
          )}

          {order.status === 'in_progress' && order.department === 'print' ? (
            <>
              <button 
                onClick={handleComplete}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-normal text-[#d0d6e0] transition hover:bg-[#C62828]/15 hover:text-white"
                title="Завершить (В офис)"
              >
                <CheckCircle className="w-4 h-4" /> В офис
              </button>
              {onTransferToInstallation && (
                <button 
                  onClick={() => onTransferToInstallation(order.id)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-normal text-[#d0d6e0] transition hover:bg-[#C62828]/15 hover:text-white"
                  title="Передать на монтаж"
                >
                  <Truck className="w-4 h-4" /> На монтаж
                </button>
              )}
            </>
          ) : (
            order.status !== 'completed' && (
              <button onClick={handleComplete} className="rounded-md p-2 text-[#d0d6e0] transition hover:bg-[#C62828]/15 hover:text-white" title="Завершить">
                <CheckCircle className="w-5 h-5" />
              </button>
            )
          )}

          {order.status === 'completed' && isAdmin && onRestore && (
            <button
              onClick={() => onRestore(order.id)}
              className="flex items-center gap-1 rounded-md border border-[#23252a] px-2 py-1 text-xs font-normal text-[#d0d6e0] transition hover:bg-[#C62828] hover:text-white"
              title="Вернуть заказ в работу"
            >
              ↩️ Вернуть в работу
            </button>
          )}

          <button onClick={() => onEdit(order.id)} className="rounded-md px-3 py-1.5 text-sm font-normal text-[#d0d6e0] transition hover:bg-[#C62828]/15 hover:text-white">Правка</button>
          <button onClick={() => onDelete(order.id, chatId, order.title)} className="rounded-md p-2 text-[#8a8f98] transition hover:bg-[#C62828]/15 hover:text-[#C62828]" title="Удалить"><Trash2 className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
}