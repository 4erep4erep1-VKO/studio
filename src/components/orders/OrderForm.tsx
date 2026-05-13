'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { notifyNewOrderToGroup, notifyOrderToUser } from '@/app/actions/telegram';
import { useRouter } from 'next/navigation';

interface OrderFormProps {
  orderId: string | null;
  onSave: () => void;
  creatorId: string;
}

export default function OrderForm({ orderId, onSave, creatorId }: OrderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [installers, setInstallers] = useState<any[]>([]);
  const initialFormState = {
    title: '',
    description: '',
    deadline: '',
    assigned_to: '',
    is_general: true,
    image_urls: [] as string[],
    source_link: '',
    dimensions: '',
    material: '',
    department: 'installation'
  };
  const [formData, setFormData] = useState(initialFormState);
  const [initialData, setInitialData] = useState<typeof initialFormState | null>(null);

  const normalizeFormValues = (data: typeof initialFormState) => ({
    ...data,
    deadline: data.deadline || null,
    assigned_to: data.is_general ? null : (data.assigned_to || null)
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
          const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
          if (order) {
            const loadedData = {
              title: order.title ?? '',
              description: order.description ?? '',
              deadline: order.deadline ? String(order.deadline).split('T')[0] : '',
              assigned_to: order.assigned_to ?? '',
              is_general: order.is_general ?? true,
              image_urls: order.image_urls || [],
              source_link: order.source_link ?? '',
              dimensions: order.dimensions ?? '',
              material: order.material ?? '',
              department: order.department ?? 'installation'
            };

            setFormData(loadedData);
            setInitialData(loadedData);
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

    const currentData = normalizeFormValues(formData);
    let payload: Record<string, any> = {};

    if (orderId && initialData) {
      const initialNormalized = normalizeFormValues(initialData);
      payload = Object.entries(currentData).reduce((acc, [key, value]) => {
        const initialValue = (initialNormalized as any)[key];
        const changed = Array.isArray(value) && Array.isArray(initialValue)
          ? JSON.stringify(value) !== JSON.stringify(initialValue)
          : value !== initialValue;

        if (changed) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);
    } else if (orderId) {
      payload = currentData;
    } else {
      payload = {
        ...currentData,
        created_by: creatorId
      };
    }

    if (orderId && Object.keys(payload).length === 0) {
      setLoading(false);
      onSave();
      return;
    }

    const { error } = orderId 
      ? await supabase.from('orders').update(payload).eq('id', orderId)
      : await supabase.from('orders').insert([payload]);

    if (!error) {
      // Отправляем уведомления только для новых заказов
      if (!orderId) {
        try {
          await notifyNewOrderToGroup({
            title: formData.title,
            description: formData.description,
            department: formData.department,
            deadline: formData.deadline,
            is_general: formData.is_general,
            dimensions: formData.dimensions,
            material: formData.material,
            source_link: formData.source_link,
          });
        } catch (err: any) {
          console.error('Ошибка Telegram:', err);
          alert('Заказ создан, но в Телеграм не улетел. Проверь ключи на Vercel!');
        }
      }

      // Личное уведомление исполнителю
      if (!orderId && !formData.is_general && formData.assigned_to) {
        const assignedUser = installers.find(i => i.id === formData.assigned_to);
        if (assignedUser && assignedUser.telegram_chat_id) {
          try {
            await notifyOrderToUser(assignedUser.telegram_chat_id, formData.title);
          } catch (err) {
            console.error('Ошибка личного уведомления:', err);
          }
        }
      }

      router.refresh(); // Принудительно обновляем данные на странице (чтобы перекинулись отделы)
      onSave();
    } else {
      alert('Ошибка базы: ' + error.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-card text-foreground overflow-hidden p-6" onPaste={handlePaste}>
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        
        <div className="flex-grow overflow-y-auto space-y-5 pr-2 custom-scrollbar" style={{ maxHeight: '70vh' }}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Объект</label>
              <input required className="w-full p-2 bg-background text-foreground placeholder:text-muted-foreground border border-border rounded focus:border-primary outline-none transition" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Куда отправить</label>
              <select className="w-full p-2 bg-background text-foreground border border-border rounded focus:border-primary outline-none transition" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                <option value="installation">🛠 На монтаж</option>
                <option value="print">🖨 На печать</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Дедлайн</label>
              <input type="date" className="w-full p-2 bg-background text-foreground border border-border rounded focus:border-primary outline-none transition" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Лично исполнителю</label>
              <select disabled={formData.is_general} className="w-full p-2 bg-background text-foreground border border-border rounded focus:border-primary outline-none transition disabled:opacity-30" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})}>
                <option value="">Не назначен...</option>
                {installers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 border border-border bg-background/50 rounded cursor-pointer" onClick={() => setFormData({...formData, is_general: !formData.is_general})}>
            <input type="checkbox" checked={formData.is_general} readOnly className="w-5 h-5 accent-primary" />
            <label className="font-bold text-sm cursor-pointer text-foreground">Общий заказ (увидят все в отделе)</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Размеры (3х6м)" className="w-full p-2 bg-background text-foreground placeholder:text-muted-foreground border border-border rounded focus:border-primary outline-none" value={formData.dimensions} onChange={e => setFormData({...formData, dimensions: e.target.value})} />
            <input placeholder="Материал" className="w-full p-2 bg-background text-foreground placeholder:text-muted-foreground border border-border rounded focus:border-primary outline-none" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Ссылка на макет</label>
            <input placeholder="Облако / Диск" className="w-full p-2 bg-background text-foreground placeholder:text-muted-foreground border border-border rounded focus:border-primary outline-none" value={formData.source_link} onChange={e => setFormData({...formData, source_link: e.target.value})} />
          </div>

          <div>
             <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Эскиз / Фото (Можно Ctrl+V)</label>
             <input type="file" accept="image/*" multiple onChange={e => e.target.files && uploadImages(e.target.files)} className="text-xs w-full text-foreground file:bg-primary file:text-primary-foreground file:border-0 file:rounded file:px-3 file:py-1 cursor-pointer" />
             {formData.image_urls.length > 0 && (
               <div className="flex gap-2 mt-3 flex-wrap">
                 {formData.image_urls.map((url, idx) => (
                   <img key={idx} src={url} alt="Превью" className="w-16 h-16 object-cover rounded border border-border shadow-sm" />
                 ))}
               </div>
             )}
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Задача</label>
            <textarea rows={3} placeholder="Что именно нужно сделать..." className="w-full p-2 bg-background text-foreground placeholder:text-muted-foreground border border-border rounded focus:border-primary outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
        </div>

        <div className="pt-4 mt-auto border-t border-border">
          <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground p-3 rounded font-bold uppercase hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Секунду...' : 'Запустить в работу'}
          </button>
        </div>
      </form>
    </div>
  );
}