
"use client";

import React, { useState, useEffect } from 'react';
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
import { ImagePlus, X, Users, Clipboard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/lib/api';

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

type FileWithPreview = File & { preview?: string };

export function OrderForm({ initialData, onSubmit, onCancel }: OrderFormProps) {
  const { installers } = useInstallers();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
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

  const currentInstallerId = watch('installerId');

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview && file.preview.startsWith('blob:')) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  // Обработка вставки из буфера обмена (Ctrl+V)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' }) as FileWithPreview;
            file.preview = URL.createObjectURL(file);
            setFiles(prev => [...prev, file]);
            toast({ title: "Изображение вставлено", description: "Скриншот добавлен к заказу." });
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (!newFiles) return;

    const filesWithPreview: FileWithPreview[] = Array.from(newFiles).map((file) => {
      const fileWithPreview = file as FileWithPreview;
      fileWithPreview.preview = URL.createObjectURL(file);
      return fileWithPreview;
    });

    setFiles((prev) => [...prev, ...filesWithPreview]);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setFiles((prev) => {
      const fileToRemove = prev[index];
      const updated = prev.filter((_, i) => i !== index);

      if (fileToRemove?.preview && fileToRemove.preview.startsWith('blob:')) {
        URL.revokeObjectURL(fileToRemove.preview);
      }

      return updated;
    });
  };

  const handleFormSubmit = async (data: any) => {
    try {
      setIsUploading(true);

      if (files.length === 0) {
        onSubmit({ ...data, imageUrls: [] });
        return;
      }

      // Загружаем все файлы параллельно
      const uploadPromises = files.map(async (file) => {
        try {
          return await uploadImage(file);
        } catch (err: any) {
          throw new Error(`Файл "${file.name}": ${err.message}`);
        }
      });

      const imageUrls = await Promise.all(uploadPromises);

      // Обновляем превью на реальные URL и очищаем blob URLs
      files.forEach((file, idx) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
        file.preview = imageUrls[idx];
      });
      setFiles([...files]);

      // Отправляем данные формы с URL изображений
      onSubmit({ ...data, imageUrls });
    } catch (error: any) {
      const errorMsg = error.message || 'Не удалось загрузить изображения.';
      const isNetworkError = !navigator.onLine || errorMsg.includes('network');
      
      toast({
        title: isNetworkError ? 'Нет интернета' : 'Ошибка загрузки',
        description: isNetworkError 
          ? 'Проверьте соединение и повторите попытку.'
          : errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
              <SelectTrigger className={currentInstallerId === 'general' ? "border-accent bg-accent/5" : ""}>
                <SelectValue placeholder="Выберите монтажника" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general" className="font-bold text-accent">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Общий заказ (свободный выбор)</span>
                  </div>
                </SelectItem>
                {installers.map(inst => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.installerId && <p className="text-xs text-destructive">{errors.installerId.message as string}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Фотографии объекта</Label>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clipboard className="w-3 h-3" />
                <span>Можно вставить из буфера (Ctrl+V)</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {files.map((file, idx) => (
                <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border group">
                  {file.preview && (
                    <img src={file.preview} alt={`Photo ${idx}`} className="w-full h-full object-cover" />
                  )}
                  <button 
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors">
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <span className="text-[10px] mt-1 text-muted-foreground">Добавить</span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} disabled={isUploading} />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workDescription">Описание работ</Label>
            <Textarea 
              id="workDescription" 
              {...register('workDescription')} 
              placeholder="Детальное описание того, что нужно сделать..."
              className="min-h-[150px]"
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
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isUploading}>Отмена</Button>
        <Button type="submit" disabled={isUploading} className="bg-primary hover:bg-primary/90 text-white min-w-[140px] disabled:opacity-50">
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Загрузка...
            </>
          ) : (
            initialData ? 'Сохранить изменения' : 'Создать заказ'
          )}
        </Button>
      </div>
    </form>
  );
}

