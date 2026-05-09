'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Loader2, Megaphone, 
  Users, LayoutDashboard, Search, Bell, 
  Trash2, UserPlus, CheckCircle2, Clock, 
  BarChart3, X, LogOut, ShieldCheck, Download
} from 'lucide-react';
import { Order } from '@/lib/types';
import OrderForm from '@/components/orders/OrderForm';
import { OrderCard } from '@/components/orders/OrderCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

  const [view, setView] = useState<'orders' | 'staff'>('orders');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'general' | 'completed' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [notifications, setNotifications] = useState<{id: string, text: string, time: string}[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    const savedAuth = localStorage.getItem('adminAuth');
    const savedId = localStorage.getItem('adminId');
    if (savedAuth === 'true' && savedId) {
      setIsAuthenticated(true);
      setCurrentUserId(savedId);
    }
  }, []);

  const fetchAllData = async () => {
    try {
      const { data: rawOrders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      const { data: rawProfiles } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });

      if (rawProfiles) setProfiles(rawProfiles);

      const mergedOrders = (rawOrders || []).map((order: any) => {
        const assignedProfile = rawProfiles?.find(p => p.id === order.assigned_to);
        const creatorProfile = rawProfiles?.find(p => p.id === order.created_by);
        
        return {
          ...order,
          profiles: assignedProfile ? { 
            full_name: assignedProfile.full_name, 
            telegram_chat_id: assignedProfile.telegram_chat_id 
          } : null,
          creator_name: creatorProfile ? creatorProfile.full_name : 'Админ'
        };
      });

      setOrders(mergedOrders);
    } catch (error: any) {
      console.error("Ошибка загрузки:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
      const channel = supabase
        .channel('global_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          const text = payload.eventType === 'INSERT' ? 'Создан новый заказ' : 'Заказ обновлен';
          addNotification(text);
          fetchAllData();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isAuthenticated]);

  const addNotification = (text: string) => {
    const newNotif = { id: Math.random().toString(), text, time: new Date().toLocaleTimeString() };
    setNotifications(prev => [newNotif, ...prev].slice(0, 5));
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .eq('pin_code', password)
        .single();

      if (data) {
        setIsAuthenticated(true);
        setCurrentUserId(data.id);
        localStorage.setItem('adminAuth', 'true');
        localStorage.setItem('adminId', data.id);
        toast({ title: `Вход выполнен: ${data.full_name}` });
      } else {
        alert('Ошибка доступа: Неверный ПИН или недостаточно прав');
      }
    } catch (err) {
      alert('Ошибка при проверке данных');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('adminId');
    setIsAuthenticated(false);
    setCurrentUserId(null);
    setPassword('');
  };

  const notifyTelegram = async (chatId: string, text: string) => {
    const token = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
    });
  };

  const handleDelete = async (id: string, chatId: string | null, title: string, status: string) => {
    if (!confirm(`Удалить заказ "${title}"?`)) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (!error) {
      toast({ title: "Заказ удален" });
      if (chatId && status !== 'completed') {
        await notifyTelegram(chatId, `⚠️ Заказ отменен админом: ${title}`);
      }
      fetchAllData();
    }
  };

  const handleStartWork = async (id: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'in_progress' }).eq('id', id);
      if (error) throw error;
      toast({ title: "Заказ переведен в работу!" });
      fetchAllData();
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', id);
      if (error) throw error;
      toast({ title: "Заказ завершен!" });
      fetchAllData();
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const handleTransferToInstallation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          department: 'installation', 
          status: 'new', 
          assigned_to: null, 
          is_general: true 
        })
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Заказ передан монтажникам!" });
      fetchAllData();
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const executeExport = () => {
    let filteredForExport = orders;
    if (exportStart) {
      const start = new Date(exportStart);
      start.setHours(0, 0, 0, 0);
      filteredForExport = filteredForExport.filter(o => new Date(o.created_at) >= start);
    }
    if (exportEnd) {
      const end = new Date(exportEnd);
      end.setHours(23, 59, 59, 999);
      filteredForExport = filteredForExport.filter(o => new Date(o.created_at) <= end);
    }
    if (filteredForExport.length === 0) {
      alert("Нет заказов за выбранный период");
      return;
    }
    const dataToExport = filteredForExport.map((o: any) => ({
      'Объект': o.title,
      'Описание': o.description || '-',
      'Статус': o.status === 'completed' ? 'Завершен' : o.status === 'in_progress' ? 'В работе' : 'Новый',
      'Дедлайн': o.deadline ? new Date(o.deadline).toLocaleDateString() : '-',
      'Отдел': o.department === 'installation' ? 'Монтаж' : 'Печать',
      'Тип заказа': o.is_general ? 'Общий' : 'Личный',
      'Исполнитель': o.profiles?.full_name || 'Не назначен',
      'Создал (Админ)': o.creator_name || 'Система',
      'Дата создания': new Date(o.created_at).toLocaleDateString()
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Заказы");
    let fileName = "Отчет_Монтажка";
    if (exportStart && exportEnd) fileName += `_${exportStart}_по_${exportEnd}`;
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    toast({ title: "Excel файл скачан!" });
    setIsExportModalOpen(false);
  };

  const handleBroadcast = async () => {
    const msg = prompt("Введите текст объявления для всех сотрудников:");
    if (!msg) return;
    setLoading(true);
    profiles.forEach(p => p.telegram_chat_id && notifyTelegram(p.telegram_chat_id, `📢 <b>ОБЪЯВЛЕНИЕ:</b>\n\n${msg}`));
    setLoading(false);
    toast({ title: "Рассылка запущена" });
  };

  const addStaff = async () => {
    const name = prompt("ФИО сотрудника:");
    if (!name) return;
    const pin = prompt("ПИН-код:");
    if (!pin) return;
    const roleChoice = prompt("Роль: 1-Монтажник, 2-Админ", "1");
    const role = roleChoice === "2" ? "admin" : "installer";
    const { error } = await supabase.from('profiles').insert([{ id: crypto.randomUUID(), full_name: name, pin_code: pin, role: role }]);
    if (error) alert(error.message); else fetchAllData();
  };

  const deleteStaff = async (id: string) => {
    if (confirm("Удалить профиль?")) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (!error) fetchAllData();
    }
  };

  const toggleRole = async (userId: string, field: string, currentValue: boolean) => {
    const { error } = await supabase.from('profiles').update({ [field]: !currentValue }).eq('id', userId);
    if (!error) fetchAllData();
  };

  const filteredOrders = orders.filter((o: any) => {
    const matchesSearch = (o.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'active') return o.status === 'new' || o.status === 'in_progress';
    if (activeTab === 'completed') return o.status === 'completed';
    if (activeTab === 'general') return o.is_general === true;
    return true;
  });

  const stats = {
    total: orders.length,
    active: orders.filter(o => o.status !== 'completed').length,
    done: orders.filter(o => o.status === 'completed').length
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="bg-card p-8 rounded-2xl border border-border w-96 text-center">
          <h2 className="text-2xl font-bold mb-6 text-secondary">Montazhka PRO</h2>
          <input type="password" placeholder="ПИН-код" className="w-full p-3 bg-background border border-border rounded-lg mb-4 text-center" onKeyDown={e => e.key === 'Enter' && handleLogin()} onChange={e => setPassword(e.target.value)} />
          <Button onClick={handleLogin} disabled={isLoggingIn} className="w-full bg-primary h-12">{isLoggingIn ? '...' : 'Войти'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen text-foreground transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        
        {/* СТАТИСТИКА */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg"><BarChart3 className="text-primary" /></div>
            <div><p className="text-xs text-muted-foreground font-bold">Заказы</p><p className="text-2xl font-bold">{stats.total}</p></div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-lg"><Clock className="text-amber-500" /></div>
            <div><p className="text-xs text-muted-foreground font-bold">В работе</p><p className="text-2xl font-bold">{stats.active}</p></div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg"><CheckCircle2 className="text-emerald-500" /></div>
            <div><p className="text-xs text-muted-foreground font-bold">Сделано</p><p className="text-2xl font-bold">{stats.done}</p></div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-4 relative">
             <div className="p-3 bg-secondary/10 rounded-lg cursor-pointer" onClick={() => setShowNotifs(!showNotifs)}>
                <Bell className={notifications.length > 0 ? "text-secondary animate-pulse" : "text-muted-foreground"} />
             </div>
             <div className="flex-grow">
                <p className="text-xs text-muted-foreground font-bold">Система</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Активна</p>
                  <LogOut onClick={handleLogout} className="w-5 h-5 text-destructive cursor-pointer" title="Выйти" />
                </div>
             </div>
          </div>
        </div>

        {/* ПЕРЕКЛЮЧАТЕЛИ И КНОПКИ */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div className="flex bg-card p-1 rounded-xl border border-border">
            <button onClick={() => setView('orders')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'orders' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Заказы</button>
            <button onClick={() => setView('staff')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'staff' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Команда</button>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-600 text-white font-bold">Excel Отчет</Button>
            <Button onClick={handleBroadcast} className="bg-secondary text-secondary-foreground font-bold">Объявление</Button>
            <Button onClick={() => { setEditingOrderId(null); setIsModalOpen(true); }} className="bg-primary text-primary-foreground font-bold">Новый объект</Button>
          </div>
        </div>

        {view === 'orders' ? (
          <>
            <div className="flex flex-wrap gap-4 mb-6">
              <input placeholder="Поиск..." className="flex-grow max-w-md p-2 bg-card border border-border rounded-lg outline-none focus:border-primary" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <div className="flex gap-2 bg-card p-1 rounded-lg border border-border">
                {['active', 'general', 'completed', 'all'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${activeTab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    {t === 'active' ? '🔥 Актив' : t === 'general' ? '🌍 Общие' : t === 'completed' ? '✅ Архив' : '📦 Все'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <Loader2 className="animate-spin mx-auto mt-20" /> : (
              <div className="flex gap-6 overflow-x-auto pb-6 items-start">
                {/* КОЛОНКА 1: НОВЫЕ */}
                <div className="min-w-[320px] flex-1 bg-muted/20 border border-border p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold border-b border-border pb-2 flex justify-between">🆕 Новые <span>{filteredOrders.filter(o => o.status === 'new').length}</span></h3>
                  {filteredOrders.filter(o => o.status === 'new').map((o: any) => (
                    <OrderCard key={o.id} order={o} onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} onDelete={handleDelete} onComplete={handleComplete} onStartWork={handleStartWork} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>
                {/* КОЛОНКА 2: В РАБОТЕ */}
                <div className="min-w-[320px] flex-1 bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold border-b border-amber-500/20 pb-2 flex justify-between">⏳ В работе <span>{filteredOrders.filter(o => o.status === 'in_progress').length}</span></h3>
                  {filteredOrders.filter(o => o.status === 'in_progress').map((o: any) => (
                    <OrderCard key={o.id} order={o} onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} onDelete={handleDelete} onComplete={handleComplete} onStartWork={handleStartWork} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>
                {/* КОЛОНКА 3: ГОТОВО */}
                <div className="min-w-[320px] flex-1 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold border-b border-emerald-500/20 pb-2 flex justify-between">✅ Готово <span>{filteredOrders.filter(o => o.status === 'completed').length}</span></h3>
                  {filteredOrders.filter(o => o.status === 'completed').map((o: any) => (
                    <OrderCard key={o.id} order={o} onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} onDelete={handleDelete} onComplete={handleComplete} onStartWork={handleStartWork} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {profiles.map(p => (
              <div key={p.id} className="bg-card border border-border p-5 rounded-xl shadow-sm">
                <div className="flex justify-between mb-4">
                   <h3 className="font-bold">{p.full_name} {p.role === 'admin' && '🛡️'}</h3>
                   <button onClick={() => deleteStaff(p.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={p.can_design} onChange={() => toggleRole(p.id, 'can_design', p.can_design)} /> 🎨 Дизайн</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={p.can_print} onChange={() => toggleRole(p.id, 'can_print', p.can_print)} /> 🖨 Печать</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={p.can_install} onChange={() => toggleRole(p.id, 'can_install', p.can_install)} /> 🛠 Монтаж</label>
                </div>
              </div>
            ))}
            <Button onClick={addStaff} className="h-full border-dashed border-2 bg-transparent text-muted-foreground">+ Добавить сотрудника</Button>
          </div>
        )}

        {/* МОДАЛКИ */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-xl bg-card border-border text-foreground p-0 shadow-2xl overflow-hidden">
            <DialogHeader className="p-6 pb-0"><DialogTitle className="text-xl font-bold uppercase italic tracking-tight text-secondary">Параметры объекта</DialogTitle></DialogHeader>
            <OrderForm orderId={editingOrderId} onSave={() => { setIsModalOpen(false); fetchAllData(); }} creatorId={currentUserId || ''} />
          </DialogContent>
        </Dialog>

        <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
          <DialogContent className="max-w-sm bg-card border-border text-foreground shadow-2xl">
            <DialogHeader><DialogTitle className="text-lg font-bold text-secondary">Выгрузка в Excel</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div><label className="block text-xs font-bold text-muted-foreground uppercase mb-1">С даты:</label><input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full p-2 bg-background border border-border rounded outline-none" /></div>
              <div><label className="block text-xs font-bold text-muted-foreground uppercase mb-1">По дату:</label><input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full p-2 bg-background border border-border rounded outline-none" /></div>
              <Button onClick={executeExport} className="w-full bg-emerald-600 text-white font-bold mt-2">Скачать таблицу</Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}