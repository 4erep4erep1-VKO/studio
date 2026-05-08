'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Настройки уведомлений
const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN; 
const GROUP_ID = "-1003935954352";

export default function OrderMiniPage() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [deadline, setDeadline] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Реф, чтобы не вешать слушатель клика дважды
    const mainButtonCallback = useRef<(() => void) | null>(null);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-web-app.js';
        script.async = true;
        document.body.appendChild(script);

        script.onload = () => {
            const tg = window.Telegram?.WebApp;
            if (tg) {
                tg.expand(); // Разворачиваем на весь экран
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

    // Обновляем логику Главной кнопки при изменении данных
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        // Удаляем старый слушатель, если был
        if (mainButtonCallback.current) {
            tg.MainButton.offClick(mainButtonCallback.current);
        }

        // Если форма не заполнена - прячем или дизейблим кнопку
        if (!title || !deadline) {
            tg.MainButton.disable();
            tg.MainButton.color = tg.themeParams.hint_color || "#999999";
        } else {
            tg.MainButton.enable();
            tg.MainButton.color = tg.themeParams.button_color || "#2481cc";
        }

        // Новая функция отправки
        const submitData = async () => {
            if (!title || !deadline) return;
            tg.MainButton.showProgress();
            setLoading(true);

            try {
                const { error } = await supabase
                    .from('orders')
                    .insert([{ 
                        title, 
                        description, 
                        deadline, 
                        status: 'new',
                        is_general: true,
                        department: 'installation' 
                    }]);

                if (error) throw error;

                // Уведомление в группу
                if (BOT_TOKEN) {
                    const text = `🔥 <b>НОВЫЙ ЗАКАЗ (из Web App)</b>\n\n📍 Объект: <b>${title}</b>\n📅 Срок: ${deadline}\n📝 Задача: ${description || 'без описания'}`;
                    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: GROUP_ID, text: text, parse_mode: 'HTML' })
                    });
                }

                tg.showPopup({
                    title: 'Успешно',
                    message: 'Объект добавлен в базу и отправлен в группу!',
                    buttons: [{ type: 'ok' }]
                }, () => {
                    tg.close();
                });
            } catch (err) {
                tg.showAlert('Ошибка при сохранении в базу');
            } finally {
                tg.MainButton.hideProgress();
                setLoading(false);
            }
        };

        mainButtonCallback.current = submitData;
        tg.MainButton.onClick(submitData);

    }, [title, description, deadline]);

    return (
        <div style={{
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            color: 'var(--tg-theme-text-color, #000000)',
            minHeight: '100vh',
            padding: '20px',
            fontFamily: 'sans-serif'
        }}>
            <h1 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                marginBottom: '20px',
                color: 'var(--tg-theme-text-color, #000000)'
            }}>Новый заказ</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: 'var(--tg-theme-hint-color, #999999)' }}>
                        Название объекта *
                    </label>
                    <input 
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Световой короб..."
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                            color: 'var(--tg-theme-text-color, #000000)',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: 'var(--tg-theme-hint-color, #999999)' }}>
                        Описание
                    </label>
                    <textarea 
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Что нужно сделать..."
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                            color: 'var(--tg-theme-text-color, #000000)',
                            outline: 'none',
                            boxSizing: 'border-box',
                            resize: 'none'
                        }}
                    />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: 'var(--tg-theme-hint-color, #999999)' }}>
                        Дедлайн *
                    </label>
                    <input 
                        type="date"
                        required
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                            color: 'var(--tg-theme-text-color, #000000)',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>
            </div>
            
            {/* Обычную кнопку убрали, так как теперь работает нативная внизу экрана */}
        </div>
    );
}