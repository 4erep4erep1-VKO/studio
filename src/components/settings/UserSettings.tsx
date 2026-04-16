'use client';

import { useState } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ShieldCheck } from 'lucide-react';

export function UserSettings({ userName, userId, role }: any) {
  const [newPin, setNewPin] = useState('');
  const { updatePinCode, isUpdating } = useProfile();

  const handleSavePin = async () => {
    if (!userId) return;
    const result = await updatePinCode(userId, newPin);
    if (result.success) setNewPin('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-4">
      <h2 className="text-2xl font-bold mb-6">Настройки профиля</h2>

      {/* Карточка данных аккаунта */}
      <Card className="bg-card shadow-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="text-green-500 w-5 h-5" /> Данные аккаунта
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Пользователь: <span className="text-foreground font-medium">{userName || 'Не указано'}</span></p>
          <p>Роль: <span className="text-foreground font-medium inline-flex px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-xs mt-1">
            {role === 'admin' ? 'Администратор' : 'Монтажник'}
          </span></p>
        </CardContent>
      </Card>

      {/* Карточка смены ПИН-кода */}
      <Card className="bg-card shadow-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="text-yellow-500 w-5 h-5" /> Безопасность
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Новый ПИН-код (6 цифр)</label>
            <input
              type="text"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-background border border-input rounded-xl p-4 text-center text-3xl font-mono outline-none focus:ring-2 focus:ring-primary transition-all"
              placeholder="000000"
              disabled={isUpdating}
            />
          </div>
          
          <Button
            onClick={handleSavePin}
            disabled={isUpdating || newPin.length < 6}
            className="w-full py-6 text-base font-bold transition-all active:scale-95"
          >
            {isUpdating ? 'СОХРАНЯЕМ...' : 'ОБНОВИТЬ ПИН-КОД'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}