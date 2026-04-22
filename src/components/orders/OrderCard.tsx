import React from 'react';
import { Trash2, CheckCircle, ExternalLink } from 'lucide-react';

interface OrderCardProps {
  order: any;
  onEdit: (id: string) => void;
  onDelete: (id: string, assignedToChatId: string | null, title: string) => void;
  onComplete: (id: string) => void;
}

export function OrderCard({ order, onEdit, onDelete, onComplete }: OrderCardProps) {
  const chatId = order.profiles?.telegram_chat_id || null;

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm hover:border-slate-700 transition flex flex-col h-full">
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-lg text-white mb-2">{order.title}</h3>
        <div className="flex gap-2">
           {order.preview_url && <span className="text-[10px] text-blue-400 bg-blue-900/30 px-2 py-1 rounded uppercase font-bold">Эскиз</span>}
        </div>
      </div>
      
      <p className="text-slate-400 text-sm mb-4 line-clamp-2 flex-grow">
        {order.description || 'Нет описания'}
      </p>
      
      <div className="space-y-2 text-sm mb-4 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
        <div className="flex justify-between">
          <span className="text-slate-500">Дедлайн:</span>
          <span className="text-slate-300">{order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Исполнитель:</span>
          <span className="text-slate-300 font-medium">
            {order.is_general ? (
              <span className="text-purple-400 text-xs uppercase font-bold">Общий заказ</span>
            ) : (
              order.profiles?.full_name || 'Не назначен'
            )}
          </span>
        </div>
      </div>

      {order.report_photo && (
        <div className="mb-4 bg-slate-950 p-2 rounded-lg border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">📸 Отчет:</p>
          <a href={order.report_photo} target="_blank" rel="noopener noreferrer" className="block relative group">
            <img src={order.report_photo} alt="Отчет" className="w-full h-24 object-cover rounded-md border border-slate-700" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition rounded-md">
              <ExternalLink className="text-white w-5 h-5" />
            </div>
          </a>
        </div>
      )}

      <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-2 justify-between items-center mt-auto">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
            order.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
            order.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' : 
            'bg-slate-800 text-slate-300'
          }`}>
            {order.status === 'completed' ? 'Завершен' : order.status === 'in_progress' ? 'В работе' : 'Новый'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Кнопка "Завершить" (только если не завершен) */}
          {order.status !== 'completed' && (
            <button 
              onClick={() => onComplete(order.id)}
              className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition"
              title="Завершить заказ"
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          )}

          <button 
            onClick={() => onEdit(order.id)}
            className="px-3 py-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg text-sm font-bold transition"
          >
            Правка
          </button>

          <button 
            onClick={() => onDelete(order.id, chatId, order.title)}
            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
            title="Удалить заказ"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}