"use client";

import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Key, Users, Check, X, History, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInstallers } from '@/hooks/use-installers';
import { useAppSettings } from '@/hooks/use-app-settings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AccessLog } from '@/lib/types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export function AdminSettings() {
  const { installers, addInstaller, removeInstaller } = useInstallers();
  const { settings, updatePin } = useAppSettings();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  
  const [newInstaller, setNewInstaller] = useState('');
  const [newPin, setNewPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  useEffect(() => {
    const loadLogs = () => {
      const stored = localStorage.getItem('local_access_logs');
      if (stored) setLogs(JSON.parse(stored));
    };
    loadLogs();
    window.addEventListener('storage', loadLogs);
    return () => window.removeEventListener('storage', loadLogs);
  }, []);

  const handleAddInstaller = (e: React.FormEvent) => {
    e.preventDefault();
    if (newInstaller.trim()) {
      addInstaller(newInstaller.trim());
      setNewInstaller('');
    }
  };

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length >= 4) {
      updatePin(newPin);
      setNewPin('');
      setIsChangingPin(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl font-headline">Монтажники</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddInstaller} className="flex gap-2">
              <Input 
                placeholder="ФИО монтажника..." 
                value={newInstaller}
                onChange={(e) => setNewInstaller(e.target.value)}
              />
              <Button type="submit" size="icon" className="shrink-0">
                <UserPlus className="h-4 w-4" />
              </Button>
            </form>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {installers.map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg group">
                    <span className="text-sm font-medium">{inst.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeInstaller(inst.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <Key className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl font-headline">Безопасность</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">PIN-код администратора</Label>
                  <p className="text-sm text-muted-foreground">Используется для входа в панель управления</p>
                </div>
                {!isChangingPin && (
                  <Button variant="outline" onClick={() => setIsChangingPin(true)}>Изменить</Button>
                )}
              </div>

              {isChangingPin && (
                <form onSubmit={handleUpdatePin} className="space-y-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label htmlFor="pin">Новый PIN-код (мин. 4 цифры)</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="pin" 
                        type="password" 
                        placeholder="Введите новый код" 
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        autoFocus
                      />
                      <Button type="submit" variant="default" disabled={newPin.length < 4}>
                        <Check className="h-4 w-4 mr-1" /> Сохранить
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setIsChangingPin(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <History className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-xl font-headline">История посещений</CardTitle>
            <CardDescription>Последние действия пользователей (Локально)</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border/50">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.accessedByRole === 'Administrator' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'}`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {log.userName || (log.accessedByRole === 'Administrator' ? 'Администратор' : 'Монтажник')}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{log.accessedByRole}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">
                      {format(new Date(log.timestamp), 'd MMMM yyyy, HH:mm', { locale: ru })}
                    </p>
                  </div>
                </div>
              ))}
              {!logs.length && (
                <div className="text-center py-10 text-muted-foreground">История пуста</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
