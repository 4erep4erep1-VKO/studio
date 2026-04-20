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

const OFFLINE_ERROR = 'Нет интернет-соединения. Проверьте подключение и попробуйте снова.';

const orderFormSchema = z.object({
  objectName: z.string().min(1, 'Название объекта обязательно'),
  workDescription: z.string().min(1, 'Описание работ обязательно'),
  dueDate: z.string().min(1, 'Дата сдачи обязательна'),
  installerId: z.string().min(1, 'Выберите исполнителя'),
  status: z.enum(['В работе', 'Завершен', 'Отклонен']).default('В работе'),
});

type OrderFormData = z.infer<typeof orderFormSchema>;

interface OrderFormProps {
  initialData?: Order;
  onSubmit: (data: OrderFormData & { imageUrls: string[] }) => Promise<void>;
  onCancel: () => void;
  isOnline: boolean;
}

type FileWithPreview = File & { preview: string };

export function OrderForm({ initialData, onSubmit, onCancel, isOnline }: OrderFormProps) {
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(initialData?.imageUrls || []);
  const [newFiles, setNewFiles] = useState<FileWithPreview[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
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

  useEffect(() => {
    return () => {
      newFiles.forEach(file => URL.revokeObjectURL(file.preview));
    };
  }, [newFiles]);

  const handleFormSubmit = async (data: OrderFormData) => {
    if (!isOnline) {
        toast({ title: 'Ошибка', description: OFFLINE_ERROR, variant: 'destructive' });
        return;
    }
    
    setUploadErrors([]);
    let uploadedImageUrls: string[] = [];

    try {
        if (newFiles.length > 0) {
            const uploadPromises = newFiles.map(async (file) => {
                try {
                    return await uploadImage(file);
                } catch (error: any) {
                    setUploadErrors(prev => [...prev, `Файл "${file.name}": ${error.message}`]);
                    return null;
                }
            });
            
            const results = await Promise.all(uploadPromises);
            uploadedImageUrls = results.filter((url): url is string => url !== null);

            if (uploadErrors.length > 0) {
                 toast({ title: 'Ошибки при загрузке файлов', description: 'Некоторые файлы не удалось загрузить.', variant: 'destructive' });
                 return;
            }
        }

        await onSubmit({ 
            ...data, 
            imageUrls: [...existingImageUrls, ...uploadedImageUrls] 
        });

    } catch (error: any) {
      toast({ title: 'Ошибка отправки', description: error.message, variant: 'destructive' });
    }
  };
  
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
        {/* ... rest of the form ... */}
        <FormActions onCancel={onCancel} isSubmitting={isSubmitting} isEditing={!!initialData} />
    </form>
  );
}

// ... (rest of the components remain the same)