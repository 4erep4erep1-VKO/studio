"use client";

import React, { useState } from 'react';
import { Plus, Search, LayoutGrid, List as ListIcon, LogOut, Settings, Briefcase, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useOrders } from '@/hooks/use-orders';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderForm } from '@/components/orders/OrderForm';
import { Order } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  const { orders, addOrder, updateOrder } = useOrders();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'В работе' | 'Завершен'>('all');

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.objectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        order.installer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleOpenCreate = () => {
    setEditingOrder(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleFormSubmit = (data: Order) => {
    if (editingOrder) {
      updateOrder(data);
    } else {
      addOrder(data);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar - Desktop Only */}
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
          <Button variant="secondary" className="w-full justify-start gap-3 bg-primary/10 text-primary">
            <LayoutGrid className="w-4 h-4" /> Заказы
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
            <User className="w-4 h-4" /> Монтажники
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
            <Settings className="w-4 h-4" /> Настройки
          </Button>
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-primary text-xs font-bold">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Admin Account</p>
              <p className="text-[10px] text-muted-foreground truncate">admin@creative.agency</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/95">
        {/* Header */}
        <header className="h-20 border-b border-border flex items-center justify-between px-6 bg-background/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск по объектам или монтажникам..." 
                className="pl-10 h-10 bg-secondary/30 border-none focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 ml-6">
            <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 gap-2">
              <Plus className="h-4 w-4" /> Новый заказ
            </Button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-[1400px] mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-3xl font-headline font-bold">Управление заказами</h2>
                <p className="text-muted-foreground">Всего активных объектов: {orders.filter(o => o.status === 'В работе').length}</p>
              </div>
              
              <Tabs defaultValue="all" className="w-auto" onValueChange={(val: any) => setFilterStatus(val)}>
                <TabsList className="bg-secondary/30 p-1 h-auto">
                  <TabsTrigger value="all" className="px-4 py-2 text-xs uppercase tracking-wider font-semibold">Все</TabsTrigger>
                  <TabsTrigger value="В работе" className="px-4 py-2 text-xs uppercase tracking-wider font-semibold">В работе</TabsTrigger>
                  <TabsTrigger value="Завершен" className="px-4 py-2 text-xs uppercase tracking-wider font-semibold">Завершенные</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {filteredOrders.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredOrders.map(order => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onEdit={handleEdit} 
                    onStatusChange={updateOrder} 
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
                  <p className="text-muted-foreground max-w-sm">Попробуйте изменить параметры поиска или создайте новый заказ для начала работы.</p>
                </div>
                <Button variant="outline" onClick={handleOpenCreate} className="mt-4">
                  Создать первый заказ
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Order Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-border bg-card">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-headline">
                {editingOrder ? 'Редактировать заказ' : 'Создать новый заказ'}
              </DialogTitle>
              <DialogDescription>
                Заполните детали объекта и назначьте исполнителя. Используйте AI для быстрой оценки сложности.
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

// Minimal stub for Lucide icons missing in proposal
const User = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
