'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Настройки
const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN; 
const GROUP_ID = process.env.NEXT_PUBLIC_TELEGRAM_GROUP_CHAT_ID;

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
    
    const mainButtonCallback = useRef<(() => void) | null>(null);

    // Загружаем профили сотрудников при открытии
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

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-web-app.js';
        script.async = true;
        document.body.appendChild(script);

        script.onload = () => {
            const tg = window.Telegram?.WebApp;
            if (tg) {
                tg.expand();
                tg.MainButton.text = "СОЗДАТЬ И ОПОВЕСТИТЬ";
                tg.MainButton.show();
            }
        };

        return () => {
            if (window.Telegram?.WebApp && mainButtonCallback.current) {
                window.Telegram.WebApp.MainButton.offClick(mainButtonCallback.current);
            }
        };
    }, []);

    // Обработчик загрузки картинок
    const handleImageUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        const tg = window.Telegram?.WebApp;
        if (tg) tg.MainButton.showProgress();

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

        setImageUrls(prev => [...prev, ...newUrls]);
        setUploading(false);
        if (tg) tg.MainButton.hideProgress();
    };

    // Логика кнопки "Отправить"
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        if (mainButtonCallback.current) {
            tg.MainButton.offClick(mainButtonCallback.current);
        }

        // Блокируем кнопку, если нет названия, дедлайна или идет загрузка картинки
        if (!title || !deadline || uploading) {
            tg.MainButton.disable();
            tg.MainButton.color = tg.themeParams.hint_color || "#999999";
        } else {
            tg.MainButton.enable();
            tg.MainButton.color = tg.themeParams.button_color || "#2481cc";
        }

        const submitData = async () => {
            if (!title || !deadline || uploading) return;
            tg.MainButton.showProgress();
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
                    image_urls: imageUrls
                };

                const { error } = await supabase.from('orders').insert([payload]);
                if (error) throw error;

                // УВЕДОМЛЕНИЯ В ТЕЛЕГРАМ
                if (BOT_TOKEN) {
                    // 1. Если личный заказ — шлем исполнителю
                    if (!isGeneral && assignedTo) {
                        const user = installers.find(i => i.id === assignedTo);
                        if (user && user.telegram_chat_id) {
                            const personalText = `🔔 <b>ЛИЧНЫЙ ЗАКАЗ!</b>\n\nТебе назначили новый объект: <b>${title}</b>\n\nЗайди в раздел «📦 Мои заказы», чтобы посмотреть.`;
                            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: user.telegram_chat_id, text: personalText, parse_mode: 'HTML' })
                            });
                        }
                    }

                    // 2. Всегда шлем в общую группу для истории
                    let groupText = `🔥 <b>НОВЫЙ ЗАКАЗ (Mini App)</b>\n\n📍 Объект: <b>${title}</b>\n📅 Срок: ${deadline}\n🏢 Отдел: ${department === 'installation' ? '🛠 Монтаж' : department === 'production' ? '🏭 Изготовление' : '🖨 Печать'}`;
                    groupText += `\n👤 Кому: ${isGeneral ? '🌍 Общий заказ' : (installers.find(i => i.id === assignedTo)?.full_name || 'Не назначен')}`;
                    if (description) groupText += `\n📝 Описание: ${description}`;

                    if (GROUP_ID) {
                      const hasPhoto = imageUrls.length > 0;
                      const body = hasPhoto
                        ? {
                            chat_id: GROUP_ID,
                            photo: imageUrls[0],
                            caption: groupText,
                            parse_mode: 'HTML',
                          }
                        : {
                            chat_id: GROUP_ID,
                            text: groupText,
                            parse_mode: 'HTML',
                            disable_web_page_preview: true,
                          };

                      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${hasPhoto ? 'sendPhoto' : 'sendMessage'}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                      });
                    }
                }

                tg.showPopup({
                    title: 'Успешно',
                    message: 'Объект добавлен в базу!',
                    buttons: [{ type: 'ok' }]
                }, () => tg.close());

            } catch (err) {
                tg.showAlert('Ошибка при сохранении в базу');
            } finally {
                tg.MainButton.hideProgress();
                setLoading(false);
            }
        };

        mainButtonCallback.current = submitData;
        tg.MainButton.onClick(submitData);

    }, [title, description, deadline, department, assignedTo, isGeneral, imageUrls, uploading, installers]);

    // Общие стили для полей (нативные из Telegram)
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
        <div style={{
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            color: 'var(--tg-theme-text-color, #000000)',
            minHeight: '100vh',
            padding: '20px',
            fontFamily: 'sans-serif',
            paddingBottom: '80px' // Отступ для нижней кнопки
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
                <input 
                    type="checkbox" 
                    checked={isGeneral} 
                    onChange={e => setIsGeneral(e.target.checked)} 
                    style={{ width: '20px', height: '20px' }} 
                />
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
                <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={e => handleImageUpload(e.target.files)} 
                    style={{ ...inputStyle, padding: '8px' }} 
                    disabled={uploading}
                />
                
                {/* Превью загруженных картинок */}
                {imageUrls.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {imageUrls.map((url, idx) => (
                            <img key={idx} src={url} alt="Превью" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}