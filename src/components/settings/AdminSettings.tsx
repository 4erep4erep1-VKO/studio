'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UserPlus, Trash2, Users, Loader2, User, ShieldQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUsers } from '@/hooks/useUsers';
import { User as UserType, UserRole } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ##################################################################
// ##                      Схемы и Типы                            ##
// ##################################################################

const createUserSchema = z.object({
  name: z.string().min(3, 'Имя должно содержать минимум 3 символа'),
  email: z.string().email('Неверный формат email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  role: z.enum(['admin', 'installer'], { required_error: 'Необходимо выбрать роль' }),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

// ##################################################################
// ##                Основной компонент настроек                   ##
// ##################################################################

export function AdminSettings() {
  const { users, isLoading, error, addUser, removeUser } = useUsers();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Управление персоналом
          </CardTitle>
          <CardDescription>Создавайте, просматривайте и удаляйте учетные записи пользователей.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUserForm onAddUser={addUser} />
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Текущие пользователи:</h3>
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : error ? (
              <p className="text-sm text-destructive text-center">{error}</p>
            ) : (
              <UserList users={users} onRemoveUser={removeUser} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ##################################################################
// ##                 Компонент формы создания                     ##
// ##################################################################

const CreateUserForm = ({ onAddUser }: { onAddUser: (data: CreateUserFormData) => Promise<any> }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
        role: 'installer', // Роль по умолчанию
    }
  });

  const onSubmit = async (data: CreateUserFormData) => {
    await onAddUser(data);
    reset(); // Сбрасываем форму только после успешного добавления
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 bg-secondary/20 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" placeholder="Имя Фамилия" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="user@example.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
                <Label htmlFor="password">Пароль</Label>
                <Input id="password" type="password" placeholder="••••••" {...register('password')} />
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1">
                <Label htmlFor="role">Роль</Label>
                <Select onValueChange={(value) => control.setValue('role', value as UserRole)} defaultValue="installer">
                    <SelectTrigger id="role">
                        <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="installer">Монтажник</SelectItem>
                        <SelectItem value="admin">Администратор</SelectItem>
                    </SelectContent>
                </Select>
                 {errors.role && <p className="text-xs text-destructive mt-1">{errors.role.message}</p>}
            </div>
            <div className="md:col-span-2">
                 <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Создание...</> : <><UserPlus className="w-4 h-4 mr-2" />Создать пользователя</>}
                </Button>
            </div>
        </div>
    </form>
  );
};

// ##################################################################
// ##                   Компонент списка пользователей             ##
// ##################################################################

const UserList = ({ users, onRemoveUser }: { users: UserType[], onRemoveUser: (id: string) => void }) => {
    if (users.length === 0) {
        return <p className="text-sm text-muted-foreground text-center py-4">Пользователи еще не созданы.</p>;
    }

    return (
        <div className="space-y-2">
        {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-3 bg-background border rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-md">
                        {user.role === 'admin' ? 'Администратор' : 'Монтажник'}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => onRemoveUser(user.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        ))}
        </div>
  );
};
