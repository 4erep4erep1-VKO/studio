'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTheme } from "next-themes";
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, ShieldCheck, Sun, Moon, Laptop, Loader2 } from 'lucide-react';

// ##################################################################
// ##                 Основной компонент-контейнер                 ##
// ##################################################################

export function UserSettings() {
  const { user, getRole } = useAuth();

  // Если данных пользователя нет, ничего не рендерим.
  if (!user) {
    return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pt-4">
      <h2 className="text-2xl font-bold tracking-tight">Личный кабинет</h2>
      <ProfileCard userName={user.email || 'Пользователь'} role={getRole()} />
      <ThemeSelector />
      <SecuritySettings userId={user.id} />
    </div>
  );
}

// ##################################################################
// ##                Карточка с данными пользователя               ##
// ##################################################################

const ProfileCard = ({ userName, role }: { userName: string, role: string }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        <ShieldCheck className="text-primary w-5 h-5" />
        Данные аккаунта
      </CardTitle>
      <CardDescription>Ваша основная информация в системе.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p>Имя пользователя: <span className="font-medium text-foreground">{userName}</span></p>
      <p>Роль: <span className="font-medium text-foreground px-2 py-0.5 bg-secondary rounded-md">{role === 'admin' ? 'Администратор' : 'Монтажник'}</span></p>
    </CardContent>
  </Card>
);

// ##################################################################
// ##                   Компонент выбора темы                      ##
// ##################################################################

const ThemeSelector = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
        <CardHeader>
            <CardTitle className="text-lg">Внешний вид</CardTitle>
            <CardDescription>Выберите цветовую схему интерфейса.</CardDescription>
        </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1">
          <Button variant={theme === 'light' ? 'secondary' : 'ghost'} onClick={() => setTheme("light")} className="gap-2">
            <Sun className="w-4 h-4" /> Светлая
          </Button>
          <Button variant={theme === 'dark' ? 'secondary' : 'ghost'} onClick={() => setTheme("dark")} className="gap-2">
            <Moon className="w-4 h-4" /> Темная
          </Button>
          <Button variant={theme === 'system' ? 'secondary' : 'ghost'} onClick={() => setTheme("system")} className="gap-2">
            <Laptop className="w-4 h-4" /> Система
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ##################################################################
// ##                  Компонент смены PIN-кода                    ##
// ##################################################################

const pinSchema = z.object({
  pin: z.string().length(6, "ПИН-код должен состоять ровно из 6 цифр.").regex(/^\d+$/, "ПИН-код может содержать только цифры."),
});
type PinFormData = z.infer<typeof pinSchema>;

const SecuritySettings = ({ userId }: { userId: string }) => {
  const { updatePinCode, isUpdating } = useProfile(userId);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<PinFormData>({
    resolver: zodResolver(pinSchema),
  });

  const handleSavePin = async (data: PinFormData) => {
    await updatePinCode(data.pin);
    reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lock className="text-primary w-5 h-5" />
          Безопасность
        </CardTitle>
        <CardDescription>Установите 6-значный ПИН-код для быстрого входа в систему.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleSavePin)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">Новый ПИН-код</Label>
            <Input
              id="pin"
              type="password" // Тип password для маскировки ввода
              maxLength={6}
              {...register('pin')}
              className="w-full text-center text-2xl font-mono tracking-[1em]" // Увеличиваем расстояние для лучшей читаемости
              placeholder="••••••"
              autoComplete="new-password"
            />
            {errors.pin && <p className="text-xs text-destructive text-center pt-2">{errors.pin.message}</p>}
          </div>
          <Button type="submit" disabled={isUpdating} className="w-full">
            {isUpdating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Обновление...</> : 'Обновить ПИН-код'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
