"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, Search, LayoutGrid, LogOut, Settings, Briefcase, Filter, 
  HardHat, Shield, User, Loader2, Menu, X, AlertCircle, 
  BarChart3, CheckCircle, Clock, Users 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useOrders } from '@/hooks/use-orders';
import { useAuth } from '@/hooks/use-auth';
import { OrderCardSkeleton } from '@/components/orders/OrderCardSkeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderForm } from '@/components/orders/OrderForm';
import { Order, Theme, UserPreferences } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminSettings } from '@/components/settings/AdminSettings';
import { UserSettings } from '@/components/settings/UserSettings';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { signOut } from '@/lib/auth';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInstallers } from '@/hooks/use-installers';

export default function App() {
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
    setIsOnline(navigator.onLine);
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
      } else {
        setIsReady(true);
      }
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.remove("light", "dark");
      root.classList.add(systemTheme);
    }
  }, []);

  const handleUpdatePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      const actualTheme = newPrefs.theme === 'system' 
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : newPrefs.theme;
      root.classList.remove("light", "dark");
      root.classList.add(actualTheme);
    }
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

  if (!user) return null;

  return (
    <Dashboard 
      role={role}
      userId={user.id}
      userName={user.email || 'Пользователь'}
      preferences={preferences}
      onUpdatePreferences={handleUpdatePreferences}
      onLogout={handleLogout}
      isOnline={isOnline}
    />
  );
}

function SidebarContent({ role, userName, activeTab, setActiveTab, onLogout }: any) {
  const isAdmin = role === 'admin';
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Briefcase className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none">Montazhka</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">PRO v 3.0</p>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Button variant={activeTab === 'orders' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setActiveTab('orders')}>
          <LayoutGrid className="w-4 h-4" /> Заказы
        </Button>
        <Button variant={activeTab === 'user-settings' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setActiveTab('user-settings')}>
          <User className="w-4 h-4" /> Кабинет
        </Button>
        {isAdmin && (
          <Button variant={activeTab === 'admin-settings' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setActiveTab('admin-settings')}>
            <Settings className="w-4 h-4" /> Администрирование
          </Button>
        )}
      </nav>
      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-3 p-2 bg-secondary/20 rounded-lg">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-white">
            {isAdmin ? <Shield className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{userName}</p></div>
          <Button variant="ghost" size="icon" onClick={onLogout}><LogOut className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ role, userId, userName, preferences, onUpdatePreferences, onLogout, isOnline }: any) {
  const { orders, isLoading, error, addOrder, updateOrder } = useOrders(userId, role || '');
  const [activeTab, setActiveTab] = useState<'orders' | 'admin-settings' | 'user-settings'>('orders');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.objectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleFormSubmit = async (data: Partial<Order>) => {
    if (editingOrder) {
      await updateOrder(editingOrder.id, data);
    } else {
      await addOrder(data);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 border-r border-border hidden md:flex flex-col bg-card/30 sticky top-0 h-screen">
        <SidebarContent role={role} userName={userName} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} />
      </aside>
      <main className="flex-1 flex flex-col min-w-0 relative">
        <ConnectionStatus isOnline={isOnline} />
        <header className="h-20 border-b border-border flex items-center justify-between px-6 bg-background/50 sticky top-0 z-30">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск объектов..." className="pl-10 h-10 bg-secondary/30 border-none w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            {/* ПЕРЕДАЕМ ДАННЫЕ В КОЛОКОЛЬЧИК */}
            <NotificationCenter currentUserId={userId} role={role} orders={orders} />
            
            {role === 'admin' && activeTab === 'orders' && (
              <Button onClick={() => { setEditingOrder(undefined); setIsModalOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Создать
              </Button>
            )}
          </div>
        </header>
        <div className="flex-1 p-6">
          {activeTab === 'orders' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isLoading ? <OrderCardSkeleton /> : filteredOrders.map(order => (
                <OrderCard key={order.id} order={order} role={role} onEdit={(ord) => { setEditingOrder(ord); setIsModalOpen(true); }} onStatusChange={(ord) => updateOrder(order.id, ord, userName)} currentUserId={userId} currentUserName={userName} />
              ))}
            </div>
          ) : activeTab === 'admin-settings' ? <AdminSettings /> : <UserSettings preferences={preferences} onUpdatePreferences={onUpdatePreferences} userName={userName} orders={orders} userId={userId} role={role} />}
        </div>
      </main>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-8">
          <DialogHeader><DialogTitle>{editingOrder ? 'Редактировать заказ' : 'Создать заказ'}</DialogTitle></DialogHeader>
          <OrderForm initialData={editingOrder} onSubmit={handleFormSubmit} onCancel={() => setIsModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}