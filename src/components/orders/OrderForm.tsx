'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

// ##################################################################
// ##                   Схема валидации и типы                     ##
// ##################################################################

const orderFormSchema = z.object({
  objectName: z.string().min(1, 'Название объекта обязательно'),
  workDescription: z.string().min(1, 'Описание работ обязательно'),
  dueDate: z.string().min(1, 'Дата сдачи обязательна'),
  installerId: z.string().min(1, 'Выберите исполнителя'),
  status: z.enum(['В работе', 'Завершен', 'Отклонен']).default('В работе'),
});

// Выводим тип данных формы из схемы Zod для строгой типизации
type OrderFormData = z.infer<typeof orderFormSchema>;

interface OrderFormProps {
  initialData?: Order;
  onSubmit: (data: OrderFormData & { imageUrls: string[] }) => Promise<void>;
  onCancel: () => void;
}

type FileWithPreview = File & { preview: string };

// ##################################################################
// ##                 Основной компонент формы                     ##
// ##################################################################

export function OrderForm({ initialData, onSubmit, onCancel }: OrderFormProps) {
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(initialData?.imageUrls || []);
  const [newFiles, setNewFiles] = useState<FileWithPreview[]>([]);
  const { toast } = useToast();

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      objectName: initialData?.objectName || '',
      workDescription: initialData?.workDescription || '',
      dueDate: initialData?.dueDate || new Date().toISOString().split('T')[0],
      installerId: initialData?.installerId || '',
      status: initialData?.status || 'В работе',
    }
  });

  const { handleSubmit, formState: { isSubmitting } } = form;

  // Очищаем blob-ссылки при размонтировании, чтобы избежать утечек памяти
  useEffect(() => {
    return () => {
      newFiles.forEach(file => URL.revokeObjectURL(file.preview));
    };
  }, [newFiles]);

  const handleFormSubmit = async (data: OrderFormData) => {
    try {
      let uploadedImageUrls: string[] = [];
      if (newFiles.length > 0) {
        const uploadPromises = newFiles.map(file => uploadImage(file));
        uploadedImageUrls = await Promise.all(uploadPromises);
      }

      await onSubmit({ 
        ...data, 
        imageUrls: [...existingImageUrls, ...uploadedImageUrls] 
      });

    } catch (error: any) {
      toast({ title: 'Ошибка отправки', description: error.message, variant: 'destructive' });
      // Не сбрасываем форму, чтобы пользователь мог исправить ошибку
    }
  };
  
  // Обработчик вставки из буфера обмена
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if(file) files.push(file);
        }
    }
    
    if (files.length > 0) {
        event.preventDefault();
        const filesWithPreview: FileWithPreview[] = files.map(file => Object.assign(file, { preview: URL.createObjectURL(file) }));
        setNewFiles(prev => [...prev, ...filesWithPreview]);
        toast({ title: 'Фото добавлено', description: `${files.length} изображений вставлено из буфера обмена.` });
    }
  }, [toast]);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} onPaste={handlePaste} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
            <FormFields form={form} initialData={initialData} />
            <ImageUploadSection 
                existingImageUrls={existingImageUrls}
                newFiles={newFiles}
                setExistingImageUrls={setExistingImageUrls}
                setNewFiles={setNewFiles}
                isSubmitting={isSubmitting}
            />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workDescription">Описание работ</Label>
          <Textarea 
            id="workDescription" 
            {...form.register('workDescription')} 
            placeholder="Детальное описание того, что нужно сделать..."
            className="min-h-[340px]"
          />
          {form.formState.errors.workDescription && <p className="text-xs text-destructive">{form.formState.errors.workDescription.message}</p>}
        </div>
      </div>
      
      <FormActions onCancel={onCancel} isSubmitting={isSubmitting} isEditing={!!initialData} />
    </form>
  );
}

// ##################################################################
// ##               Секция с полями ввода формы                    ##
// ##################################################################

const FormFields = ({ form, initialData }: { form: any, initialData?: Order }) => {
    const { installers } = useInstallers();
    const { register, formState: { errors }, setValue, watch } = form;
    const currentInstallerId = watch('installerId');

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="objectName">Название объекта</Label>
                <Input id="objectName" {...register('objectName')} placeholder="Напр. ТЦ Авиапарк - Баннер" />
                {errors.objectName && <p className="text-xs text-destructive">{errors.objectName.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="dueDate">Дата сдачи</Label>
                <Input id="dueDate" type="date" {...register('dueDate')} />
                {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="installerId">Исполнитель</Label>
                <Select onValueChange={(val) => setValue('installerId', val, { shouldValidate: true })} defaultValue={initialData?.installerId}>
                    <SelectTrigger className={currentInstallerId === 'general' ? "border-accent bg-accent/5" : ""}>
                        <SelectValue placeholder="Выберите монтажника" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="general" className="font-bold text-accent"><div className="flex items-center gap-2"><Users className="w-4 h-4" /><span>Общий заказ (свободный выбор)</span></div></SelectItem>
                        {installers.map(inst => (<SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>))}
                    </SelectContent>
                </Select>
                {errors.installerId && <p className="text-xs text-destructive">{errors.installerId.message}</p>}
            </div>
            {/* Поле статуса показываем только при редактировании */}
            {initialData && (
                <div className="space-y-2">
                    <Label htmlFor="status">Статус</Label>
                    <Select onValueChange={(val: OrderStatus) => setValue('status', val)} defaultValue={initialData.status}>
                        <SelectTrigger><SelectValue placeholder="Статус заказа" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="В работе">В работе</SelectItem>
                            <SelectItem value="Завершен">Завершен</SelectItem>
                            <SelectItem value="Отклонен">Отклонен</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}

// ##################################################################
// ##              Секция загрузки и предпросмотра изображений     ##
// ##################################################################

const ImageUploadSection = ({ existingImageUrls, newFiles, setExistingImageUrls, setNewFiles, isSubmitting }: any) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).map(file => Object.assign(file, { preview: URL.createObjectURL(file) }));
    setNewFiles((prev: any) => [...prev, ...files]);
    e.target.value = ''; // Позволяет загружать один и тот же файл повторно
  };

  const removeExistingImage = (index: number) => setExistingImageUrls((prev: any) => prev.filter((_: any, i: number) => i !== index));
  const removeNewFile = (index: number) => setNewFiles((prev: any) => prev.filter((_: any, i: number) => i !== index));

  return (
    <div className="space-y-2">
        <div className="flex items-center justify-between">
            <Label>Фотографии</Label>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clipboard className="w-3 h-3" /><span>Можно вставить (Ctrl+V)</span></div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
            {existingImageUrls.map((url: string, idx: number) => <ImagePreview key={url} src={url} onRemove={() => removeExistingImage(idx)} />)}
            {newFiles.map((file: FileWithPreview, idx: number) => <ImagePreview key={file.preview} src={file.preview} onRemove={() => removeNewFile(idx)} />)}
            <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors">
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <span className="text-[10px] mt-1 text-muted-foreground">Добавить</span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} disabled={isSubmitting} />
            </label>
        </div>
    </div>
  );
}

const ImagePreview = ({ src, onRemove }: { src: string, onRemove: () => void }) => (
    <div className="relative aspect-square rounded-md overflow-hidden border border-border group">
        <img src={src} alt="Preview" className="w-full h-full object-cover" />
        <Button type="button" size="icon" variant="destructive" onClick={onRemove} className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
            <X className="w-3 h-3" />
        </Button>
    </div>
);

// ##################################################################
// ##                 Кнопки действий формы (сабмит/отмена)        ##
// ##################################################################

const FormActions = ({ onCancel, isSubmitting, isEditing }: { onCancel: () => void, isSubmitting: boolean, isEditing: boolean }) => (
    <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>Отмена</Button>
        <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Обработка...</> : (isEditing ? 'Сохранить изменения' : 'Создать заказ')}
        </Button>
    </div>
);
