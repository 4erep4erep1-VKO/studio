import React from 'react';
import { Trash2, CheckCircle, ExternalLink, User, UserPlus, Truck } from 'lucide-react';
import confetti from 'canvas-confetti';

interface OrderCardProps {
  order: any;
  onView: (order: any) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, assignedToChatId: string | null, title: string) => void;
  onComplete: (id: string) => void;
  onAssignOrder?: (id: string) => void;
  onTransferToInstallation?: (id: string) => void;
  onRestore?: (id: string) => void;
  isAdmin?: boolean;
}

export function OrderCard({ order, onView, onEdit, onDelete, onComplete, onAssignOrder, onTransferToInstallation, onRestore, isAdmin }: OrderCardProps) {
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

  return (
    <div className="bg-card border border-border p-5 rounded-xl shadow-sm hover:border-muted-foreground/30 transition flex flex-col h-full">
      {/* ЗАГОЛОВОК И ОПИСАНИЕ - КЛИКАБЕЛЬНЫЕ */}
      <div onClick={() => onView(order)} className="cursor-pointer group mb-4 -mx-5 -mt-5 px-5 pt-5 pb-4">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg text-card-foreground group-hover:text-primary transition mb-2">{order.title}</h3>
          <div className="flex gap-2">
             {order.preview_url && <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded uppercase font-bold">Эскиз</span>}
             <span className={`text-[10px] px-2 py-1 rounded uppercase font-bold ${order.department === 'print' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
               {order.department === 'print' ? '🖨 Печать' : '🛠 Монтаж'}
             </span>
          </div>
        </div>
        
        <p className="text-muted-foreground text-sm line-clamp-2 flex-grow">
          {order.description || 'Нет описания'}
        </p>
      </div>
      
      <div className="space-y-2 text-sm mb-4 bg-background/50 p-3 rounded-lg border border-border/50">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Дедлайн:</span>
          <span className="text-foreground font-medium">{order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Исполнитель:</span>
          <span className="text-foreground font-medium">
            {order.is_general ? (
              <span className="text-primary text-xs uppercase font-bold">Общий заказ</span>
            ) : (
              order.profiles?.full_name || 'Не назначен'
            )}
          </span>
        </div>
        
        <div className="flex justify-between items-center border-t border-border/80 pt-2 mt-2">
          <span className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Создал:</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="w-3 h-3" />
            <span className="text-xs">{order.creator_name || 'Админ'}</span>
          </div>
        </div>
      </div>

      {order.report_photo && (
        <div className="mb-4 bg-background p-2 rounded-lg border border-border">
          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">📸 Отчет:</p>
          <a href={order.report_photo} target="_blank" rel="noopener noreferrer" className="block relative group">
            <img src={order.report_photo} alt="Отчет" className="w-full h-24 object-cover rounded-md border border-border" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition rounded-md">
              <ExternalLink className="text-white w-5 h-5" />
            </div>
          </a>
        </div>
      )}

      <div className="pt-4 border-t border-border flex flex-wrap gap-2 justify-between items-center mt-auto">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
            order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 
            order.status === 'in_progress' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 
            'bg-muted text-muted-foreground border border-border'
          }`}>
            {order.status === 'completed' ? 'Завершен' : order.status === 'in_progress' ? 'В работе' : 'Новый'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {order.status === 'new' && onAssignOrder && (
            <button onClick={() => onAssignOrder(order.id)} className="flex items-center gap-1 px-2 py-1 text-amber-600 hover:bg-amber-500/10 rounded-lg text-xs font-bold transition" title="Назначить исполнителя">
              <UserPlus className="w-4 h-4"/> Назначить
            </button>
          )}

          {order.status === 'in_progress' && order.department === 'print' ? (
            <>
              <button 
                onClick={handleComplete}
                className="flex items-center gap-1 px-2 py-1 text-emerald-600 hover:bg-emerald-500/10 rounded-lg text-xs font-bold transition"
                title="Завершить (В офис)"
              >
                <CheckCircle className="w-4 h-4" /> В офис
              </button>
              {onTransferToInstallation && (
                <button 
                  onClick={() => onTransferToInstallation(order.id)}
                  className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-500/10 rounded-lg text-xs font-bold transition"
                  title="Передать на монтаж"
                >
                  <Truck className="w-4 h-4" /> На монтаж
                </button>
              )}
            </>
          ) : (
            order.status !== 'completed' && (
              <button onClick={handleComplete} className="p-2 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition" title="Завершить">
                <CheckCircle className="w-5 h-5" />
              </button>
            )
          )}

          {order.status === 'completed' && isAdmin && onRestore && (
            <button
              onClick={() => onRestore(order.id)}
              className="flex items-center gap-1 px-2 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition"
              title="Вернуть заказ в работу"
            >
              ↩️ Вернуть в работу
            </button>
          )}

          <button onClick={() => onEdit(order.id)} className="px-3 py-1.5 text-primary hover:bg-primary/10 rounded-lg text-sm font-bold transition">Правка</button>
          <button onClick={() => onDelete(order.id, chatId, order.title)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition" title="Удалить"><Trash2 className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
}