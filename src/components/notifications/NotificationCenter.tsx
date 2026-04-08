
"use client";

import React, { useState } from 'react';
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

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Новый заказ',
      message: 'Вам назначен объект "ТЦ Авиапарк"',
      time: '5 мин назад',
      read: false
    },
    {
      id: '2',
      title: 'Срок истекает',
      message: 'Объект "Метрополис" должен быть завершен завтра',
      time: '2 часа назад',
      read: false
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
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
                <div key={notif.id} className={cn("p-4 transition-colors", !notif.read && "bg-primary/5")}>
                  <div className="flex gap-3">
                    <div className="mt-1 w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <Info className="w-4 h-4 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className={cn("text-sm font-semibold leading-none", !notif.read && "text-primary")}>{notif.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/60">{notif.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Нет новых уведомлений</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
