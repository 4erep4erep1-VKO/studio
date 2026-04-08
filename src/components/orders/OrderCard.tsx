"use client";

import React from 'react';
import { Calendar, User, MoreVertical, Edit2, CheckCircle2, Clock, MapPin, Sparkles, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Order } from '@/lib/types';
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
  readOnly?: boolean;
}

export function OrderCard({ order, onEdit, onStatusChange, readOnly = false }: OrderCardProps) {
  const isCompleted = order.status === 'Завершен';

  return (
    <Card className={cn(
      "group overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 shadow-md",
      isCompleted && "opacity-80"
    )}>
      <div className="relative h-48 w-full bg-secondary/50">
        {order.photoDataUri ? (
          <img 
            src={order.photoDataUri} 
            alt={order.objectName} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <MapPin className="h-12 w-12" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge className={cn(
            "shadow-lg backdrop-blur-md",
            isCompleted ? "bg-green-600/90 hover:bg-green-600" : "bg-primary/90 hover:bg-primary"
          )}>
            {order.status}
          </Badge>
        </div>
      </div>

      <CardHeader className="p-4 pb-2 space-y-1">
        <div className="flex items-start justify-between">
          <h3 className="font-headline font-semibold text-lg leading-tight truncate pr-2" title={order.objectName}>
            {order.objectName}
          </h3>
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-1">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(order)}>
                  <Edit2 className="mr-2 h-4 w-4" /> Редактировать
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange({ ...order, status: isCompleted ? 'В работе' : 'Завершен' })}>
                  {isCompleted ? <Clock className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {isCompleted ? 'Вернуть в работу' : 'Завершить заказ'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {readOnly && <Lock className="h-3.5 w-3.5 text-muted-foreground/40 mt-1" />}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 h-10">
          {order.description}
        </p>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-4">
        <div className="flex flex-wrap gap-y-2 gap-x-4 pt-4 border-t border-border/50 text-xs font-medium">
          <div className="flex items-center text-muted-foreground">
            <Calendar className="mr-1.5 h-3.5 w-3.5 text-accent" />
            До {new Date(order.dueDate).toLocaleDateString('ru-RU')}
          </div>
          <div className="flex items-center text-muted-foreground">
            <User className="mr-1.5 h-3.5 w-3.5 text-accent" />
            {order.installer}
          </div>
        </div>

        {order.aiEstimation && (
          <div className="bg-primary/5 rounded-lg p-2 flex items-start gap-2 border border-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-accent mt-0.5" />
            <div className="text-[10px] leading-relaxed text-muted-foreground">
              <span className="font-bold text-primary/80">AI Оценка:</span> {order.aiEstimation.estimatedDuration}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
