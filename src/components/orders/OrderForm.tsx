'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface OrderFormProps {
  orderId: string | null;
  onSave: () => void;
}

export default function OrderForm({ orderId, onSave }: OrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [installers, setInstallers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline: '',
    assigned_to: '',
    is_general: false,
    preview_url: ''
  });

  useEffect(() => {
    async function loadData() {
      try {
        // ДОБАВЛЕНО: Теперь мы запрашиваем еще и telegram_chat_id, чтобы знать, куда писать
        const { data: inst } = await supabase
          .from('profiles')
          .select('id, full_name, telegram_chat_id')
          .in('role', ['installer', 'admin']);
          
        if (inst) setInstallers(inst);

        if (orderId) {
          const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
          if (error) throw error;
          if (order) {
            setFormData({
              title: String(order.title || ''),
              description: String(order.description || ''),
              deadline: order.deadline ? String(order.deadline).split('T')[0] : '',
              assigned_to: String(order.assigned_to || ''),
              is_general: Boolean(order.is_general),
              preview_url: String(order.preview_url || '')
            });
          }
        }
      } catch (err: any) {
        console.error("Ошибка загрузки данных в форму:", err.message);
      }
    }
    loadData();
  }, [orderId]);

  const uploadImage = async (file: File) => {
    setLoading(true);
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `previews/${fileName}`;
    const { error } = await supabase.storage.from('order-photos').upload(filePath, file);
    if (!error) {
      const { data } = supabase.storage.from('order-photos').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, preview_url: data.publicUrl }));
    } else {
      alert('Ошибка хранилища: ' + error.message);
    }
    setLoading(false);
  };

  // ДОБАВЛЕНО: Функция отправки сообщения в Телеграм
  const notifyTelegram = async (chatId: string, text: string) => {
    const token = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
      });
    } catch (e) {
      console.error("Не удалось отправить уведомление в ТГ", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const payload: any = {
      title: formData.title,
      description: formData.description,
      deadline: formData.deadline || null,
      is_general: formData.is_general,
      assigned_to: formData.is_general ? null : (formData.assigned_to || null),
      preview_url: formData.preview_url || null
    };

    const isNewOrder = !orderId; // Проверяем, новый ли это заказ

    const { error } = orderId 
      ? await supabase.from('orders').update(payload).eq('id', orderId)
      : await supabase.from('orders').insert([payload]);

    if (!error) {
      // ДОБАВЛЕНО: Логика уведомлений при успешном сохранении
      if (isNewOrder && !formData.is_general && formData.assigned_to) {
        const installer = installers.find(i => i.id === formData.assigned_to);
        if (installer && installer.telegram_chat_id) {
          await notifyTelegram(
            installer.telegram_chat_id,
            `🚀 <b>Новый заказ!</b>\nАдмин назначил тебе объект: <b>${formData.title}</b>\n\nЖми «📦 Мои заказы», чтобы увидеть эскиз и детали.`
          );
        }
      }
      onSave(); // Закрываем модалку и обновляем список
    } else {
      alert('ОШИБКА БАЗЫ ДАННЫХ: ' + error.message);
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Объект</label>
          <input required className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 focus:outline-none transition" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Дедлайн</label>
          <input type="date" className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-300 focus:border-blue-500 focus:outline-none transition" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
        </div>
        <div className="flex items-center gap-2 p-2 border border-slate-800 bg-slate-950/50 rounded">
          <input type="checkbox" checked={formData.is_general} onChange={e => setFormData({...formData, is_general: e.target.checked})} className="w-5 h-5 accent-blue-600" />
          <label className="font-bold text-sm">Общий заказ (увидят все)</label>
        </div>
        {!formData.is_general && (
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Исполнитель</label>
            <select className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 focus:outline-none transition" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})}>
              <option value="">Не назначен...</option>
              {installers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
            </select>
          </div>
        )}
        <div>
           <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Эскиз / Фото</label>
           <input type="file" onChange={e => e.target.files && uploadImage(e.target.files[0])} className="text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition" />
           {formData.preview_url && <img src={formData.preview_url} alt="Превью" className="mt-2 w-20 h-20 object-cover rounded border border-slate-700" />}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Описание / Задача</label>
          <textarea rows={3} placeholder="Что нужно сделать..." className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 focus:outline-none transition" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded font-bold uppercase tracking-wider hover:bg-blue-700 transition disabled:bg-slate-700 disabled:text-slate-500">
          {loading ? 'Сохранение...' : 'Записать заказ'}
        </button>
      </form>
    </div>
  );
}