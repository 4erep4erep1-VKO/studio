'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImagePreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  imageUrls: string[];
  objectName: string;
  initialIndex?: number;
}

export function ImagePreviewDialog({ 
    isOpen, 
    onOpenChange, 
    imageUrls, 
    objectName, 
    initialIndex = 0 
}: ImagePreviewDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Сбрасываем индекс при каждом открытии, если передается initialIndex
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  if (!imageUrls || imageUrls.length === 0) return null;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/90 border-none">
        <DialogTitle className="sr-only">Просмотр фото: {objectName}</DialogTitle>
        <div className="relative w-full h-full flex items-center justify-center p-4">
          <div className="relative max-w-full max-h-[85vh] w-auto h-auto">
            <Image 
              src={imageUrls[currentIndex]} 
              alt={`${objectName} - фото ${currentIndex + 1}`}
              width={1200}
              height={900}
              sizes="90vw"
              className="max-w-full max-h-[85vh] object-contain shadow-2xl"
              style={{ width: 'auto', height: 'auto' }} // Позволяет сохранять пропорции
            />
          </div>
          
          {imageUrls.length > 1 && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12 rounded-full"
                onClick={prevImage}
              >
                <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-10 w-10 sm:h-12 sm:w-12 rounded-full"
                onClick={nextImage}
              >
                <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
              </Button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
                {currentIndex + 1} / {imageUrls.length}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
