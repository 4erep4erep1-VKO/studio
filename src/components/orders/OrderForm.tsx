"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Camera, Image as ImageIcon, Upload, X, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Order, OrderStatus, INSTALLERS } from '@/lib/types';
import { estimateWork } from '@/ai/flows/ai-visual-work-estimator-flow';
import { cn } from '@/lib/utils';

const orderSchema = z.object({
  objectName: z.string().min(1, 'Название объекта обязательно'),
  description: z.string().min(1, 'Описание работ обязательно'),
  dueDate: z.string().min(1, 'Дата сдачи обязательна'),
  installer: z.string().min(1, 'Выберите исполнителя'),
  status: z.enum(['В работе', 'Завершен']).default('В работе'),
});

interface OrderFormProps {
  initialData?: Order;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function OrderForm({ initialData, onSubmit, onCancel }: OrderFormProps) {
  const [photo, setPhoto] = useState<string | undefined>(initialData?.photoDataUri);
  const [isEstimating, setIsEstimating] = useState(false);
  const [aiResult, setAiResult] = useState(initialData?.aiEstimation);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues: initialData || {
      objectName: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      installer: '',
      status: 'В работе' as OrderStatus,
    }
  });

  const description = watch('description');

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setPhoto(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onPaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) handleFileUpload(file);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onPaste]);

  const handleAiEstimation = async () => {
    if (!photo || !description) return;
    setIsEstimating(true);
    try {
      const result = await estimateWork({
        photoDataUri: photo,
        description: description
      });
      setAiResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleFormSubmit = (data: any) => {
    onSubmit({
      ...data,
      photoDataUri: photo,
      aiEstimation: aiResult,
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      createdAt: initialData?.createdAt || new Date().toISOString(),
    });
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
            <Label htmlFor="installer">Исполнитель</Label>
            <Select onValueChange={(val) => setValue('installer', val)} defaultValue={initialData?.installer}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите монтажника" />
              </SelectTrigger>
              <SelectContent>
                {INSTALLERS.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.installer && <p className="text-xs text-destructive">{errors.installer.message as string}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание работ</Label>
            <Textarea 
              id="description" 
              {...register('description')} 
              placeholder="Детальное описание того, что нужно сделать..."
              className="min-h-[120px]"
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message as string}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <Label>Фото объекта / Макет</Label>
          <div 
            ref={dropZoneRef}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-primary');
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
            className={cn(
              "relative border-2 border-dashed rounded-xl h-[240px] flex flex-col items-center justify-center transition-all bg-secondary/30 overflow-hidden",
              !photo && "hover:bg-secondary/50 cursor-pointer"
            )}
            onClick={() => !photo && document.getElementById('file-upload')?.click()}
          >
            {photo ? (
              <>
                <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-2 right-2 rounded-full"
                  onClick={(e) => { e.stopPropagation(); setPhoto(undefined); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Перетащите фото сюда или нажмите</p>
                <p className="text-xs text-muted-foreground mt-1">Поддерживается вставка из буфера обмена (Ctrl+V)</p>
              </div>
            )}
          </div>
          <input 
            id="file-upload" 
            type="file" 
            className="hidden" 
            accept="image/*" 
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
          />

          <Button 
            type="button" 
            variant="outline" 
            className="w-full border-primary/20 hover:border-primary/40 group relative overflow-hidden"
            disabled={!photo || !description || isEstimating}
            onClick={handleAiEstimation}
          >
            {isEstimating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Анализируем...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4 text-accent" />
                Получить AI-оценку
              </>
            )}
          </Button>

          {aiResult && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Sparkles className="h-4 w-4" />
                Результат анализа AI
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold block mb-1">Сложности:</span>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {aiResult.complexities.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
                <div>
                  <span className="font-semibold block mb-1">Инструменты:</span>
                  <p className="text-muted-foreground">{aiResult.requiredTools.join(', ')}</p>
                </div>
                <div>
                  <span className="font-semibold block mb-1">Срок выполнения:</span>
                  <p className="text-muted-foreground">{aiResult.estimatedDuration}</p>
                </div>
              </div>
            </div>
          )}
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
