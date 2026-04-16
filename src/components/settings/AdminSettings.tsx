"use client";

import React, { useState } from 'react';
import { UserPlus, Trash2, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInstallers } from '@/hooks/use-installers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminSettings() {
  const { installers, addInstaller, removeInstaller, isLoading } = useInstallers();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      alert('Минимум 6 символов для пароля!');
      return;
    }
    await addInstaller(formData);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Управление персоналом
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8 p-4 bg-secondary/10 rounded-lg border border-border/50">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Имя</Label>
              <Input placeholder="Имя Фамилия" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Email</Label>
              <Input type="email" placeholder="mail@pro.kz" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Пароль</Label>
              <Input type="password" placeholder="6+ знаков" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </form>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Список в базе:</h3>
            {installers.map((inst) => (
              <div key={inst.id} className="flex items-center justify-between p-3 bg-background border rounded-lg group">
                <div>
                  <p className="font-bold text-sm">{inst.name}</p>
                  <p className="text-xs text-muted-foreground">{inst.email}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeInstaller(inst.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}