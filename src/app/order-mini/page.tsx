'use client';

import { useEffect, useState, useRef } from 'react';
import Script from 'next/script';
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
    
    // Сюда железно сохранится твой профиль из Телеграма
    const [tgUser, setTgUser] = useState<any>(null);
    const submitRef = useRef<() => void>(() => {});

    // Загружаем профили сотрудников из базы
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

    // БУЛЛЕТПРУФ ПОЛЛИНГ ДЛЯ АКТИВАЦИИ TELEGRAM SDK И ЗАХВАТА ПРОФИЛЯ
    useEffect(() => {
        const syncTelegramSDK = () => {
            const tg = window.Telegram?.WebApp;
            if (tg) {
                // ЖЕСТКИЙ ПИНОК ДЛЯ ТЕЛЕГРАМА — БЕЗ ЭТОГО ДАННЫЕ ЮЗЕРА БЛОКИРУЮТСЯ
                tg.ready(); 
                tg.expand();
                
                if (tg.initDataUnsafe?.user && !tgUser) {
                    setTgUser(tg.initDataUnsafe.user);
                    clearInterval(interval);
                }
            }
        };

        const interval = setInterval(syncTelegramSDK, 300);
        syncTelegramSDK();

        return () => clearInterval(interval);
    }, [tgUser]);

    // Управление кнопкой отправки на основе валидации
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
            // Вытаскиваем юзера из стейта поллинга или напрямую из объекта
            const activeUser = tgUser || tg?.initDataUnsafe?.user;
            const tgUserId = activeUser?.id;
            
            const tgFullName = activeUser 
                ? `${activeUser.first_name}${activeUser.last_name ? ' ' + activeUser.last_name : ''}`
                : undefined;
            
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
                };

                const { error } = await supabase.from('orders').insert([payload]);
                if (error) throw error;

                // ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ С ГАРАНТИРОВАННЫМ ИМЕНЕМ ИЗ ТГ
                try {
                    await notifyNewOrderToGroup({
                        title,
                        description,
                        department,
                        deadline,
                        is_general: isGeneral,
                        assigned_to: isGeneral ? null : assignedTo,
                        image_urls: imageUrls,
                        creator_id: tgUserId ? String(tgUserId) : undefined,
                        creator_full_name: tgFullName, 
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
                    tg.showAlert('Ошибка при сохранении в базу');
                }
            } finally {
                setLoading(false);
            }
        };
    }, [title, description, deadline, department, assignedTo, isGeneral, imageUrls, uploading, installers, loading, tgUser]);

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
            {/* ОФИЦИАЛЬНЫЙ НАДЁЖНЫЙ СКРИПТ TELEGRAM MINI APP */}
            <Script 
                src="https://telegram.org/js/telegram-web-app.js" 
                strategy="afterInteractive"
            />

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
                    <input type="file" accept="image/*" multiple onChange={e => handleImageUpload(e.target.files)} style={{ ...inputStyle, padding: '8px' }} disabled={uploading} />
                    {imageUrls.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            {imageUrls.map((url, idx) => (
                                <img key={idx} src={url} alt="Превью" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}