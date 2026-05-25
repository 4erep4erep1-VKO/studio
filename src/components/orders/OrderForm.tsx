'use client';

import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
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
    is_measurement: false,
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

        let installersData: any[] = inst ?? [];
        if (creatorId && !installersData.some(i => i.id === creatorId)) {
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('id, full_name, telegram_chat_id')
            .eq('id', creatorId)
            .single();
          if (creatorProfile) installersData.push(creatorProfile);
        }

        setInstallers(installersData);

        if (orderId) {
          const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
          if (order) {
            const loadedData = {
              title: order.title ?? '',
              description: order.description ?? '',
              deadline: order.deadline ? String(order.deadline).split('T')[0] : '',
              assigned_to: order.assigned_to ?? '',
              is_general: order.is_general ?? true,
              is_measurement: order.is_measurement ?? false,
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

  // Ensure Telegram WebApp script is available when this form is opened inside Telegram Mini App
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.Telegram && w.Telegram.WebApp) return; // already present

    const scriptId = 'telegram-web-app-script';
    if (document.getElementById(scriptId)) return;

    const s = document.createElement('script');
    s.id = scriptId;
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.async = true;
    document.head.appendChild(s);

    return () => {
      try { document.head.removeChild(s); } catch (e) { /* ignore */ }
    };
  }, []);

  const compressImageFile = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;

    try {
      const compressedBlob = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: file.type,
      });

      if (compressedBlob instanceof File) {
        return compressedBlob;
      }

      return new File([compressedBlob], file.name, { type: compressedBlob.type || file.type });
    } catch (err) {
      console.error('Image compression failed:', err);
      return file;
    }
  };

  const uploadImages = async (files: FileList | File[]) => {
    setLoading(true);
    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const optimizedFile = await compressImageFile(file);
      const ext = optimizedFile.name.split('.').pop()?.toLowerCase() || file.type.split('/')[1] || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `previews/${fileName}`;

      const { error } = await supabase.storage.from('order-photos').upload(filePath, optimizedFile);
      if (!error) {
        const { data } = supabase.storage.from('order-photos').getPublicUrl(filePath);
        if (data?.publicUrl) {
          newUrls.push(data.publicUrl);
        }
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
    
    // Проверка: если создатель не определен, не создаем заказ
    if (!creatorId) {
      alert('❌ Ошибка: Пользователь не авторизован. Пожалуйста, пройдите вход в систему.');
      return;
    }
    
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
      // Для нового заказа обязательно добавляем created_by и начальный статус
      payload = {
        ...currentData,
        created_by: creatorId,
        status: 'new',
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
            image_urls: formData.image_urls,
            creator_id: creatorId, // Передаем ID создателя
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
      // Если форма открыта внутри Telegram Mini App — закрываем окно
      try {
        if (typeof window !== 'undefined') {
          const w = window as any;
          if (w?.Telegram?.WebApp && typeof w.Telegram.WebApp.close === 'function') {
            w.Telegram.WebApp.close();
          }
        }
      } catch (e) {
        console.warn('Telegram WebApp close failed', e);
      }
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
                <option value="production">🏭 Изготовление</option>
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-3">
            <label className="flex items-center gap-2 p-3 border border-border bg-background/50 rounded cursor-pointer">
              <input type="checkbox" checked={formData.is_general} onChange={e => setFormData({...formData, is_general: e.target.checked})} className="w-5 h-5 accent-primary" />
              <span className="font-bold text-sm cursor-pointer text-foreground">Общий заказ (увидят все в отделе)</span>
            </label>

            <label className="flex items-center gap-2 p-3 border border-border bg-background/50 rounded cursor-pointer">
              <input type="checkbox" checked={formData.is_measurement} onChange={e => setFormData({...formData, is_measurement: e.target.checked})} className="w-5 h-5 accent-primary" />
              <span className="font-bold text-sm cursor-pointer text-foreground">Это замер?</span>
            </label>
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