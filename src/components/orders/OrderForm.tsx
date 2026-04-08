"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Order, OrderStatus } from '@/lib/types';
import { useInstallers } from '@/hooks/use-installers';

const orderSchema = z.object({
  objectName: z.string().min(1, 'Название объекта обязательно'),
  workDescription: z.string().min(1, 'Описание работ обязательно'),
  dueDate: z.string().min(1, 'Дата сдачи обязательна'),
  installerId: z.string().min(1, 'Выберите исполнителя'),
  status: z.enum(['В работе', 'Завершен', 'Отклонен']).default('В работе'),
});

interface OrderFormProps {
  initialData?: Order;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function OrderForm({ initialData, onSubmit, onCancel }: OrderFormProps) {
  const { installers } = useInstallers();

  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues: initialData ? {
      objectName: initialData.objectName,
      workDescription: initialData.workDescription,
      dueDate: initialData.dueDate,
      installerId: initialData.installerId,
      status: initialData.status,
    } : {
      objectName: '',
      workDescription: '',
      dueDate: new Date().toISOString().split('T')[0],
      installerId: '',
      status: 'В работе' as OrderStatus,
    }
  });

  const handleFormSubmit = (data: any) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="objectName">Название объекта</Label>
            <Input id="objectName" {...register('objectName')} placeholder="Напр. ТЦ Авиапарк - Баннер" />
            {errors.objectName && <p className="text-xs text-destructive">{errors.objectName.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Дата сдачи</Label>
            <Input id="dueDate" type="date" {...register('dueDate')} />
            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="installerId">Исполнитель</Label>
            <Select 
              onValueChange={(val) => setValue('installerId', val)} 
              defaultValue={initialData?.installerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите монтажника" />
              </SelectTrigger>
              <SelectContent>
                {installers.map(inst => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.installerId && <p className="text-xs text-destructive">{errors.installerId.message as string}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workDescription">Описание работ</Label>
            <Textarea 
              id="workDescription" 
              {...register('workDescription')} 
              placeholder="Детальное описание того, что нужно сделать..."
              className="min-h-[120px]"
            />
            {errors.workDescription && <p className="text-xs text-destructive">{errors.workDescription.message as string}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Статус</Label>
            <Select 
              onValueChange={(val) => setValue('status', val as OrderStatus)} 
              defaultValue={initialData?.status || 'В работе'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Статус заказа" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="В работе">В работе</SelectItem>
                <SelectItem value="Завершен">Завершен</SelectItem>
                <SelectItem value="Отклонен">Отклонен</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button type="submit" className="bg-primary hover:bg-primary/90 text-white min-w-[140px]">
          {initialData ? 'Сохранить изменения' : 'Создать заказ'}
        </Button>
      </div>
    </form>
  );
}
