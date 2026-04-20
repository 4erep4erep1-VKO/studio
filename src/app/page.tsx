'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, Search, LayoutGrid, LogOut, Settings, Briefcase, 
  HardHat, Shield, User, Loader2, WifiOff, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOrders } from '@/hooks/use-orders';
import { useAuth } from '@/hooks/use-auth';
import { OrderCardSkeleton } from '@/components/orders/OrderCardSkeleton';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderForm } from '@/components/orders/OrderForm';
import { Order } from '@/lib/types';
import { AdminSettings } from '@/components/settings/AdminSettings';
import { UserSettings } from '@/components/settings/UserSettings';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { signOut } from '@/lib/auth';
import { ConnectionStatus } from '@/components/ConnectionStatus';

// ##################################################################
// ##                   Компонент-обертка App                      ##
// ##################################################################

export default function App() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, getRole } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  const role = getRole();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    if (!isAuthLoading) {
      if (!user) {
        router.push('/login');
      } else {
        setIsReady(true);
      }
    }
    
    return () => {
      if (typeof window !== 'undefined') {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      }
    };
  }, [user, isAuthLoading, router]);

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
      onLogout={handleLogout}
      isOnline={isOnline}
    />
  );
}

// ##################################################################
// ##                     Основной Dashboard                       ##
// ##################################################################

function Dashboard({ role, userId, userName, onLogout, isOnline }: any) {
  const { orders, isLoading, error, refetchOrders, addOrder, updateOrder } = useOrders(userId, role);
  const [activeTab, setActiveTab] = useState<'orders' | 'admin-settings' | 'user-settings'>('orders');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrders = orders.filter(order => 
    order.objectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFormSubmit = async (data: Partial<Order>) => {
    try {
      if (editingOrder) {
        await updateOrder(editingOrder.id, data);
      } else {
        await addOrder(data);
      }
      setIsModalOpen(false);
      setEditingOrder(undefined);
    } catch (error) {
      // Errors are handled by the useOrders hook
    }
  };

  const openCreateModal = () => {
    setEditingOrder(undefined);
    setIsModalOpen(true);
  }

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  }

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
            <NotificationCenter currentUserId={userId} role={role} orders={orders} />
            {role === 'admin' && activeTab === 'orders' && (
              <Button onClick={openCreateModal} className="gap-2">
                <Plus className="h-4 w-4" /> Создать
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 p-6">
            {isLoading && !error ? (
                <OrderGridSkeleton />
            ) : error ? (
                <ErrorState message={error} onRetry={() => refetchOrders(true)} />
            ) : (
                <TabContent 
                    activeTab={activeTab} 
                    orders={filteredOrders} 
                    role={role} 
                    userId={userId}
                    userName={userName}
                    onEditOrder={openEditModal}
                    onStatusChange={(...args) => updateOrder(args[0], args[1])}
                />
            )}
        </div>
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-8">
          <DialogHeader><DialogTitle>{editingOrder ? 'Редактировать заказ' : 'Создать заказ'}</DialogTitle></DialogHeader>
          <OrderForm initialData={editingOrder} onSubmit={handleFormSubmit} onCancel={() => setIsModalOpen(false)} isOnline={isOnline} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ... (rest of the components are unchanged)

function TabContent({ activeTab, ...props }: any) {
    switch (activeTab) {
        case 'orders':
            return <OrderGrid {...props} />;
        case 'admin-settings':
            return <AdminSettings />;
        case 'user-settings':
            return <UserSettings userId={props.userId} userName={props.userName} role={props.role} orders={props.orders} />;
        default:
            return null;
    }
}

function OrderGrid({ orders, role, onEditOrder, onStatusChange, userId, userName }: any) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {orders.map(order => (
                <OrderCard 
                    key={order.id} 
                    order={order} 
                    role={role} 
                    onEdit={onEditOrder} 
                    onStatusChange={(...args) => onStatusChange(order.id, ...args)} 
                    currentUserId={userId} 
                    currentUserName={userName} 
                />
            ))}
        </div>
    );
}

function OrderGridSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <OrderCardSkeleton key={i} />)}
        </div>
    );
}

function ErrorState({ message, onRetry }: { message: string, onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <WifiOff className="w-16 h-16 text-destructive mb-4" />
            <h3 className="text-xl font-semibold mb-2">Ошибка при загрузке данных</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">{message}</p>
            <Button onClick={onRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Повторить
            </Button>
        </div>
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
