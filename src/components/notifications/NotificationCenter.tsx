
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AppNotification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface NotificationCenterProps {
  currentUserId?: string;
}

// Базовый звук уведомления (короткий бип)
const BEEP_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTdvT18AZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==";

export function NotificationCenter({ currentUserId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const prevCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    }
  }, []);

  useEffect(() => {
    const load = () => {
      const stored = localStorage.getItem('local_notifications');
      if (stored && currentUserId) {
        const all: AppNotification[] = JSON.parse(stored);
        const filtered = all.filter(n => n.userId === currentUserId);
        
        // Звуковое сопровождение при новых уведомлениях
        const prefs = JSON.parse(localStorage.getItem('local_preferences') || '{}');
        if (filtered.length > prevCountRef.current && prefs.notificationsEnabled) {
          audioRef.current?.play().catch(() => {
            // Браузер может блокировать автовоспроизведение без взаимодействия
            console.log('Audio playback blocked');
          });
        }
        
        prevCountRef.current = filtered.length;
        setNotifications(filtered);
      }
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, [currentUserId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const stored = localStorage.getItem('local_notifications');
    if (!stored || !currentUserId) return;
    const all: AppNotification[] = JSON.parse(stored);
    const updated = all.map(n => n.userId === currentUserId ? { ...n, read: true } : n);
    localStorage.setItem('local_notifications', JSON.stringify(updated));
    setNotifications(updated.filter(n => n.userId === currentUserId));
    window.dispatchEvent(new Event('storage'));
  };

  const clearAll = () => {
    const stored = localStorage.getItem('local_notifications');
    if (!stored || !currentUserId) return;
    const all: AppNotification[] = JSON.parse(stored);
    const updated = all.filter(n => n.userId !== currentUserId);
    localStorage.setItem('local_notifications', JSON.stringify(updated));
    setNotifications([]);
    window.dispatchEvent(new Event('storage'));
  };

  const markAsRead = (id: string) => {
    const stored = localStorage.getItem('local_notifications');
    if (!stored) return;
    const all: AppNotification[] = JSON.parse(stored);
    const updated = all.map(n => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem('local_notifications', JSON.stringify(updated));
    setNotifications(updated.filter(n => n.userId === currentUserId));
    window.dispatchEvent(new Event('storage'));
  };

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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={markAllRead} title="Прочитать все">
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={clearAll} title="Очистить все">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[350px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={cn("p-4 transition-colors cursor-pointer", !notif.read && "bg-primary/5")}
                  onClick={() => markAsRead(notif.id)}
                >
                  <div className="flex gap-3">
                    <div className="mt-1 w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <Info className="w-4 h-4 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className={cn("text-sm font-semibold leading-none", !notif.read && "text-primary")}>{notif.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ru })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Уведомлений пока нет</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
