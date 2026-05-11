'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Loader2, Megaphone, 
  Users, User, LayoutDashboard, Search, Bell, 
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
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);

  const [view, setView] = useState<'orders' | 'staff'>('orders');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'general' | 'completed' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  const [notifications, setNotifications] = useState<{id: string, text: string, time: string}[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    const savedAuth = localStorage.getItem('adminAuth');
    const savedId = localStorage.getItem('adminId');
    const savedIsAdmin = localStorage.getItem('isAdmin') === 'true';
    if (savedAuth === 'true' && savedId) {
      setIsAuthenticated(true);
      setCurrentUserId(savedId);
      setIsAdmin(savedIsAdmin);
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
        .eq('pin_code', password)
        .single();

      if (data && (data.role === 'admin' || data.can_design)) {
        const adminFlag = data.role === 'admin';
        setIsAuthenticated(true);
        setIsAdmin(adminFlag);
        setCurrentUserId(data.id);
        localStorage.setItem('adminAuth', 'true');
        localStorage.setItem('adminId', data.id);
        localStorage.setItem('isAdmin', String(adminFlag));
        toast({ title: `Вход выполнен: ${data.full_name}` });
      } else {
        alert('Ошибка доступа: Неверный ПИН или нет прав на создание заказов');
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
    localStorage.removeItem('isAdmin');
    setIsAuthenticated(false);
    setIsAdmin(false);
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

  const openAssignModal = (id: string) => {
    setAssigningOrderId(id);
    setIsAssignModalOpen(true);
  };

  const executeAssign = async (workerId: string) => {
    if (!assigningOrderId) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'in_progress', 
          assigned_to: workerId, 
          is_general: false 
        })
        .eq('id', assigningOrderId);
      if (error) throw error;

      const worker = profiles.find(p => p.id === workerId);
      const order = orders.find(o => o.id === assigningOrderId);
      if (worker?.telegram_chat_id) {
        await notifyTelegram(
          worker.telegram_chat_id,
          `⚠️ <b>ВАМ НАЗНАЧЕН ЗАКАЗ!</b>\n\n📍 Объект: <b>${order?.title}</b>\n\nАдминистратор назначил вас исполнителем. Заказ добавлен в раздел «📦 Мои заказы».`
        );
      }

      toast({ title: "Исполнитель назначен!" });
      setIsAssignModalOpen(false);
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
    const GROUP_ID = "-1003935954352"; 
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
      
      const orderTitle = orders.find(o => o.id === id)?.title || 'Неизвестный объект';
      const text = `🛠 <b>ПЕРЕДАНО МОНТАЖНИКАМ!</b>\n\nНапечатанный баннер готов:\n📍 Объект: <b>${orderTitle}</b>\n\nЗайдите в раздел «🆓 Свободные заказы» в боте.`;
      await notifyTelegram(GROUP_ID, text);

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
                  <LogOut onClick={handleLogout} className="w-5 h-5 text-destructive cursor-pointer" aria-label="Выйти" />
                </div>
             </div>
          </div>
        </div>

        {/* ПЕРЕКЛЮЧАТЕЛИ И КНОПКИ */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div className="flex bg-card p-1 rounded-xl border border-border">
            <button onClick={() => setView('orders')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'orders' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Заказы</button>
            {isAdmin && (
              <button onClick={() => setView('staff')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'staff' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Команда</button>
            )}
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-600 text-white font-bold flex-1 md:flex-none">Excel Отчет</Button>
            {isAdmin && <Button onClick={handleBroadcast} className="bg-secondary text-secondary-foreground font-bold flex-1 md:flex-none">Объявление</Button>}
            <Button onClick={() => { setEditingOrderId(null); setIsModalOpen(true); }} className="bg-primary text-primary-foreground font-bold flex-1 md:flex-none">Новый объект</Button>
          </div>
        </div>

        {view === 'orders' ? (
          <>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <input placeholder="Поиск..." className="flex-grow w-full md:max-w-md p-2 bg-card border border-border rounded-lg outline-none focus:border-primary" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <div className="flex flex-wrap gap-2 bg-card p-1 rounded-lg border border-border w-full md:w-auto">
                {['active', 'general', 'completed', 'all'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition ${activeTab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    {t === 'active' ? '🔥 Актив' : t === 'general' ? '🌍 Общие' : t === 'completed' ? '✅ Архив' : '📦 Все'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <Loader2 className="animate-spin mx-auto mt-20" /> : (
              // ВОТ ЭТА СТРОЧКА ИСПРАВЛЯЕТ ОТОБРАЖЕНИЕ КАРТОЧЕК НА МОБИЛКЕ
              <div className="flex flex-col md:flex-row gap-6 md:overflow-x-auto pb-6 items-start">
                
                {/* КОЛОНКА 1: НОВЫЕ */}
                <div className="w-full md:min-w-[320px] md:flex-1 bg-muted/20 border border-border p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold border-b border-border pb-2 flex justify-between">🆕 Новые <span>{filteredOrders.filter(o => o.status === 'new').length}</span></h3>
                  {filteredOrders.filter(o => o.status === 'new').map((o: any) => (
                    <OrderCard key={o.id} order={o} onView={setViewingOrder} onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)} onComplete={handleComplete} onAssignOrder={openAssignModal} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>

                {/* КОЛОНКА 2: В РАБОТЕ */}
                <div className="w-full md:min-w-[320px] md:flex-1 bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold border-b border-amber-500/20 pb-2 flex justify-between">⏳ В работе <span>{filteredOrders.filter(o => o.status === 'in_progress').length}</span></h3>
                  {filteredOrders.filter(o => o.status === 'in_progress').map((o: any) => (
                    <OrderCard key={o.id} order={o} onView={setViewingOrder} onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)} onComplete={handleComplete} onAssignOrder={openAssignModal} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>

                {/* КОЛОНКА 3: ГОТОВО */}
                <div className="w-full md:min-w-[320px] md:flex-1 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold border-b border-emerald-500/20 pb-2 flex justify-between">✅ Готово <span>{filteredOrders.filter(o => o.status === 'completed').length}</span></h3>
                  {filteredOrders.filter(o => o.status === 'completed').map((o: any) => (
                    <OrderCard key={o.id} order={o} onView={setViewingOrder} onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)} onComplete={handleComplete} onAssignOrder={openAssignModal} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>

              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {profiles.map(p => (
              <div key={p.id} className="bg-card border border-border p-5 rounded-xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      {p.full_name} {p.role === 'admin' && '🛡️'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                        PIN: {p.pin_code}
                      </span>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${
                        p.telegram_chat_id 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {p.telegram_chat_id ? '✅ Бот активен' : '❌ Нет бота'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => deleteStaff(p.id)} className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition" title="Удалить сотрудника">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={p.can_design} onChange={() => toggleRole(p.id, 'can_design', p.can_design)} /> 🎨 Дизайн</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={p.can_print} onChange={() => toggleRole(p.id, 'can_print', p.can_print)} /> 🖨 Печать</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={p.can_install} onChange={() => toggleRole(p.id, 'can_install', p.can_install)} /> 🛠 Монтаж</label>
                </div>
              </div>
            ))}
            {isAdmin && <Button onClick={addStaff} className="h-full border-dashed border-2 bg-transparent text-muted-foreground">+ Добавить сотрудника</Button>}
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

        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="max-w-sm bg-card border-border text-foreground shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-secondary">Кому передать в работу?</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-4 max-h-[60vh] overflow-y-auto">
              {profiles.filter(p => p.role !== 'admin').map(p => (
                <Button key={p.id} onClick={() => executeAssign(p.id)} className="justify-start bg-muted hover:bg-primary hover:text-primary-foreground text-foreground font-bold transition border border-border">
                  <User className="w-4 h-4 mr-2"/> {p.full_name}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
          <DialogContent className="max-w-2xl bg-card border-border text-foreground shadow-2xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-secondary uppercase">Полная информация о заказе</DialogTitle>
            </DialogHeader>
            
            {viewingOrder && (
              <div className="space-y-6 py-4">
                {/* ОСНОВНАЯ ИНФОРМАЦИЯ */}
                <div>
                  <h3 className="font-bold text-lg text-primary mb-2">{viewingOrder.title}</h3>
                  <div className="flex gap-2 flex-wrap mb-3">
                    <span className={`text-[10px] px-3 py-1 rounded font-bold uppercase ${viewingOrder.department === 'print' ? 'bg-purple-500/20 text-purple-500' : 'bg-blue-500/20 text-blue-500'}`}>
                      {viewingOrder.department === 'print' ? '🖨 Печать' : '🛠 Монтаж'}
                    </span>
                    <span className={`text-[10px] px-3 py-1 rounded font-bold uppercase ${
                      viewingOrder.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600' : 
                      viewingOrder.status === 'in_progress' ? 'bg-amber-500/20 text-amber-600' : 
                      'bg-muted text-muted-foreground'
                    }`}>
                      {viewingOrder.status === 'completed' ? 'Завершен' : viewingOrder.status === 'in_progress' ? 'В работе' : 'Новый'}
                    </span>
                  </div>
                </div>

                {/* ОПИСАНИЕ */}
                {viewingOrder.description && (
                  <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                    <p className="text-xs text-muted-foreground font-bold uppercase mb-2">Описание</p>
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">{viewingOrder.description}</p>
                  </div>
                )}

                {/* ДЕТАЛИ */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Дедлайн</p>
                    <p className="text-foreground font-medium">{viewingOrder.deadline ? new Date(viewingOrder.deadline).toLocaleDateString('ru-RU') : '—'}</p>
                  </div>
                  
                  <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Исполнитель</p>
                    <p className="text-foreground font-medium">
                      {viewingOrder.is_general ? 'Общий заказ' : (viewingOrder.profiles?.full_name || 'Не назначен')}
                    </p>
                  </div>

                  {viewingOrder.dimensions && (
                    <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Размеры</p>
                      <p className="text-foreground font-medium">{viewingOrder.dimensions}</p>
                    </div>
                  )}

                  {viewingOrder.material && (
                    <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Материал</p>
                      <p className="text-foreground font-medium">{viewingOrder.material}</p>
                    </div>
                  )}

                  {viewingOrder.source_link && (
                    <div className="bg-background/50 p-3 rounded-lg border border-border/50 col-span-2">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Источник</p>
                      <a href={viewingOrder.source_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                        {viewingOrder.source_link}
                      </a>
                    </div>
                  )}

                  <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Создал</p>
                    <p className="text-foreground font-medium">{viewingOrder.creator_name || 'Админ'}</p>
                  </div>
                </div>

                {/* ИЗОБРАЖЕНИЯ */}
                {(viewingOrder.image_urls || viewingOrder.report_photo) && (
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase mb-3">Изображения</p>
                    <div className="grid grid-cols-2 gap-3">
                      {viewingOrder.image_urls && Array.isArray(viewingOrder.image_urls) && viewingOrder.image_urls.map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="relative group overflow-hidden rounded-lg border border-border">
                          <img src={url} alt={`Изображение ${idx + 1}`} className="w-full h-auto object-cover group-hover:scale-105 transition" />
                        </a>
                      ))}
                      {viewingOrder.report_photo && (
                        <a href={viewingOrder.report_photo} target="_blank" rel="noopener noreferrer" className="relative group overflow-hidden rounded-lg border border-border">
                          <img src={viewingOrder.report_photo} alt="Отчет" className="w-full h-auto object-cover group-hover:scale-105 transition" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}