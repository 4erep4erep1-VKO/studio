"use client";

import React from 'react';
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
import { useFirestore, useCollection, useMemoFirebase, useUser, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, limit } from 'firebase/firestore';
import { AppNotification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface NotificationCenterProps {
  currentUserId?: string;
}

export function NotificationCenter({ currentUserId }: NotificationCenterProps) {
  const db = useFirestore();
  const { user: firebaseUser } = useUser();

  const notificationsQuery = useMemoFirebase(() => {
    // Безопасный запрос: только когда авторизация и ID пользователя готовы
    if (!db || !firebaseUser || !currentUserId) return null;
    
    return query(
      collection(db, 'notifications'),
      where('userId', '==', currentUserId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [db, firebaseUser, currentUserId]);

  const { data: notifications } = useCollection<AppNotification>(notificationsQuery);

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const markAllRead = () => {
    if (!notifications || !db) return;
    notifications.forEach(n => {
      if (!n.read) {
        updateDocumentNonBlocking(doc(db, 'notifications', n.id), { read: true });
      }
    });
  };

  const clearAll = () => {
    if (!notifications || !db) return;
    notifications.forEach(n => {
      deleteDocumentNonBlocking(doc(db, 'notifications', n.id));
    });
  };

  const markAsRead = (id: string) => {
    if (!db) return;
    updateDocumentNonBlocking(doc(db, 'notifications', id), { read: true });
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
          {notifications && notifications.length > 0 ? (
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
                        {notif.createdAt ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ru }) : 'Недавно'}
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