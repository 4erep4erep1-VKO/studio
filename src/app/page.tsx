"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, LayoutGrid, LogOut, Settings, Briefcase, Filter, HardHat, Shield, User, Loader2, Menu, X } from 'lucide-react';
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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function App() {
  const [sessionUser, setSessionUser] = useState<{ role: UserRole; id: string; name: string } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    notificationsEnabled: true
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('local_session_user');
    if (storedUser) {
      try {
        setSessionUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('local_session_user');
      }
    }

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
    setIsReady(true);
  }, []);

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
    localStorage.setItem('local_preferences', JSON.stringify(newPrefs));
    applyTheme(newPrefs.theme);
  };

  const handleLogin = (role: UserRole, id: string, name: string) => {
    const userData = { role, id, name };
    setSessionUser(userData);
    localStorage.setItem('local_session_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setSessionUser(null);
    localStorage.removeItem('local_session_user');
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!sessionUser) {
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

function SidebarContent({ 
  role, 
  userName, 
  activeTab, 
  setActiveTab, 
  onLogout 
}: { 
  role: UserRole, 
  userName: string, 
  activeTab: string, 
  setActiveTab: (tab: any) => void,
  onLogout: () => void 
}) {
  const isAdmin = role === 'admin';
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Briefcase className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-headline font-bold text-lg leading-none">Montazhka</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">PRO v 3.0</p>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{isAdmin ? 'Администратор' : 'Монтажник'}</p>
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
    <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Sidebar for desktop */}
      <aside className="w-64 border-r border-border hidden md:flex flex-col bg-card/30 backdrop-blur-xl sticky top-0 h-screen">
        <SidebarContent 
          role={role} 
          userName={userName} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={onLogout} 
        />
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/95 relative">
        <header className="h-20 border-b border-border flex items-center justify-between px-4 sm:px-6 bg-background/50 backdrop-blur-md sticky top-0 z-30 gap-4">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SidebarContent 
                  role={role} 
                  userName={userName} 
                  activeTab={activeTab} 
                  setActiveTab={setActiveTab} 
                  onLogout={onLogout} 
                />
              </SheetContent>
            </Sheet>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск объектов..." 
                className="pl-10 h-10 bg-secondary/30 border-none focus-visible:ring-primary/40 focus-visible:ring-offset-0 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationCenter currentUserId={userId} />
            
            {isAdmin && activeTab === 'orders' && (
              <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 gap-2 h-10 px-3 sm:px-4 shrink-0">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Создать</span>
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={onLogout} 
              className="md:hidden border-border/50 text-muted-foreground h-10 w-10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Content with normal scrolling */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
            {activeTab === 'orders' ? (
              <>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-headline font-bold">
                      {isAdmin ? 'Управление заказами' : 'Мои заказы'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {isAdmin 
                        ? `Всего активных объектов: ${orders.filter(o => o.status === 'В работе').length}`
                        : `Вам доступно объектов: ${filteredOrders.filter(o => o.status === 'В работе').length}`}
                    </p>
                  </div>
                  
                  <Tabs defaultValue="all" className="w-full sm:w-auto" onValueChange={(val: any) => setFilterStatus(val)}>
                    <TabsList className="bg-secondary/30 p-1 h-auto w-full sm:w-auto flex flex-nowrap overflow-x-auto no-scrollbar scroll-smooth">
                      <TabsTrigger value="all" className="flex-1 sm:flex-none px-4 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-semibold whitespace-nowrap">Все</TabsTrigger>
                      <TabsTrigger value="В работе" className="flex-1 sm:flex-none px-4 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-semibold whitespace-nowrap">В работе</TabsTrigger>
                      <TabsTrigger value="Завершен" className="flex-1 sm:flex-none px-4 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-semibold whitespace-nowrap">Завершенные</TabsTrigger>
                      <TabsTrigger value="Отклонен" className="flex-1 sm:flex-none px-4 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-semibold whitespace-nowrap">Отклоненные</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {filteredOrders.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in duration-700">
                    {filteredOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        onEdit={handleEdit} 
                        onStatusChange={(ord) => updateOrder(order.id, ord, userName)} 
                        role={role}
                        currentUserName={userName}
                        currentUserId={userId}
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
                orders={orders}
                userId={userId}
              />
            )}
          </div>
        </div>
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-border bg-card w-[95vw] sm:w-full h-fit max-h-[92vh] flex flex-col">
          <div className="p-4 sm:p-8 overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl sm:text-2xl font-headline text-left">
                {editingOrder ? 'Редактировать заказ' : 'Создать новый заказ'}
              </DialogTitle>
              <DialogDescription className="text-sm text-left">
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
