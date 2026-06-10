'use client';

import { useEffect, useState, useRef } from 'react';
import Script from 'next/script';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { notifyNewOrderToGroup, notifyOrderToUser } from '@/app/actions/telegram';

export default function OrderMiniPage() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [deadline, setDeadline] = useState('');
    const [department, setDepartment] = useState('installation');
    const [assignedTo, setAssignedTo] = useState('');
    const [isGeneral, setIsGeneral] = useState(true);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    
    const [installers, setInstallers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Стейты для железного определения автора заказа
    const [creatorName, setCreatorName] = useState('Неизвестный пользователь');
    const [creatorTgId, setCreatorTgId] = useState('');
    const [creatorUuid, setCreatorUuid] = useState('');
    
    const submitRef = useRef<() => void>(() => {});

    // ПОЛУЧАЕМ TG_ID ИЗ ССЫЛКИ И СРАЗУ ИЩЕМ АВТОРА В БАЗЕ
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const params = new URLSearchParams(window.location.search);
        const tgId = params.get('tg_id');
        
        if (tgId) {
            async function loadCreatorProfile() {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name, name')
                    .eq('telegram_chat_id', tgId)
                    .limit(1)
                    .maybeSingle();
                
                if (data) {
                    setCreatorName(data.full_name || data.name || 'Сотрудник');
                    setCreatorTgId(tgId);
                    setCreatorUuid(data.id); // UUID из базы
                }
            }
            loadCreatorProfile();
        }
    }, []);

    // Загружаем список сотрудников для выпадающего списка
    useEffect(() => {
        async function loadProfiles() {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, telegram_chat_id')
                .in('role', ['installer', 'admin']);
            if (data) setInstallers(data);
        }
        loadProfiles();
    }, []);

    // Инициализация интерфейса ТГ
    useEffect(() => {
        const syncTelegramSDK = () => {
            const tg = window.Telegram?.WebApp;
            if (tg) {
                tg.ready(); 
                tg.expand();
                clearInterval(interval);
            }
        };
        const interval = setInterval(syncTelegramSDK, 300);
        syncTelegramSDK();
        return () => clearInterval(interval);
    }, []);

    // Клик на главную кнопку
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.MainButton.text = "СОЗДАТЬ И ОПОВЕСТИТЬ";
            tg.MainButton.show();
            
            const handleMainButtonClick = () => submitRef.current();
            tg.MainButton.onClick(handleMainButtonClick);
            
            return () => tg.MainButton.offClick(handleMainButtonClick);
        }
    }, []);

    // Управление доступностью кнопки
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        if (!title || !deadline || uploading || loading) {
            tg.MainButton.disable();
            tg.MainButton.color = tg.themeParams.hint_color || "#999999";
        } else {
            tg.MainButton.enable();
            tg.MainButton.color = tg.themeParams.button_color || "#2481cc";
        }
    }, [title, deadline, uploading, loading]);

    // Логика сабмита формы
    useEffect(() => {
        submitRef.current = async () => {
            if (!title || !deadline || uploading || loading) return;
            
            const tg = window.Telegram?.WebApp;
            if (tg) tg.MainButton.showProgress();
            setLoading(true);

            try {
                const payload = {
                    title,
                    description,
                    deadline,
                    status: 'new',
                    is_general: isGeneral,
                    department,
                    assigned_to: isGeneral ? null : (assignedTo || null),
                    image_urls: imageUrls,
                    created_by: creatorUuid || null, // ТЕПЕРЬ НА САЙТЕ АВТОР БУДЕТ ВЫСВЕЧИВАТЬСЯ ПРАВИЛЬНО
                };

                const { error } = await supabase.from('orders').insert([payload]);
                if (error) throw error;

                // ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ С ГАРАНТИРОВАННЫМ ИМЕНЕМ ИЗ БАЗЫ
                try {
                    await notifyNewOrderToGroup({
                        title,
                        description,
                        department,
                        deadline,
                        is_general: isGeneral,
                        assigned_to: isGeneral ? null : assignedTo,
                        image_urls: imageUrls,
                        creator_id: creatorTgId || undefined,
                        creator_full_name: creatorName, 
                    });
                } catch (notifyError) {
                    console.error('Ошибка уведомления в группу Telegram:', notifyError);
                }

                if (!isGeneral && assignedTo) {
                    const user = installers.find(i => i.id === assignedTo);
                    if (user && user.telegram_chat_id) {
                        try {
                            await notifyOrderToUser(user.telegram_chat_id, title);
                        } catch (personalNotifyError) {
                            console.error('Ошибка личного уведомления исполнителю:', personalNotifyError);
                        }
                    }
                }

                if (tg) {
                    tg.MainButton.hideProgress();
                    tg.MainButton.setText("ГОТОВО!");
                }

                setTimeout(() => {
                    if (tg) tg.close();
                }, 500);

            } catch (err) {
                console.error(err);
                if (tg) {
                    tg.MainButton.hideProgress();
                    tg.MainButton.showAlert('Ошибка при сохранении в базу');
                }
            } finally {
                setLoading(false);
            }
        };
    }, [title, description, deadline, department, assignedTo, isGeneral, imageUrls, uploading, installers, loading, creatorName, creatorTgId, creatorUuid]);

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

    const handleImageUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        
        const tg = window.Telegram?.WebApp;

        // ВАЛИДАЦИЯ ФОРМАТОВ ФАЙЛОВ ПРИ ЗАГРУЗКЕ
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (isPdf || !file.type.startsWith('image/')) {
                if (tg) {
                    tg.showAlert('Файлы документов и PDF не поддерживаются! Загружайте строго картинки (jpeg, png, webp).');
                } else {
                    alert('Файлы документов и PDF не поддерживаются! Загружайте строго картинки (jpeg, png, webp).');
                }
                return;
            }
        }

        setUploading(true);
        if (tg) tg.MainButton.showProgress();

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

        setImageUrls(prev => [...prev, ...newUrls]);
        setUploading(false);
        if (tg) tg.MainButton.hideProgress();
    };

    // ФУНКЦИЯ УДАЛЕНИЯ КАРТИНКИ ИЗ МАССИВА
    const handleDeleteImage = (indexToDelete: number) => {
        setImageUrls(prev => prev.filter((_, idx) => idx !== indexToDelete));
    };

    const inputStyle = {
        width: '100%',
        padding: '12px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
        color: 'var(--tg-theme-text-color, #000000)',
        outline: 'none',
        boxSizing: 'border-box' as const,
        marginBottom: '16px'
    };
    const labelStyle = {
        display: 'block',
        marginBottom: '6px',
        fontSize: '13px',
        fontWeight: 'bold',
        color: 'var(--tg-theme-hint-color, #999999)',
        textTransform: 'uppercase' as const
    };

    return (
        <>
            <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

            <div style={{
                backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
                color: 'var(--tg-theme-text-color, #000000)',
                minHeight: '100vh',
                padding: '20px',
                fontFamily: 'sans-serif',
                paddingBottom: '80px'
            }}>
                <label style={labelStyle}>Объект *</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Название..." style={inputStyle} />

                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Отдел</label>
                        <select value={department} onChange={e => setDepartment(e.target.value)} style={inputStyle}>
                            <option value="installation">🛠 Монтаж</option>
                            <option value="print">🖨 Печать</option>
                            <option value="production">🏭 Изготовление</option>
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Дедлайн *</label>
                        <input type="date" required value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
                    </div>
                </div>

                <label style={labelStyle}>Описание</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Детали задачи..." style={{ ...inputStyle, resize: 'none' }} />

                <div style={{
                    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                    padding: '12px',
                    borderRadius: '10px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <input type="checkbox" checked={isGeneral} onChange={e => setIsGeneral(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Общий заказ (для всех)</span>
                </div>

                {!isGeneral && (
                    <div>
                        <label style={labelStyle}>Лично исполнителю</label>
                        <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={inputStyle}>
                            <option value="">Выберите сотрудника...</option>
                            {installers.map(i => (
                                <option key={i.id} value={i.id}>{i.full_name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label style={labelStyle}>Фото / Эскиз {uploading && '(Загрузка...)'}</label>
                    {/* Жесткий фильтр на форматы в проводнике */}
                    <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp" 
                        multiple 
                        onChange={e => handleImageUpload(e.target.files)} 
                        style={{ ...inputStyle, padding: '8px' }} 
                        disabled={uploading} 
                    />
                    
                    {imageUrls.length > 0 && (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            {imageUrls.map((url, idx) => (
                                <div key={idx} style={{ position: 'relative', width: '64px', height: '64px' }}>
                                    <img 
                                        src={url} 
                                        alt="Превью" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} 
                                    />
                                    {/* Кнопка удаления поверх изображения */}
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteImage(idx)}
                                        style={{
                                            position: 'absolute',
                                            top: '-6px',
                                            right: '-6px',
                                            backgroundColor: '#ff3b30',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '18px',
                                            height: '18px',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                            padding: 0,
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}