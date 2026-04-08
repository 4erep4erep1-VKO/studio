"use client";

import React, { useState } from 'react';
import { Shield, HardHat, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserRole } from '@/lib/types';
import { useAppSettings } from '@/hooks/use-app-settings';

interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [step, setStep] = useState<'choice' | 'pin'>('choice');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { settings } = useAppSettings();

  const handleAdminChoice = () => {
    setStep('pin');
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === settings.adminPin) {
      onLogin('admin');
    } else {
      setError('Неверный PIN-код');
      setPin('');
    }
  };

  if (step === 'choice') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-headline font-bold text-primary">Creative Dispatch</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-xs">Система управления монтажом</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Card 
              className="cursor-pointer hover:border-primary/50 transition-all group overflow-hidden"
              onClick={handleAdminChoice}
            >
              <CardContent className="p-6 flex items-center gap-6">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Shield className="w-8 h-8" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-headline font-bold text-lg">Администратор</h3>
                  <p className="text-sm text-muted-foreground">Управление заказами и персоналом</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-accent/50 transition-all group overflow-hidden"
              onClick={() => onLogin('installer')}
            >
              <CardContent className="p-6 flex items-center gap-6">
                <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                  <HardHat className="w-8 h-8" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-headline font-bold text-lg">Монтажник</h3>
                  <p className="text-sm text-muted-foreground">Просмотр текущих задач и отметки</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-sm w-full shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="font-headline text-2xl">Введите PIN-код</CardTitle>
          <CardDescription>Для доступа к панели управления администратора</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <Input 
              type="password" 
              placeholder="••••" 
              className="text-center text-2xl tracking-[1em] h-14"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              autoFocus
              maxLength={8}
            />
            {error && <p className="text-xs text-destructive text-center">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setStep('choice')}>Назад</Button>
              <Button type="submit" className="flex-1 bg-primary text-white">Войти</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
