// components/orders/OrderCard.tsx
import React from 'react';
import { Trash2, CheckCircle, User, UserPlus, Truck, Copy, Pencil, Image as ImageIcon } from 'lucide-react';
import { OrderTemplate } from '@/lib/types';

interface OrderCardProps {
  order: any;
  onView: (order: any) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, assignedToChatId: string | null, title: string, status?: string) => void;
  onComplete: (id: string) => void;
  onDuplicate?: (order: OrderTemplate) => void;
  onAssignOrder?: (id: string) => void;
  onTransferToInstallation?: (id: string) => void;
  onRestore?: (id: string) => void;
  isAdmin?: boolean;
}

export const OrderCard = React.memo(function OrderCard({ order, onView, onEdit, onDelete, onComplete, onDuplicate, onAssignOrder, onTransferToInstallation, onRestore, isAdmin }: OrderCardProps) {
  const chatId = order.profiles?.telegram_chat_id || null;
  const photoCount = Array.isArray(order.image_urls) ? order.image_urls.filter(Boolean).length : 0;
  const reportPhotos = Array.from(new Set([
    ...(Array.isArray(order.report_photos) ? order.report_photos : []),
    ...(order.report_photo ? [order.report_photo] : []),
  ].filter((photo): photo is string => typeof photo === 'string' && photo.length > 0)));

  const handleComplete = () => {
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

  const deptStripeClass =
    order.department === 'print'
      ? 'bg-purple-500'
      : order.department === 'production'
        ? 'bg-amber-500'
        : 'bg-blue-500';

  // Добавили relative, чтобы абсолютная рамка легла ровно по краям карточки
  const containerClass = `relative overflow-hidden p-5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-primary/35 transition-all duration-200 flex flex-col justify-between min-h-[310px] h-full bg-card border border-border`;

  return (
    <div className={containerClass}>
      {/* Тонкий цветовой маркер цеха */}
      <div className={`absolute inset-x-0 top-0 h-[3px] pointer-events-none z-10 ${deptStripeClass}`} />

      {/* Слой пульсации дедлайна */}
      {deadlineStatus === 'critical' && (
        <div className="absolute inset-0 rounded-xl border-2 border-red-500 animate-pulse pointer-events-none z-10" />
      )}
      {deadlineStatus === 'warning' && (
        <div className="absolute inset-0 rounded-xl border-2 border-brand animate-pulse pointer-events-none z-10" />
      )}

      {/* ЗАГОЛОВОК И ОПИСАНИЕ - КЛИКАБЕЛЬНЫЕ */}
      <div onClick={() => onView(order)} className="cursor-pointer group mb-4 -mx-5 -mt-5 px-5 pt-5 pb-4 relative z-20">
        <div className="flex justify-between items-start gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h3 className="min-w-0 font-bold text-lg leading-[1.375rem] text-card-foreground group-hover:text-primary transition mb-2 line-clamp-2 min-h-[2.75rem] break-words">{order.title}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
             {order.preview_url && <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded uppercase font-bold whitespace-nowrap">Эскиз</span>}
             <span className={`text-[10px] px-2 py-1 rounded uppercase font-bold whitespace-nowrap ${order.department === 'print' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : order.department === 'production' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'}`}>
               {order.department === 'print' ? '🖨 Печать' : order.department === 'production' ? '🏭 Изготовление' : '🛠 Монтаж'}
             </span>
          </div>
        </div>
        
        <p className="text-muted-foreground text-sm line-clamp-2 min-h-[2.5rem] break-words">
          {order.description || 'Нет описания'}
        </p>
      </div>
      
      <div className="space-y-2 text-sm mb-4 bg-background/50 p-3 rounded-lg border border-border/50 relative z-20">
        <div className="flex justify-between items-center gap-2">
          <span className="text-muted-foreground shrink-0">Дедлайн:</span>
          <span className={`font-bold text-right ${deadlineStatus === 'critical' ? 'text-red-500' : deadlineStatus === 'warning' ? 'text-brand' : 'text-foreground'}`}>
            {order.deadline ? new Date(order.deadline).toLocaleDateString('ru-RU') : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-muted-foreground shrink-0">Исполнитель:</span>
          <span className="text-foreground font-medium min-w-0 truncate text-right">
            {order.is_general ? (
              <span className="text-primary text-xs uppercase font-bold">Общий заказ</span>
            ) : (
              order.profiles?.full_name || 'Не назначен'
            )}
          </span>
        </div>
        
        <div className="flex justify-between items-center gap-2 border-t border-border/80 pt-2 mt-2">
          <span className="text-muted-foreground text-xs uppercase font-bold tracking-wider shrink-0">Создал:</span>
          <div className="flex items-center gap-1 text-muted-foreground min-w-0">
            <User className="w-3 h-3 shrink-0" />
            <span className="text-xs truncate">{order.creator_name || 'Админ'}</span>
          </div>
        </div>
      </div>

      {reportPhotos.length > 0 && (
        <div className="mb-4 bg-background p-2 rounded-lg border border-border relative z-20">
          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">📸 Отчет:</p>
          <div className="grid grid-cols-2 gap-2">
            {reportPhotos.slice(0, 4).map((photo, index) => (
              <a key={`${photo}-${index}`} href={photo} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-border">
                <img src={photo} alt={`Фотоотчет ${index + 1}`} className="h-24 w-full object-cover transition hover:scale-105" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-3 relative z-20">
        <div className="flex flex-wrap items-center justify-between gap-2 min-h-[32px]">
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
              order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 
              order.status === 'in_progress' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
              'bg-muted text-muted-foreground border border-border'
            }`}>
              {order.status === 'completed' ? 'Завершен' : order.status === 'in_progress' ? 'В работе' : 'Новый'}
            </span>
            {photoCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border whitespace-nowrap" title={`Прикреплено фото: ${photoCount}`}>
                <ImageIcon className="w-3 h-3" /> {photoCount}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {order.status === 'new' && onAssignOrder && (
              <button onClick={() => onAssignOrder(order.id)} className="h-7 px-2 inline-flex items-center gap-1 text-primary hover:bg-primary/10 rounded-md text-xs font-bold transition active:scale-[0.97] whitespace-nowrap" title="Назначить исполнителя">
                <UserPlus className="w-3.5 h-3.5"/> Назначить
              </button>
            )}

            {order.status === 'in_progress' && order.department === 'print' ? (
              <>
                <button
                  onClick={handleComplete}
                  className="h-7 px-2 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md text-xs font-bold transition active:scale-[0.97] whitespace-nowrap"
                  title="Завершить (В офис)"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> В офис
                </button>
                {onTransferToInstallation && (
                  <button
                    onClick={() => onTransferToInstallation(order.id)}
                    className="h-7 px-2 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-md text-xs font-bold transition active:scale-[0.97] whitespace-nowrap"
                    title="Передать на монтаж"
                  >
                    <Truck className="w-3.5 h-3.5" /> На монтаж
                  </button>
                )}
              </>
            ) : (
              order.status !== 'completed' && (
                <button onClick={handleComplete} className="h-7 w-7 inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition active:scale-[0.97]" title="Завершить" aria-label="Завершить заказ">
                  <CheckCircle className="w-4 h-4" />
                </button>
              )
            )}

            {order.status === 'completed' && isAdmin && onRestore && (
              <button
                onClick={() => onRestore(order.id)}
                className="h-7 px-2 inline-flex items-center gap-1 text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md text-xs font-bold transition active:scale-[0.97] whitespace-nowrap"
                title="Вернуть заказ в работу"
              >
                ↩️ Вернуть в работу
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 mt-2 border-t border-border/40">
          <button onClick={() => onDuplicate?.(order)} className="h-7 px-2 inline-flex items-center gap-1 text-primary hover:bg-primary/10 rounded-md text-xs font-bold transition active:scale-[0.97] whitespace-nowrap" title="Как образец" aria-label={`Создать заказ по образцу: ${order.title}`}><Copy className="h-3.5 w-3.5" /> Как образец</button>
          <button onClick={() => onEdit(order.id)} className="h-7 px-2 inline-flex items-center gap-1 text-primary hover:bg-primary/10 rounded-md text-xs font-bold transition active:scale-[0.97] whitespace-nowrap"><Pencil className="h-3.5 w-3.5" /> Правка</button>
          <button onClick={() => onDelete(order.id, chatId, order.title, order.status)} className="h-7 w-7 shrink-0 inline-flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-md transition active:scale-[0.97]" title="Удалить" aria-label={`Удалить заказ: ${order.title}`}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
});