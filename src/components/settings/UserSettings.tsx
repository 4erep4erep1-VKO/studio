"use client";

import React, { useState } from 'react';
import { Moon, Sun, Monitor, Bell, BellOff, User, Palette, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Theme, UserPreferences, Order, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { updateProfilePin, getProfileById } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UserSettingsProps {
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  userName: string;
  orders: Order[];
  userId: string;
  role: UserRole;
}

export function UserSettings({ preferences, onUpdatePreferences, userName, orders, userId, role }: UserSettingsProps) {
  const { toast } = useToast();
  const [newPin, setNewPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isChangingPin, setIsChangingPin] = useState(false)
  const [isUpdatingPin, setIsUpdatingPin] = useState(false)

  // Фильтруем заказы именно этого пользователя (исключая общие, если он их не взял)
  const myOrders = orders.filter(o => o.installerId === userId);
  const completedCount = myOrders.filter(o => o.status === 'Завершен').length;
  const inProgressCount = myOrders.filter(o => o.status === 'В работе').length;

  const handleThemeChange = (theme: Theme) => {
    onUpdatePreferences({ ...preferences, theme });
    toast({
      title: "Тема изменена",
      description: `Выбрана ${theme === 'dark' ? 'темная' : theme === 'light' ? 'светлая' : 'системная'} тема.`,
    });
  };

  const handleNotificationsToggle = (enabled: boolean) => {
    onUpdatePreferences({ ...preferences, notificationsEnabled: enabled });
    toast({
      title: enabled ? "Уведомления включены" : "Уведомления выключены",
      description: enabled ? "Вы будете получать сообщения о новых задачах." : "Звуковые сигналы и пуши отключены.",
    });
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (newPin.trim().length < 4) {
      setPinError('PIN должен содержать минимум 4 цифры');
      return;
    }

    setIsUpdatingPin(true);

    try {
      const profile = await getProfileById(userId);
      if (!profile) {
        throw new Error('Профиль не найден. Попробуйте позже.');
      }

      await updateProfilePin(profile.id, newPin.trim());
      setNewPin('');
      setIsChangingPin(false);
      toast({
        title: 'PIN-код изменён',
        description: 'Новый PIN успешно сохранён.',
      });
    } catch (err: any) {
      setPinError(err.message || 'Не удалось обновить PIN.');
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20">
          <User className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-3xl font-headline font-bold">{userName}</h2>
          <p className="text-muted-foreground">Личный кабинет сотрудника</p>
        </div>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="bg-secondary/10 pb-6">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-xl font-headline">Интерфейс</CardTitle>
              <CardDescription>Настройте внешний вид приложения под себя</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          <div className="space-y-4">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Тема оформления</Label>
            <Tabs value={preferences.theme} onValueChange={(val) => handleThemeChange(val as Theme)}>
              <TabsList className="grid grid-cols-3 w-full h-12 bg-secondary/30 p-1">
                <TabsTrigger value="light" className="gap-2 data-[state=active]:bg-background">
                  <Sun className="w-4 h-4" /> <span className="hidden sm:inline">Светлая</span>
                </TabsTrigger>
                <TabsTrigger value="dark" className="gap-2 data-[state=active]:bg-background">
                  <Moon className="w-4 h-4" /> <span className="hidden sm:inline">Темная</span>
                </TabsTrigger>
                <TabsTrigger value="system" className="gap-2 data-[state=active]:bg-background">
                  <Monitor className="w-4 h-4" /> <span className="hidden sm:inline">Система</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {preferences.notificationsEnabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                <Label className="text-base font-medium">Уведомления</Label>
              </div>
              <p className="text-sm text-muted-foreground">Получать оповещения о назначенных заказах</p>
            </div>
            <Switch 
              checked={preferences.notificationsEnabled} 
              onCheckedChange={handleNotificationsToggle}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </CardContent>
      </Card>

      {role === 'installer' && (
        <Card className="border-border/50 overflow-hidden">
          <CardHeader className="bg-secondary/10 pb-6">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-xl font-headline">Смена PIN-кода</CardTitle>
                <CardDescription>Измените PIN, который используется для входа монтажника.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleUpdatePin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pin">Новый PIN</Label>
                <Input
                  id="new-pin"
                  type="password"
                  placeholder="••••"
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value)
                    setPinError('')
                  }}
                  disabled={isUpdatingPin}
                />
                {pinError && <p className="text-xs text-destructive">{pinError}</p>}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isUpdatingPin || newPin.trim().length < 4}>
                  {isUpdatingPin ? 'Сохраняем...' : 'Сохранить PIN'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-primary/5">
        <CardContent className="p-6">
          <h4 className="font-headline font-bold mb-2">Ваша статистика</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-background rounded-xl border border-border/50 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase">Выполнено заказов</p>
              <p className="text-2xl font-bold text-primary">{completedCount}</p>
            </div>
            <div className="p-4 bg-background rounded-xl border border-border/50 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase">В работе</p>
              <p className="text-2xl font-bold text-accent">{inProgressCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
