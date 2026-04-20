"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Calendar, MoreVertical, Edit2, CheckCircle2, Clock, XCircle, ImageIcon, User, ZoomIn } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Order, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useInstallers } from '@/hooks/use-installers';
import { CommentsSection } from './CommentsSection';
import { ImagePreviewDialog } from './ImagePreviewDialog'; // Выносим логику просмотра в отдельный компонент

// ##################################################################
// ##                      Интерфейс и Типы                        ##
// ##################################################################

interface OrderCardProps {
  order: Order;
  onEdit: (order: Order) => void;
  onStatusChange: (updates: Partial<Order>) => void; // Принимаем только изменения, а не весь объект
  role: UserRole;
  currentUserName?: string;
  currentUserId?: string;
}

// ##################################################################
// ##                   Основной компонент карточки                  ##
// ##################################################################

export function OrderCard({ order, onEdit, onStatusChange, role, currentUserName, currentUserId }: OrderCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { installers } = useInstallers();

  const isCompleted = order.status === 'Завершен';
  const isDeclined = order.status === 'Отклонен';
  const isAdmin = role === 'admin';
  const isGeneral = order.installerId === 'general';
  const hasImages = order.imageUrls && order.imageUrls.length > 0;

  const assignedInstaller = installers.find(i => i.id === order.installerId);
  const installerName = isGeneral ? 'Общий заказ' : (assignedInstaller?.name || 'Неизвестно');

  // Вынесено в отдельную функцию для чистоты
  const handleClaim = () => {
    if (currentUserId) {
      onStatusChange({ installerId: currentUserId });
    }
  };

  return (
    <>
      <Card className={cn(
        "group flex flex-col h-full overflow-hidden border-border/50 shadow-md transition-all duration-300",
        "hover:border-primary/50",
        (isCompleted || isDeclined) && !isAdmin && "opacity-70",
        isGeneral && !isAdmin && "border-accent/40 bg-accent/5"
      )}>
        <CardImagePreview order={order} onPreview={() => setIsPreviewOpen(true)} />
        <CardHeader className="p-4 pb-2 space-y-1">
          <OrderTitle order={order} isAdmin={isAdmin} onEdit={onEdit} onStatusChange={onStatusChange} />
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {order.workDescription}
          </p>
          {isAdmin && <InstallerBadge installerName={installerName} />}
        </CardHeader>

        <CardContent className="p-4 pt-0 mt-auto">
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <DueDateDisplay dueDate={order.dueDate} />
                {!isAdmin && isGeneral && !isCompleted && !isDeclined && (
                    <Button size="sm" className="h-7 text-[10px] font-bold gap-1.5 px-3" onClick={handleClaim}>
                        Взять заказ
                    </Button>
                )}
            </div>
        </CardContent>

        <CommentsSection
          orderId={order.id}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          className="px-4 pb-4 border-t border-border/50 pt-4"
        />
      </Card>

      {hasImages && (
          <ImagePreviewDialog 
              isOpen={isPreviewOpen} 
              onOpenChange={setIsPreviewOpen} 
              imageUrls={order.imageUrls!} 
              objectName={order.objectName}
          />
      )}
    </>
  );
}

// ##################################################################
// ##                   Вспомогательные компоненты                 ##
// ##################################################################

const CardImagePreview = ({ order, onPreview }: { order: Order, onPreview: () => void }) => {
  const hasImages = order.imageUrls && order.imageUrls.length > 0;

  const getStatusBadgeClass = () => {
    if (order.installerId === 'general' && order.status !== 'Завершен' && order.status !== 'Отклонен') return "bg-accent text-primary-foreground font-bold border-2 border-white/20";
    switch (order.status) {
      case 'Завершен': return "bg-green-600/90 hover:bg-green-600 text-white";
      case 'Отклонен': return "bg-destructive/90 hover:bg-destructive text-white";
      default: return "bg-primary/90 hover:bg-primary text-white";
    }
  };

  return (
    <div className="relative h-48 w-full bg-secondary/50 overflow-hidden cursor-zoom-in" onClick={onPreview}>
      {hasImages ? (
        <Image 
          src={order.imageUrls![0]} 
          alt={order.objectName} 
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30">
          <ImageIcon className="h-12 w-12 mb-2" />
          <span className="text-[10px] uppercase tracking-tighter">Без фото</span>
        </div>
      )}
      
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <ZoomIn className="text-white w-8 h-8 drop-shadow-md" />
      </div>

      <div className="absolute top-3 right-3">
          <Badge className={cn("shadow-lg backdrop-blur-md border-none", getStatusBadgeClass())}>
              {order.installerId === 'general' && order.status !== 'Завершен' && order.status !== 'Отклонен' ? 'ОБЩИЙ ЗАКАЗ' : order.status}
          </Badge>
      </div>
      
      {order.imageUrls && order.imageUrls.length > 1 && (
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
          +{order.imageUrls.length - 1}
        </div>
      )}
    </div>
  );
};

const OrderTitle = ({ order, isAdmin, onEdit, onStatusChange }: { order: Order, isAdmin: boolean, onEdit: (order: Order) => void, onStatusChange: (updates: Partial<Order>) => void }) => {
  const isCompleted = order.status === 'Завершен';

  return (
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
            <DropdownMenuItem onClick={() => onEdit(order)}><Edit2 className="mr-2 h-4 w-4" /> Редактировать</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange({ status: isCompleted ? 'В работе' : 'Завершен' })}>
              {isCompleted ? <Clock className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {isCompleted ? 'Вернуть в работу' : 'Завершить'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        order.status === 'В работе' && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10" onClick={() => onStatusChange({ status: 'Завершен' })} title="Завершить">
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => onStatusChange({ status: 'Отклонен' })} title="Отклонить заказ">
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )
      )}
    </div>
  );
};

const InstallerBadge = ({ installerName }: { installerName: string }) => (
    <div className="flex items-center gap-1.5 pt-1">
        <User className="h-3 w-3 text-muted-foreground" />
        <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
            {installerName}
        </Badge>
    </div>
);

const DueDateDisplay = ({ dueDate }: { dueDate: string }) => (
    <div className="flex items-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Calendar className="mr-1.5 h-3 w-3 text-accent" />
        {new Date(dueDate).toLocaleDateString('ru-RU')}
    </div>
);
