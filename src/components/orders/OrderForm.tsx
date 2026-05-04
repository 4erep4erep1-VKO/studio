'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface OrderFormProps {
  orderId: string | null;
  onSave: () => void;
  creatorId: string;
}

export default function OrderForm({ orderId, onSave, creatorId }: OrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [installers, setInstallers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline: '',
    assigned_to: '',
    is_general: true,
    image_urls: [] as string[],
    source_link: '',
    dimensions: '',
    material: '',
    department: 'installation' // По умолчанию монтаж
  });

  useEffect(() => {
    async function loadData() {
      try {
        const { data: inst } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['installer', 'admin']);
        if (inst) setInstallers(inst);

        if (orderId) {
          const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
          if (order) {
            setFormData({
              ...order,
              deadline: order.deadline ? String(order.deadline).split('T')[0] : '',
              image_urls: order.image_urls || []
            });
          }
        }
      } catch (e) { console.error(e); }
    }
    loadData();
  }, [orderId]);

  const uploadImages = async (files: FileList | File[]) => {
    setLoading(true);
    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const filePath = `previews/${fileName}`;
      
      const { error } = await supabase.storage.from('order-photos').upload(filePath, file);
      if (!error) {
        const { data } = supabase.storage.from('order-photos').getPublicUrl(filePath);
        newUrls.push(data.publicUrl);
      }
    }

    setFormData(prev => ({ ...prev, image_urls: [...prev.image_urls, ...newUrls] }));
    setLoading(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const files = items.filter(i => i.type.includes('image')).map(i => i.getAsFile()).filter((f): f is File => f !== null);
    if (files.length) uploadImages(files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = {
      ...formData,
      created_by: creatorId,
      assigned_to: formData.is_general ? null : (formData.assigned_to || null)
    };

    const { error } = orderId 
      ? await supabase.from('orders').update(payload).eq('id', orderId)
      : await supabase.from('orders').insert([payload]);

    if (!error) onSave();
    else alert('Ошибка: ' + error.message);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden p-6" onPaste={handlePaste}>
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        
        <div className="flex-grow overflow-y-auto space-y-5 pr-2 custom-scrollbar" style={{ maxHeight: '70vh' }}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Объект</label>
              <input required className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Куда отправить</label>
              <select className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                <option value="installation">🛠 На монтаж</option>
                <option value="print">🖨 На печать</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Дедлайн</label>
              <input type="date" className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-300 focus:border-blue-500 outline-none" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Лично исполнителю</label>
              <select disabled={formData.is_general} className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none disabled:opacity-30" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})}>
                <option value="">Не назначен...</option>
                {installers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 border border-slate-800 bg-slate-950/50 rounded cursor-pointer" onClick={() => setFormData({...formData, is_general: !formData.is_general})}>
            <input type="checkbox" checked={formData.is_general} readOnly className="w-5 h-5 accent-blue-600" />
            <label className="font-bold text-sm cursor-pointer">Общий заказ (увидят все в отделе)</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Размеры (3х6м)" className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.dimensions} onChange={e => setFormData({...formData, dimensions: e.target.value})} />
            <input placeholder="Материал" className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ссылка на макет</label>
            <input placeholder="Облако / Диск" className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.source_link} onChange={e => setFormData({...formData, source_link: e.target.value})} />
          </div>

          <div>
             <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Эскиз / Фото (Можно Ctrl+V)</label>
             <input type="file" accept="image/*" multiple onChange={e => e.target.files && uploadImages(e.target.files)} className="text-xs w-full file:bg-blue-600 file:text-white file:border-0 file:rounded file:px-3 file:py-1 cursor-pointer" />
             {formData.image_urls.length > 0 && (
               <div className="flex gap-2 mt-3 flex-wrap">
                 {formData.image_urls.map((url, idx) => (
                   <img key={idx} src={url} alt="Превью" className="w-16 h-16 object-cover rounded border border-slate-700 shadow-sm" />
                 ))}
               </div>
             )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Задача</label>
            <textarea rows={3} placeholder="Что именно нужно сделать..." className="w-full p-2 bg-slate-950 border border-slate-800 rounded focus:border-blue-500 outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
        </div>

        <div className="pt-4 mt-auto border-t border-slate-800">
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded font-bold uppercase hover:bg-blue-700 transition disabled:bg-slate-700">
            {loading ? 'Секунду...' : 'Запустить в работу'}
          </button>
        </div>
      </form>
    </div>
  );
}