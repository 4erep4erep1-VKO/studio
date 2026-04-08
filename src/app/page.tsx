"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, LayoutGrid, LogOut, Settings, Briefcase, Filter, HardHat, Shield, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useOrders } from '@/hooks/use-orders';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderForm } from '@/components/orders/OrderForm';
import { Order, UserRole, Theme, UserPreferences } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { AdminSettings } from '@/components/settings/AdminSettings';
import { UserSettings } from '@/components/settings/UserSettings';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FirebaseClientProvider, useUser } from '@/firebase';

export default function App() {
  return (
    <FirebaseClientProvider>
      <MainApp />
    </FirebaseClientProvider>
  );
}

function MainApp() {
  const [sessionUser, setSessionUser] = useState<{ role: UserRole; id: string; name: string } | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    notificationsEnabled: true
  });
  
  const { user: firebaseUser, isUserLoading } = useUser();

  useEffect(() => {
    // Синхронизация локальной сессии и Firebase UID
    const storedUser = localStorage.getItem('creative_dispatch_user');
    if (storedUser && firebaseUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setSessionUser(parsed);
      } catch (e) {
        localStorage.removeItem('creative_dispatch_user');
      }
    }

    const storedPrefs = localStorage.getItem('creative_dispatch_prefs');
    if (storedPrefs) {
      try {
        const parsed = JSON.parse(storedPrefs);
        setPreferences(parsed);
        applyTheme(parsed.theme);
      } catch (e) {}
    } else {
      applyTheme('system');
    }
  }, [firebaseUser]);

  const applyTheme = (theme: Theme) => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const actualTheme = theme === 'system' ? systemTheme : theme;
    
    root.classList.remove("light", "dark");
    root.classList.add(actualTheme);
  };

  const handleUpdatePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    localStorage.setItem('creative_dispatch_prefs', JSON.stringify(newPrefs));
    applyTheme(newPrefs.theme);
  };

  const handleLogin = (role: UserRole, id: string, name: string) => {
    const userData = { role, id, name };
    setSessionUser(userData);
    localStorage.setItem('creative_dispatch_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setSessionUser(null);
    localStorage.removeItem('creative_dispatch_user');
  };

  if (isUserLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Если нет юзера в Firebase ИЛИ нет сессии в localStorage — показываем вход
  if (!firebaseUser || !sessionUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <Dashboard 
      role={sessionUser.role} 
      userId={sessionUser.id}
      userName={sessionUser.name} 
      preferences={preferences}
      onUpdatePreferences={handleUpdatePreferences}
      onLogout={handleLogout} 
    />
  );
}

function Dashboard({ 
  role, 
  userId,
  userName, 
  preferences,
  onUpdatePreferences,
  onLogout 
}: { 
  role: UserRole, 
  userId: string,
  userName: string, 
  preferences: UserPreferences,
  onUpdatePreferences: (prefs: UserPreferences) => void,
  onLogout: () => void 
}) {
  const { orders, addOrder, updateOrder } = useOrders(userId, role || '');
  const [activeTab, setActiveTab] = useState<'orders' | 'admin-settings' | 'user-settings'>('orders');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'В работе' | 'Завершен' | 'Отклонен'>('all');

  const isAdmin = role === 'admin';

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.objectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleOpenCreate = () => {
    setEditingOrder(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (order: Order) => {
    if (!isAdmin) return;
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleFormSubmit = (data: Partial<Order>) => {
    if (editingOrder) {
      updateOrder(editingOrder.id, data);
    } else {
      addOrder(data);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <aside className="w-64 border-r border-border hidden md:flex flex-col bg-card/30 backdrop-blur-xl">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-headline font-bold text-lg leading-none">Creative</h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Dispatch</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Button 
            variant={activeTab === 'orders' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-3 transition-all ${activeTab === 'orders' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/5'}`}
            onClick={() => setActiveTab('orders')}
          >
            <LayoutGrid className="w-4 h-4" /> Заказы
          </Button>
          
          <Button 
            variant={activeTab === 'user-settings' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-3 transition-all ${activeTab === 'user-settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/5'}`}
            onClick={() => setActiveTab('user-settings')}
          >
            <User className="w-4 h-4" /> Кабинет
          </Button>
          
          {isAdmin && (
            <Button 
              variant={activeTab === 'admin-settings' ? 'secondary' : 'ghost'} 
              className={`w-full justify-start gap-3 transition-all ${activeTab === 'admin-settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/5'}`}
              onClick={() => setActiveTab('admin-settings')}
            >
              <Settings className="w-4 h-4" /> Администрирование
            </Button>
          )}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-3 p-2 bg-secondary/20 rounded-lg">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isAdmin ? 'bg-primary text-white' : 'bg-accent text-primary'}`}>
              {isAdmin ? <Shield className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{isAdmin ? 'Администратор' : 'Монтажник'}</p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" 
                    onClick={onLogout}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Выйти</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-background/95">
        <header className="h-20 border-b border-border flex items-center justify-between px-6 bg-background/50 backdrop-blur-md sticky top-0 z-10 gap-4">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск по объектам..." 
                className="pl-10 h-10 bg-secondary/30 border-none focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <NotificationCenter currentUserId={userId} />
            
            {isAdmin && activeTab === 'orders' && (
              <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 gap-2 px-3 sm:px-4">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Новый заказ</span>
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={onLogout} 
              className="md:hidden border-border/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-[1400px] mx-auto space-y-8">
            {activeTab === 'orders' ? (
              <>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-headline font-bold">
                      {isAdmin ? 'Управление заказами' : 'Мои заказы'}
                    </h2>
                    <p className="text-muted-foreground">
                      {isAdmin 
                        ? `Всего активных объектов: ${orders.filter(o => o.status === 'В работе').length}`
                        : `Вам назначено объектов: ${filteredOrders.filter(o => o.status === 'В работе').length}`}
                    </p>
                  </div>
                  
                  <Tabs defaultValue="all" className="w-auto" onValueChange={(val: any) => setFilterStatus(val)}>
                    <TabsList className="bg-secondary/30 p-1 h-auto overflow-x-auto">
                      <TabsTrigger value="all" className="px-4 py-2 text-xs uppercase tracking-wider font-semibold">Все</TabsTrigger>
                      <TabsTrigger value="В работе" className="px-4 py-2 text-xs uppercase tracking-wider font-semibold">В работе</TabsTrigger>
                      <TabsTrigger value="Завершен" className="px-4 py-2 text-xs uppercase tracking-wider font-semibold">Завершенные</TabsTrigger>
                      <TabsTrigger value="Отклонен" className="px-4 py-2 text-xs uppercase tracking-wider font-semibold">Отклоненные</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {filteredOrders.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-700">
                    {filteredOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        onEdit={handleEdit} 
                        onStatusChange={(ord) => updateOrder(ord.id, { status: ord.status })} 
                        role={role}
                        currentUserName={userName}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                    <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center text-muted-foreground mb-4">
                      <Filter className="w-10 h-10" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-headline font-semibold">Заказы не найдены</h3>
                      <p className="text-muted-foreground max-w-sm">Попробуйте изменить параметры поиска или фильтрации.</p>
                    </div>
                  </div>
                )}
              </>
            ) : activeTab === 'admin-settings' ? (
              <AdminSettings />
            ) : (
              <UserSettings 
                preferences={preferences} 
                onUpdatePreferences={onUpdatePreferences} 
                userName={userName}
              />
            )}
          </div>
        </div>
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-border bg-card">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-headline">
                {editingOrder ? 'Редактировать заказ' : 'Создать новый заказ'}
              </DialogTitle>
              <DialogDescription>
                Заполните детали объекта и назначьте исполнителя.
              </DialogDescription>
            </DialogHeader>
            <OrderForm 
              initialData={editingOrder} 
              onSubmit={handleFormSubmit} 
              onCancel={() => setIsModalOpen(false)} 
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}