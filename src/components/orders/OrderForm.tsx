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
      const { data: inst } = await supabase.from('profiles').select('id, full_name').in('role', ['installer', 'admin']);
      if (inst) setInstallers(inst);
      if (orderId) {
        const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (order) setFormData({ ...order, deadline: order.deadline?.split('T')[0] || '' });
      }
    }
    loadData();
  }, [orderId]);

  const uploadImages = async (files: FileList | File[]) => {
    setLoading(true);
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { error } = await supabase.storage.from('order-photos').upload(`previews/${fileName}`, files[i]);
      if (!error) {
        const { data } = supabase.storage.from('order-photos').getPublicUrl(`previews/${fileName}`);
        newUrls.push(data.publicUrl);
      }
    }
    setFormData(prev => ({ ...prev, image_urls: [...prev.image_urls, ...newUrls] }));
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...formData, created_by: creatorId, assigned_to: formData.is_general ? null : formData.assigned_to };
    const { error } = orderId ? await supabase.from('orders').update(payload).eq('id', orderId) : await supabase.from('orders').insert([payload]);
    if (!error) onSave();
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden p-6" onPaste={e => {
      const files = Array.from(e.clipboardData.items).filter(i => i.type.includes('image')).map(i => i.getAsFile());
      if (files.length) uploadImages(files as File[]);
    }}>
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar" style={{ maxHeight: '70vh' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400">Объект</label>
              <input required className="w-full p-2 bg-slate-950 border border-slate-800 rounded outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Куда отправить</label>
              <select className="w-full p-2 bg-slate-950 border border-slate-800 rounded outline-none" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                <option value="installation">🛠 На монтаж</option>
                <option value="print">🖨 На печать</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <input type="date" className="p-2 bg-slate-950 border border-slate-800 rounded outline-none" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
            <select disabled={formData.is_general} className="p-2 bg-slate-950 border border-slate-800 rounded outline-none disabled:opacity-30" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})}>
              <option value="">Лично исполнителю...</option>
              {installers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 p-2 bg-slate-950/50 border border-slate-800 rounded">
            <input type="checkbox" checked={formData.is_general} onChange={e => setFormData({...formData, is_general: e.target.checked})} className="w-5 h-5" />
            <span className="text-sm">Общий заказ (для всех)</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Размеры" className="p-2 bg-slate-950 border border-slate-800 rounded" value={formData.dimensions} onChange={e => setFormData({...formData, dimensions: e.target.value})} />
            <input placeholder="Материал" className="p-2 bg-slate-950 border border-slate-800 rounded" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} />
          </div>

          <input placeholder="Ссылка на макет" className="w-full p-2 bg-slate-950 border border-slate-800 rounded" value={formData.source_link} onChange={e => setFormData({...formData, source_link: e.target.value})} />
          <textarea placeholder="Задача..." rows={3} className="w-full p-2 bg-slate-950 border border-slate-800 rounded outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>

        <div className="pt-4 mt-auto">
          <button type="submit" disabled={loading} className="w-full bg-blue-600 p-3 rounded font-bold uppercase hover:bg-blue-700">
            {loading ? 'Секунду...' : 'Запустить в работу'}
          </button>
        </div>
      </form>
    </div>
  );
}