"use client";

import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AppNotification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { playNotificationSound } from '@/lib/utils';

interface NotificationCenterProps {
  currentUserId?: string;
  role?: string;
}

export function NotificationCenter({ currentUserId, role }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { toast } = useToast();
  const isAdmin = role === 'admin';

  // 1. ЗАГРУЖАЕМ УВЕДОМЛЕНИЯ ИЗ ПАМЯТИ ПРИ ВХОДЕ (Переживает F5)
  useEffect(() => {
    if (currentUserId) {
      const saved = localStorage.getItem(`notifications_${currentUserId}`);
      if (saved) {
        try {
          setNotifications(JSON.parse(saved));
        } catch (e) {
          console.error('Ошибка чтения уведомлений');
        }
      }
    }
  }, [currentUserId]);

  // 2. СОХРАНЯЕМ В ПАМЯТЬ ПРИ КАЖДОМ ИЗМЕНЕНИИ
  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(`notifications_${currentUserId}`, JSON.stringify(notifications));
    }
  }, [notifications, currentUserId]);

  // 3. СЛУШАЕМ БАЗУ ДАННЫХ ПО СЕТИ
  useEffect(() => {
    if (!currentUserId) return;

    // Функция, которая создает уведомление, закидывает в колокольчик и выдает звук
    const pushNotification = (title: string, message: string) => {
      const newNotif: AppNotification = {
        id: `notif-${Date.now()}-${Math.random()}`,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false,
      };
      
      setNotifications(prev => [newNotif, ...prev]);
      toast({ title, description: message });
      playNotificationSound();
    };

    const channel = supabase
      .channel(`bell-system-${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
        const newOrder = payload.new;
        // Если админ или назначено на этого пользователя (или общий)
        if (isAdmin || newOrder.assigned_to === currentUserId || newOrder.assigned_to === null) {
          pushNotification('Новый заказ', `Добавлен объект: ${newOrder.title || 'Без названия'}`);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
        const newOrder = payload.new;
        const isGeneral = newOrder.assigned_to === null || newOrder.assigned_to === 'general';
        const isMine = newOrder.assigned_to === currentUserId;

        if (isAdmin) {
          pushNotification('Обновление (Админ)', `Объект "${newOrder.title || 'Без названия'}" обновлен. Текущий статус: ${newOrder.status}`);
        } else if (isMine || isGeneral) {
          pushNotification('Обновление объекта', `Изменения по вашему объекту "${newOrder.title || 'Без названия'}". Статус: ${newOrder.status}`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, isAdmin, toast]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const clearAll = () => setNotifications([]);
  const markAsRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 text-muted-foreground hover:text-primary transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-[10px] border-2 border-background">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-2xl border-border/50" align="end">
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-secondary/10">
          <h4 className="font-headline font-bold">Уведомления</h4>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={markAllRead} title="Прочитать все"><Check className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={clearAll} title="Очистить все"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <ScrollArea className="h-[350px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {notifications.map((notif) => (
                <div key={notif.id} className={cn("p-4 transition-colors cursor-pointer", !notif.read && "bg-primary/5")} onClick={() => markAsRead(notif.id)}>
                  <div className="flex gap-3">
                    <div className="mt-1 w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0"><Info className="w-4 h-4 text-primary" /></div>
                    <div className="space-y-1">
                      <p className={cn("text-sm font-semibold leading-none", !notif.read && "text-primary")}>{notif.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/60">{formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ru })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2"><Bell className="w-10 h-10 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">Уведомлений пока нет</p></div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}