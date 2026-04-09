"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, LogOut, Settings, Briefcase, Shield, BarChart3, CheckCircle, Clock, Users, Loader2, Menu, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrders } from '@/hooks/use-orders';
import { useAuth } from '@/hooks/use-auth';
import { useInstallers } from '@/hooks/use-installers';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderCardSkeleton } from '@/components/orders/OrderCardSkeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { signOut } from '@/lib/auth';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { Order, UserPreferences } from '@/lib/types';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, getRole } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    notificationsEnabled: true
  });

  const role = getRole();
  const isAdmin = role === 'admin';

  useEffect(() => {
    // Проверяем начальное состояние интернета
    setIsOnline(navigator.onLine);

    // Слушаем события online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isAdmin) {
        router.push('/');
      } else {
        setIsReady(true);
      }
    }
  }, [user, isAuthLoading, isAdmin, router]);

  useEffect(() => {
    const storedPrefs = localStorage.getItem('local_preferences');
    if (storedPrefs) {
      try {
        const parsed = JSON.parse(storedPrefs);
        setPreferences(parsed);
        applyTheme(parsed.theme);
      } catch (e) {}
    } else {
      applyTheme('system');
    }
  }, []);

  const applyTheme = (theme: UserPreferences['theme']) => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const actualTheme = theme === 'system' ? systemTheme : theme;

    root.classList.remove("light", "dark");
    root.classList.add(actualTheme);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isAuthLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <AdminDashboardContent
      userId={user.id}
      userName={user.email || 'Администратор'}
      preferences={preferences}
      onLogout={handleLogout}
      isOnline={isOnline}
    />
  );
}

function AdminDashboardContent({
  userId,
  userName,
  preferences,
  onLogout,
  isOnline
}: {
  userId: string;
  userName: string;
  preferences: UserPreferences;
  onLogout: () => void;
  isOnline: boolean;
}) {
  const { orders, isLoading, error, updateOrder } = useOrders(userId, 'admin');
  const { installers } = useInstallers();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'В работе' | 'Завершен' | 'Отклонен'>('all');
  const [filterInstaller, setFilterInstaller] = useState<string>('all');

  // Расчет статистики в реальном времени
  const stats = {
    total: orders.length,
    inProgress: orders.filter(o => o.status === 'В работе').length,
    completedToday: orders.filter(o => {
      const today = new Date().toDateString();
      const orderDate = new Date(o.updatedAt).toDateString();
      return o.status === 'Завершен' && orderDate === today;
    }).length
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.objectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesInstaller = filterInstaller === 'all' || order.installerId === filterInstaller;
    return matchesSearch && matchesStatus && matchesInstaller;
  });

  const handleStatusChange = (order: Order) => {
    // Обновляем статус заказа
    updateOrder(order.id, { status: order.status, installerId: order.installerId });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border hidden md:flex flex-col bg-card/30 backdrop-blur-xl sticky top-0 h-screen">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-headline font-bold text-lg leading-none">Админ-панель</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Montazhka PRO</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <Button
              variant="secondary"
              className="w-full justify-start gap-3 bg-primary/10 text-primary"
            >
              <BarChart3 className="w-4 h-4" /> Панель управления
            </Button>
          </nav>

          <div className="p-4 border-t border-border mt-auto">
            <div className="flex items-center gap-3 p-2 bg-secondary/20 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-[10px] text-muted-foreground truncate">Администратор</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={onLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/95 relative">
        <ConnectionStatus isOnline={isOnline} />

        {/* Header */}
        <header className="h-20 border-b border-border flex items-center justify-between px-4 sm:px-6 bg-background/50 backdrop-blur-md sticky top-0 z-30 gap-4">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b border-border flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="font-headline font-bold text-lg leading-none">Админ-панель</h1>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Montazhka PRO</p>
                    </div>
                  </div>
                  <div className="p-4 border-t border-border mt-auto">
                    <div className="flex items-center gap-3 p-2 bg-secondary/20 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate">{userName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">Администратор</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={onLogout}
                      >
                        <LogOut className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <h2 className="font-headline font-semibold text-lg">Панель управления</h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/'}
              className="hidden sm:flex"
            >
              ← К заказам
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-6 space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Всего заказов
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  В работе
                </CardTitle>
                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.inProgress}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                  Выполнено за сегодня
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.completedToday}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Управление заказами
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Поиск по названию объекта..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Статус</label>
                  <Tabs value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="all">Все</TabsTrigger>
                      <TabsTrigger value="В работе">В работе</TabsTrigger>
                      <TabsTrigger value="Завершен">Завершен</TabsTrigger>
                      <TabsTrigger value="Отклонен">Отклонен</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="sm:w-64">
                  <label className="text-sm font-medium mb-2 block">Исполнитель</label>
                  <Select value={filterInstaller} onValueChange={setFilterInstaller}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите исполнителя" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все исполнители</SelectItem>
                      {installers.map((installer) => (
                        <SelectItem key={installer.id} value={installer.id}>
                          {installer.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="general">Общий заказ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders List */}
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <OrderCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    {orders.length === 0 ? 'Нет заказов' : 'Нет заказов по фильтру'}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center">
                    {orders.length === 0
                      ? 'Создайте первый заказ для начала работы'
                      : 'Попробуйте изменить параметры фильтрации'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onEdit={() => {}} // Админ может редактировать через интерфейс
                    onStatusChange={handleStatusChange}
                    role="admin"
                    currentUserName={userName}
                    currentUserId={userId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}