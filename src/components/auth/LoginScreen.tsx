"use client";

import React, { useState, useEffect } from 'react';
import { Shield, HardHat, ChevronRight, Lock, User, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserRole, Installer } from '@/lib/types';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useInstallers } from '@/hooks/use-installers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth, useFirestore } from '@/firebase';
import { collection, doc, setDoc, addDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

interface LoginScreenProps {
  onLogin: (role: UserRole, id: string, name: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [step, setStep] = useState<'choice' | 'pin' | 'installers'>('choice');
  const [pin, setPin] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const { settings, isLoading: isSettingsLoading } = useAppSettings();
  const { installers } = useInstallers();
  const auth = useAuth();
  const db = useFirestore();

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === (settings?.adminPin || '1234')) {
      setIsLoggingIn(true);
      try {
        // Гарантируем анонимный вход перед записью роли
        let currentUser = auth.currentUser;
        if (!currentUser) {
          const cred = await signInAnonymously(auth);
          currentUser = cred.user;
        }

        if (db && currentUser) {
          const adminRef = doc(db, 'roles_admin', currentUser.uid);
          await setDoc(adminRef, { id: currentUser.uid, name: 'Администратор' }, { merge: true });
          
          await addDoc(collection(db, 'accessLogs'), {
            timestamp: new Date().toISOString(),
            accessedByRole: 'Administrator',
            userName: 'Администратор'
          });

          onLogin('admin', currentUser.uid, 'Администратор');
        }
      } catch (err) {
        setError('Ошибка входа в систему');
        console.error(err);
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      setError('Неверный PIN-код');
      setPin('');
    }
  };

  const handleInstallerLogin = async (installer: Installer) => {
    setIsLoggingIn(true);
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }

      if (db && currentUser) {
        const installerRoleRef = doc(db, 'roles_installer', currentUser.uid);
        await setDoc(installerRoleRef, { 
          installerId: installer.id, 
          name: installer.name,
          loginTime: new Date().toISOString() 
        }, { merge: true });

        await addDoc(collection(db, 'accessLogs'), {
          timestamp: new Date().toISOString(),
          accessedByRole: 'Installer',
          userName: installer.name
        });

        onLogin('installer', installer.id, installer.name);
      }
    } catch (err) {
      setError('Ошибка авторизации');
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const filteredInstallers = installers.filter(inst => 
    inst.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoggingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (step === 'choice') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-500">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-headline font-bold text-primary">Creative Dispatch</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-xs">Система управления монтажом</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Card className="cursor-pointer hover:border-primary/50 transition-all group" onClick={() => setStep('pin')}>
              <CardContent className="p-6 flex items-center gap-6">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Shield className="w-8 h-8" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-headline font-bold text-lg">Администратор</h3>
                  <p className="text-sm text-muted-foreground">Управление заказами и персоналом</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-accent/50 transition-all group" onClick={() => setStep('installers')}>
              <CardContent className="p-6 flex items-center gap-6">
                <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                  <HardHat className="w-8 h-8" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-headline font-bold text-lg">Монтажник</h3>
                  <p className="text-sm text-muted-foreground">Просмотр и выполнение задач</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'installers') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="font-headline text-2xl">Выберите аккаунт</CardTitle>
            <CardDescription>Выберите ваше имя из списка для входа</CardDescription>
          </CardHeader>
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск по имени..." 
                className="pl-10 h-10 bg-secondary/30 border-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <CardContent className="p-0">
            <ScrollArea className="h-[350px]">
              <div className="p-6 pt-0 space-y-2">
                {filteredInstallers.map((inst) => (
                  <Button
                    key={inst.id}
                    variant="ghost"
                    className="w-full justify-between h-14 px-4 hover:bg-primary/10 hover:text-primary transition-colors group"
                    onClick={() => handleInstallerLogin(inst)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold group-hover:bg-primary group-hover:text-white">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="font-medium">{inst.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                  </Button>
                ))}
                {!filteredInstallers.length && (
                  <div className="text-center py-10 text-muted-foreground">Монтажники не найдены</div>
                )}
              </div>
            </ScrollArea>
            <div className="p-4 border-t bg-secondary/10">
              <Button variant="ghost" className="w-full" onClick={() => setStep('choice')}>Назад</Button>
            </div>
          </CardContent>
        </Card>
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
          <CardDescription>Доступ в панель администратора</CardDescription>
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
            />
            {error && <p className="text-xs text-destructive text-center">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setStep('choice')}>Назад</Button>
              <Button type="submit" className="flex-1 bg-primary text-white" disabled={isSettingsLoading}>Войти</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}