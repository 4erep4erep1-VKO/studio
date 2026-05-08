'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Твои настройки (замени на реальные, если они другие)
const BOT_TOKEN = "ТВОЙ_ТОКЕН_БОТА"; 
const GROUP_ID = "-1003935954352";

export default function OrderMiniPage() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [deadline, setDeadline] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-web-app.js';
        script.async = true;
        document.body.appendChild(script);
    }, []);

    const sendTelegramNotify = async (orderTitle: string) => {
        const text = `🔥 **НОВЫЙ ЗАКАЗ**\n\n📍 Объект: ${orderTitle}\n📅 Срок: ${deadline}\n📝 Описание: ${description}`;
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: GROUP_ID,
                    text: text,
                    parse_mode: 'Markdown'
                })
            });
        } catch (e) {
            console.error('Ошибка уведомления в группу', e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase
                .from('orders')
                .insert([{ title, description, deadline, status: 'pending' }]);

            if (error) throw error;

            await sendTelegramNotify(title);

            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.showPopup({
                    title: 'Успешно',
                    message: 'Заказ создан и отправлен в группу!',
                    buttons: [{ type: 'ok' }]
                });
                window.Telegram.WebApp.close();
            }
        } catch (err) {
            alert('Ошибка при сохранении в базу');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-4">
            <h1 className="text-xl font-bold mb-6 font-headline">Новый заказ</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium">Название объекта</label>
                    <input 
                        required
                        className="w-full p-3 rounded-lg border bg-card"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Напр: Световой короб"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">Описание</label>
                    <textarea 
                        className="w-full p-3 rounded-lg border bg-card"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Что именно сделать?"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">Дедлайн</label>
                    <input 
                        type="date"
                        required
                        className="w-full p-3 rounded-lg border bg-card"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                    />
                </div>
                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground p-4 rounded-xl font-bold active:scale-95 transition mt-4"
                >
                    {loading ? 'Загрузка...' : 'СОЗДАТЬ И ОПОВЕСТИТЬ'}
                </button>
            </form>
        </div>
    );
}