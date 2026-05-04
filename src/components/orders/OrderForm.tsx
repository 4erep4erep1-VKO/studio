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
    image_urls: [] as string[],
    source_link: '',
    dimensions: '',
    material: '',
    department: 'installation' // По умолчанию для монтажников
  });

  useEffect(() => {
    async function loadData() {
      try {
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
              image_urls: order.image_urls || [],
              source_link: String(order.source_link || ''),
              dimensions: String(order.dimensions || ''),
              material: String(order.material || ''),
              department: String(order.department || 'installation')
            });
          }
        }
      } catch (err: any) {
        console.error("Ошибка загрузки данных в форму:", err.message);
      }
    }
    loadData();
  }, [orderId]);

  const uploadImages = async (files: FileList | File[]) => {
    setLoading(true);
    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let fileExt = 'png';
      if (file.name && file.name.includes('.')) {
          fileExt = file.name.split('.').pop() || 'png';
      }
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `previews/${fileName}`;
      
     const { error } = await supabase.storage.from('order-photos').upload(filePath, file, {
        contentType: file.type || 'image/png'
      });
      if (!error) {
        const { data } = supabase.storage.from('order-photos').getPublicUrl(filePath);
        newUrls.push(data.publicUrl);
      }
    }

    setFormData(prev => ({ ...prev, image_urls: [...prev.image_urls, ...newUrls] }));
    setLoading(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) uploadImages(files);
  };

  const notifyTelegram = async (chatId: string, text: string) => {
    const token = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
      });
    } catch (e) { console.error(e); }
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
      image_urls: formData.image_urls,
      source_link: formData.source_link,
      dimensions: formData.dimensions,
      material: formData.material,
      department: formData.department
    };

    const isNewOrder = !orderId;
    const { error } = orderId 
      ? await supabase.from('orders').update(payload).eq('id', orderId)
      : await supabase.from('orders').insert([payload]);

    if (!error) {
      if (isNewOrder && !formData.is_general && formData.assigned_to) {
        const installer = installers.find(i => i.id === formData.assigned_to);
        if (installer && installer.telegram_chat_id) {
          await notifyTelegram(
            installer.telegram_chat_id,
            `🚀 <b>Новый заказ!</b>\nНазначен объект: <b>${formData.title}</b>\nОтдел: ${formData.department}`
          );
        }
      }
      onSave();
    } else {
      alert('Ошибка: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden" onPaste={handlePaste}>
      {/* Контейнер со скроллом */}
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        
        <div className="flex-grow overflow-y-auto p-6 space-y-5 custom-scrollbar" style={{ maxHeight: '70vh' }}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Объект</label>
              <input required className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none transition" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Направить в отдел</label>
              <select className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none transition" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                <option value="installation">🛠 Монтаж</option>
                <option value="design">🎨 Дизайн</option>
                <option value="print">🖨 Печать</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Дедлайн</label>
            <input type="date" className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-300 focus:border-blue-500 outline-none transition" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
          </div>

          <div className="flex items-center gap-2 p-2 border border-slate-800 bg-slate-950/50 rounded cursor-pointer" onClick={() => setFormData({...formData, is_general: !formData.is_general})}>
            <input type="checkbox" checked={formData.is_general} readOnly className="w-5 h-5 accent-blue-600" />
            <label className="font-bold text-sm cursor-pointer">Общий заказ (увидят все)</label>
          </div>

          {!formData.is_general && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Исполнитель</label>
              <select className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none transition" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})}>
                <option value="">Не назначен...</option>
                {installers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Размеры</label>
              <input placeholder="3x6 м" className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.dimensions} onChange={e => setFormData({...formData, dimensions: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Материал</label>
              <input placeholder="Баннер..." className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ссылка на макет</label>
            <input placeholder="Облако / Диск" className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.source_link} onChange={e => setFormData({...formData, source_link: e.target.value})} />
          </div>

          <div>
             <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Эскиз (Ctrl+V)</label>
             <input type="file" accept="image/*" multiple onChange={e => e.target.files && uploadImages(e.target.files)} className="text-xs w-full file:bg-blue-600 file:text-white file:border-0 file:rounded file:px-3 file:py-1" />
             <div className="flex gap-2 mt-3 flex-wrap">
               {formData.image_urls.map((url, idx) => (
                 <img key={idx} src={url} className="w-16 h-16 object-cover rounded border border-slate-700" />
               ))}
             </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Задача</label>
            <textarea rows={3} className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
        </div>

        {/* Фиксированная кнопка внизу */}
        <div className="p-6 bg-slate-900 border-t border-slate-800">
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded font-bold uppercase hover:bg-blue-700 transition disabled:bg-slate-700">
            {loading ? 'Сохранение...' : 'Записать заказ'}
          </button>
        </div>
      </form>
    </div>
  );
}