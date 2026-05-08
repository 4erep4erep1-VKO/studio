import React from 'react';
import { Trash2, CheckCircle, ExternalLink, User } from 'lucide-react';

interface OrderCardProps {
  order: any;
  onEdit: (id: string) => void;
  onDelete: (id: string, assignedToChatId: string | null, title: string) => void;
  onComplete: (id: string) => void;
}

export function OrderCard({ order, onEdit, onDelete, onComplete }: OrderCardProps) {
  const chatId = order.profiles?.telegram_chat_id || null;

  return (
    <div className="bg-card border border-border p-5 rounded-xl shadow-sm hover:border-muted-foreground/30 transition flex flex-col h-full">
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-lg text-card-foreground mb-2">{order.title}</h3>
        <div className="flex gap-2">
           {order.preview_url && <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded uppercase font-bold">Эскиз</span>}
        </div>
      </div>
      
      <p className="text-muted-foreground text-sm mb-4 line-clamp-2 flex-grow">
        {order.description || 'Нет описания'}
      </p>
      
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
        
        {/* НОВЫЙ БЛОК: КТО СОЗДАЛ ЗАКАЗ */}
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
          {order.status !== 'completed' && (
            <button 
              onClick={() => onComplete(order.id)}
              className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
              title="Завершить заказ"
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          )}

          <button 
            onClick={() => onEdit(order.id)}
            className="px-3 py-1.5 text-primary hover:bg-primary/10 rounded-lg text-sm font-bold transition"
          >
            Правка
          </button>

          <button 
            onClick={() => onDelete(order.id, chatId, order.title)}
            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition"
            title="Удалить заказ"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}