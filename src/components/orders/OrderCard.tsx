"use client";

import React from 'react';
import { Calendar, MoreVertical, Edit2, CheckCircle2, Clock, XCircle, ImageIcon, HandPointing, Users } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Order, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrderCardProps {
  order: Order;
  onEdit: (order: Order) => void;
  onStatusChange: (order: Order) => void;
  role: UserRole;
  currentUserName?: string;
  currentUserId?: string;
}

export function OrderCard({ order, onEdit, onStatusChange, role, currentUserName, currentUserId }: OrderCardProps) {
  const isCompleted = order.status === 'Завершен';
  const isDeclined = order.status === 'Отклонен';
  const isAdmin = role === 'admin';
  const isGeneral = order.installerId === 'general';
  const hasImages = order.imageUrls && order.imageUrls.length > 0;

  const getStatusBadge = () => {
    if (isGeneral && !isCompleted && !isDeclined) return "bg-accent text-primary-foreground font-bold border-2 border-white/20";
    switch (order.status) {
      case 'Завершен': return "bg-green-600/90 hover:bg-green-600 text-white";
      case 'Отклонен': return "bg-destructive/90 hover:bg-destructive text-white";
      default: return "bg-primary/90 hover:bg-primary text-white";
    }
  };

  const handleClaim = () => {
    if (currentUserId) {
      onStatusChange({ ...order, installerId: currentUserId });
    }
  };

  return (
    <Card className={cn(
      "group overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 shadow-md flex flex-col h-full relative",
      (isCompleted || isDeclined) && !isAdmin && "opacity-80",
      isGeneral && !isAdmin && "border-accent/40 bg-accent/5"
    )}>
      <div className="relative h-48 w-full bg-secondary/50 overflow-hidden">
        {hasImages ? (
          <img 
            src={order.imageUrls![0]} 
            alt={order.objectName} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
            <ImageIcon className="h-12 w-12 mb-2" />
            <span className="text-[10px] uppercase tracking-tighter">Без фото</span>
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
          <Badge className={cn("shadow-lg backdrop-blur-md border-none", getStatusBadge())}>
            {isGeneral && !isCompleted && !isDeclined ? 'ОБЩИЙ ЗАКАЗ' : order.status}
          </Badge>
          {isAdmin && isGeneral && (
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-[10px] py-0">Не назначен</Badge>
          )}
        </div>
        {order.imageUrls && order.imageUrls.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
            +{order.imageUrls.length - 1}
          </div>
        )}
      </div>

      <CardHeader className="p-4 pb-2 space-y-1">
        <div className="flex items-start justify-between">
          <h3 className="font-headline font-semibold text-base leading-tight truncate pr-2" title={order.objectName}>
            {order.objectName}
          </h3>
          {isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-1 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(order)}>
                  <Edit2 className="mr-2 h-4 w-4" /> Редактировать
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange({ ...order, status: isCompleted ? 'В работе' : 'Завершен' })}>
                  {isCompleted ? <Clock className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {isCompleted ? 'Вернуть в работу' : 'Завершить'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            !isGeneral && order.status === 'В работе' && (
              <div className="flex gap-1 shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10" 
                  onClick={() => onStatusChange({ ...order, status: 'Завершен' })}
                  title="Завершить"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                  onClick={() => onStatusChange({ ...order, status: 'Отклонен' })}
                  title="Отказаться"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-3 min-h-[3rem]">
          {order.workDescription}
        </p>
      </CardHeader>

      <CardContent className="p-4 pt-0 mt-auto">
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Calendar className="mr-1.5 h-3 w-3 text-accent" />
            Срок: {new Date(order.dueDate).toLocaleDateString('ru-RU')}
          </div>
          
          {!isAdmin && isGeneral && !isCompleted && !isDeclined && (
            <Button 
              size="sm" 
              className="h-7 text-[10px] font-bold bg-accent hover:bg-accent/90 text-primary-foreground gap-1.5 px-3"
              onClick={handleClaim}
            >
              ВЗЯТЬ ЗАКАЗ
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
