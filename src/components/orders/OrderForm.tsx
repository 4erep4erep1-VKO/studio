'use client';

import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { notifyNewOrderToGroup, notifyOrderToUser, notifyOrderUpdate } from '@/app/actions/telegram';
import { useRouter } from 'next/navigation';

interface OrderFormProps {
  orderId: string | null;
  onSave: () => void;
  creatorId: string;
  editorName?: string;
}

export default function OrderForm({ orderId, onSave, creatorId, editorName }: OrderFormProps) {
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
    assigned_to: data.assigned_to && data.assigned_to.trim() !== "" ? data.assigned_to : null
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
  }, [orderId, creatorId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.Telegram && w.Telegram.WebApp) return;

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
      if (compressedBlob instanceof File) return compressedBlob;
      return new File([compressedBlob], file.name, { type: compressedBlob.type || file.type });
    } catch (err) {
      console.error('Image compression failed:', err);
      return file;
    }
  };

  const uploadImages = async (files: FileList | File[]) => {
    // ВАЛИДАЦИЯ НА ФРОНТЕНДЕ ОТ PDF И НЕ-КАРТИНОК
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf || !file.type.startsWith('image/')) {
        alert('⚠️ Ошибка: Формат PDF и другие документы не поддерживаются! Пожалуйста, загружайте только файлы картинок (jpeg, png, webp).');
        return;
      }
    }

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
        if (data?.publicUrl) newUrls.push(data.publicUrl);
      }
    }
    setFormData(prev => ({ ...prev, image_urls: [...prev.image_urls, ...newUrls] }));
    setLoading(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    // Проверка при Ctrl+V — берем только изображения
    const files = items.filter(i => i.type.includes('image')).map(i => i.getAsFile()).filter((f): f is File => f !== null);
    if (files.length) uploadImages(files);
  };

  // ФУНКЦИЯ ДЛЯ УДАЛЕНИЯ КАРТИНКИ ИЗ ФОРМЫ
  const handleDeleteImage = (indexToDelete: number) => {
    setFormData(prev => ({
      ...prev,
      image_urls: prev.image_urls.filter((_, idx) => idx !== indexToDelete)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (orderId && Object.keys(payload).length > 0) {
        const rawAssigned = formData.assigned_to || initialData?.assigned_to || null;
        const currentAssigned = rawAssigned && rawAssigned.trim() !== "" ? rawAssigned : null;

        try {
          await notifyOrderUpdate(
            orderId, 
            initialData?.title || formData.title, 
            payload, 
            editorName || 'Сотрудник', 
            currentAssigned
          );
        } catch (err) {
          console.error('Ошибка уведомления об изменении заказа:', err);
        }
      }

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
            creator_id: creatorId,
          });
        } catch (err: any) {
          console.error('Ошибка Telegram:', err);
          alert('Заказ создан, но в Телеграм не улетел.');
        }
      }

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

      router.refresh();
      onSave();
      try {
        if (typeof window !== 'undefined') {
          const w = window as any;
          if (w?.Telegram?.WebApp && typeof w.Telegram.WebApp.close === 'function') {
            w.Telegram.WebApp.close();
          }
        }
      } catch (e) { console.warn('Telegram WebApp close failed', e); }
    } else {
      alert('Ошибка базы: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0f1011] p-6 text-[#d0d6e0]" onPaste={handlePaste}>
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex-grow overflow-y-auto space-y-5 pr-2 custom-scrollbar" style={{ maxHeight: '70vh' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-normal uppercase text-[#8a8f98]">Объект</label>
              <input required className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none transition placeholder:text-[#8a8f98] focus:border-[#C62828]" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-normal uppercase text-[#8a8f98]">Куда отправить</label>
              <select className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none transition focus:border-[#C62828]" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                <option value="installation">🛠 На монтаж</option>
                <option value="print">🖨 На печать</option>
                <option value="production">🏭 Изготовление</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-normal uppercase text-[#8a8f98]">Дедлайн</label>
              <input type="date" className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none transition focus:border-[#C62828]" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-normal uppercase text-[#8a8f98]">Лично исполнителю</label>
              <select disabled={formData.is_general} className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none transition focus:border-[#C62828] disabled:opacity-30" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})}>
                <option value="">Не назначен...</option>
                {installers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[#23252a] bg-[#08090a] p-3">
              <input type="checkbox" checked={formData.is_general} onChange={e => setFormData({...formData, is_general: e.target.checked})} className="h-5 w-5 accent-[#C62828]" />
              <span className="cursor-pointer text-sm font-medium text-[#d0d6e0]">Общий заказ (увидят все в отделе)</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Размеры (3х6м)" className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none placeholder:text-[#8a8f98] focus:border-[#C62828]" value={formData.dimensions} onChange={e => setFormData({...formData, dimensions: e.target.value})} />
            <input placeholder="Материал" className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none placeholder:text-[#8a8f98] focus:border-[#C62828]" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-normal uppercase text-[#8a8f98]">Ссылка на макет</label>
            <input placeholder="Облако / Диск" className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none placeholder:text-[#8a8f98] focus:border-[#C62828]" value={formData.source_link} onChange={e => setFormData({...formData, source_link: e.target.value})} />
          </div>

          <div>
             <label className="mb-1 block text-xs font-normal uppercase text-[#8a8f98]">Эскиз / Фото (Можно Ctrl+V)</label>
             {/* Обновленный жесткий фильтр по форматам */}
             <input 
               type="file" 
               accept="image/jpeg,image/png,image/webp" 
               multiple 
               onChange={e => e.target.files && uploadImages(e.target.files)} 
               className="w-full cursor-pointer text-xs text-[#d0d6e0] file:rounded-md file:border-0 file:bg-[#C62828] file:px-3 file:py-1 file:text-white"
             />
             
             {formData.image_urls.length > 0 && (
               <div className="flex gap-3 mt-3 flex-wrap">
                 {formData.image_urls.map((url, idx) => (
                   <div key={idx} className="relative w-16 h-16 group">
                     <img src={url} alt="Превью" className="h-full w-full rounded-md border border-[#23252a] object-cover" />
                     {/* Иконка удаления поверх картинки при правках */}
                     <button
                       type="button"
                       onClick={() => handleDeleteImage(idx)}
                       className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-md border border-[#23252a] bg-[#C62828] text-[10px] font-normal text-white transition-transform hover:bg-red-800 group-hover:scale-110"
                       title="Удалить картинку"
                     >
                       ×
                     </button>
                   </div>
                 ))}
               </div>
             )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-normal uppercase text-[#8a8f98]">Задача</label>
            <textarea rows={3} placeholder="Что именно нужно сделать..." className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none placeholder:text-[#8a8f98] focus:border-[#C62828]" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
        </div>

        <div className="pt-4 mt-auto border-t border-border">
          <button type="submit" disabled={loading} className="w-full rounded-md bg-[#C62828] p-3 font-medium uppercase text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Секунду...' : 'Запустить в работу'}
          </button>
        </div>
      </form>
    </div>
  );
}