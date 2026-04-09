"use client";

import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConnectionStatusProps {
  isOnline: boolean;
}

export function ConnectionStatus({ isOnline }: ConnectionStatusProps) {
  if (isOnline) return null;

  return (
    <Alert variant="destructive" className="rounded-none border-0 border-b m-0">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        Нет соединения с интернетом. Некоторые операции недоступны.
      </AlertDescription>
    </Alert>
  );
}
