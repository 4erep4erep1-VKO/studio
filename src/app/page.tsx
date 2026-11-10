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
import OrderListManager from '@/components/orders/OrderListManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

async function fetchAllOrders(searchQuery = '') {
  const filter = searchQuery
    ? `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
    : null;
  let countQuery = supabase.from('orders').select('*', { count: 'exact', head: true });
  if (filter) countQuery = countQuery.or(filter);

  const { count, error: countError } = await countQuery;
  if (countError) throw countError;

  const orders: any[] = [];
  let offset = 0;
  while (offset < (count || 0)) {
    let pageQuery = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (filter) pageQuery = pageQuery.or(filter);

    const { data, error } = await pageQuery.range(offset, offset + 999);
    if (error) throw error;

    const page = data || [];
    if (page.length === 0) break;
    orders.push(...page);
    offset += page.length;
  }

  return { orders, count: count || 0 };
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [listSearchResults, setListSearchResults] = useState<Order[] | null>(null);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
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
  const [displayMode, setDisplayMode] = useState<'kanban' | 'list'>('kanban');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [isCurrentUserLoading, setIsCurrentUserLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'general' | 'completed' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, done: 0, cancelled: 0 });

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

  useEffect(() => {
    let mounted = true;
    const loadCurrentUserName = async () => {
      setIsCurrentUserLoading(true);

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const profileId = session?.user?.id || currentUserId;
        const fallbackName = session?.user?.email ? session.user.email.split('@')[0] : null;

        if (!profileId) {
          if (mounted) {
            setCurrentUserName(fallbackName || null);
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('name, full_name')
          .eq('id', profileId)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Ошибка загрузки профиля текущего пользователя:', profileError);
        }

        const profileName = profile?.name || profile?.full_name;
        const finalName = profileName || fallbackName || 'Сотрудник';

        if (mounted) {
          setCurrentUserName(finalName);
        }
      } catch (err: any) {
        console.error('Ошибка получения текущей сессии:', err);
        if (mounted) {
          setCurrentUserName(null);
        }
      } finally {
        if (mounted) {
          setIsCurrentUserLoading(false);
        }
      }
    };

    loadCurrentUserName();

    return () => {
      mounted = false;
    };
  }, [currentUserId]);

  const fetchAllData = async () => {
    try {
      const [
        { orders: rawOrders, count: totalCount },
        { count: doneCount, error: doneCountError },
        { count: cancelledCount, error: cancelledCountError },
      ] = await Promise.all([
        fetchAllOrders(),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
      ]);
      if (doneCountError) throw doneCountError;
      if (cancelledCountError) throw cancelledCountError;

      const { data: rawProfiles } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });

      if (rawProfiles) setProfiles(rawProfiles);
      const total = totalCount || 0;
      const done = doneCount || 0;
      const cancelled = cancelledCount || 0;
      setStats({ total, active: total - done - cancelled, done, cancelled });
      setTotalOrdersCount(totalCount || 0);

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

  const searchOrders = async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setListSearchResults(null);
      return;
    }

    let rawOrders: any[];
    try {
      ({ orders: rawOrders } = await fetchAllOrders(trimmedQuery));
    } catch (error: any) {
      console.error('Ошибка поиска заказов:', error.message);
      return;
    }

    const results = rawOrders.map((order: any) => {
      const assignedProfile = profiles.find(profile => profile.id === order.assigned_to);
      const creatorProfile = profiles.find(profile => profile.id === order.created_by);

      return {
        ...order,
        profiles: assignedProfile ? {
          full_name: assignedProfile.full_name,
          telegram_chat_id: assignedProfile.telegram_chat_id
        } : null,
        creator_name: creatorProfile ? creatorProfile.full_name : 'Админ'
      };
    });

    setListSearchResults(results);
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

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'in_progress', report_photo: null }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Заказ возвращен в работу' });
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
      'Отдел': o.department === 'installation' ? 'Монтаж' : o.department === 'print' ? 'Печать' : o.department === 'production' ? 'Изготовление' : 'Не указан',
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

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090a]">
        <div className="w-96 rounded-xl border border-[#23252a] bg-[#0f1011] p-8 text-center">
          <h2 className="mb-6 text-2xl font-medium text-white">Montazhka PRO</h2>
          <input type="password" placeholder="ПИН-код" className="mb-4 w-full rounded-md border border-[#23252a] bg-[#08090a] p-3 text-center text-[#d0d6e0]" onKeyDown={e => e.key === 'Enter' && handleLogin()} onChange={e => setPassword(e.target.value)} />
          <Button onClick={handleLogin} disabled={isLoggingIn} className="h-12 w-full rounded-md bg-[#C62828] font-medium text-white hover:bg-red-800">{isLoggingIn ? '...' : 'Войти'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090a] p-6 text-[#d0d6e0] transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        
        {/* СТАТИСТИКА */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="flex items-center gap-4 rounded-xl border border-[#23252a] bg-[#0f1011] p-4">
            <div className="rounded-md bg-[#C62828]/15 p-3"><BarChart3 className="text-[#C62828]" /></div>
            <div><p className="text-xs font-normal text-[#8a8f98]">Заказы</p><p className="text-2xl font-medium text-white">{stats.total}</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-[#23252a] bg-[#0f1011] p-4">
            <div className="rounded-md bg-[#C62828]/15 p-3"><Clock className="text-[#C62828]" /></div>
            <div><p className="text-xs font-normal text-[#8a8f98]">Активные</p><p className="text-2xl font-medium text-white">{stats.active}</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-[#23252a] bg-[#0f1011] p-4">
            <div className="rounded-md bg-[#161718] p-3"><CheckCircle2 className="text-[#8a8f98]" /></div>
            <div><p className="text-xs font-normal text-[#8a8f98]">Сделано</p><p className="text-2xl font-medium text-white">{stats.done}</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-[#23252a] bg-[#0f1011] p-4">
            <div className="rounded-md bg-[#161718] p-3"><X className="text-[#8a8f98]" /></div>
            <div><p className="text-xs font-normal text-[#8a8f98]">Отменено</p><p className="text-2xl font-medium text-white">{stats.cancelled}</p></div>
          </div>
          <div className="relative flex items-center gap-4 rounded-xl border border-[#23252a] bg-[#0f1011] p-4">
             <div className="cursor-pointer rounded-md bg-[#161718] p-3" onClick={() => setShowNotifs(!showNotifs)}>
                <Bell className={notifications.length > 0 ? "animate-pulse text-[#C62828]" : "text-[#8a8f98]"} />
             </div>
             <div className="flex-grow">
                <p className="text-xs font-normal text-[#8a8f98]">Система</p>
                <div className="flex items-center gap-2">
                  {isCurrentUserLoading ? (
                    <div className="h-5 w-24 rounded-full bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
                  ) : currentUserName ? (
                    <span className="text-sm text-[#8a8f98]">{currentUserName}</span>
                  ) : null}
                  <LogOut onClick={handleLogout} className="w-5 h-5 text-destructive cursor-pointer" aria-label="Выйти" />
                </div>
             </div>
          </div>
        </div>

        {/* ПЕРЕКЛЮЧАТЕЛИ И КНОПКИ */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div className="flex gap-4">
            <div className="flex rounded-xl border border-[#23252a] bg-[#0f1011] p-1">
              <button onClick={() => setView('orders')} className={`rounded-md px-6 py-2 text-sm font-normal transition ${view === 'orders' ? 'bg-[#C62828] text-white' : 'text-[#8a8f98] hover:text-white'}`}>Заказы</button>
              {isAdmin && (
                <button onClick={() => setView('staff')} className={`rounded-md px-6 py-2 text-sm font-normal transition ${view === 'staff' ? 'bg-[#C62828] text-white' : 'text-[#8a8f98] hover:text-white'}`}>Команда</button>
              )}
            </div>
            
            {view === 'orders' && (
              <div className="flex rounded-xl border border-[#23252a] bg-[#0f1011] p-1">
                <button onClick={() => setDisplayMode('kanban')} className={`rounded-md px-4 py-2 text-sm font-normal transition ${displayMode === 'kanban' ? 'bg-[#C62828] text-white' : 'text-[#8a8f98] hover:text-white'}`}>📊 Канбан</button>
                <button onClick={() => setDisplayMode('list')} className={`rounded-md px-4 py-2 text-sm font-normal transition ${displayMode === 'list' ? 'bg-[#C62828] text-white' : 'text-[#8a8f98] hover:text-white'}`}>📋 Список</button>
              </div>
            )}
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={() => setIsExportModalOpen(true)} className="flex-1 rounded-md border border-[#23252a] bg-[#0f1011] font-normal text-[#d0d6e0] hover:bg-[#161718] md:flex-none">Excel Отчет</Button>
            {isAdmin && <Button onClick={handleBroadcast} className="flex-1 rounded-md border border-[#23252a] bg-[#0f1011] font-normal text-[#d0d6e0] hover:bg-[#161718] md:flex-none">Объявление</Button>}
            <Button onClick={() => {
              if (!currentUserId) {
                alert('❌ Ошибка: Вы не авторизованы. Пожалуйста, пройдите вход в систему, используя ПИН-код.');
                return;
              }
              setEditingOrderId(null);
              setIsModalOpen(true);
            }} className="flex-1 rounded-md bg-[#C62828] font-medium text-white hover:bg-red-800 md:flex-none">Новый объект</Button>
          </div>
        </div>

        {view === 'orders' ? (
          <>
            {displayMode === 'list' ? (
              // РЕЖИМ СПИСКА/СЕТКИ
              <OrderListManager
                orders={listSearchResults ?? orders}
                totalOrdersCount={totalOrdersCount}
                onSearch={searchOrders}
                onEdit={(id) => {
                  if (!currentUserId) {
                    alert('❌ Ошибка: Вы не авторизованы. Пожалуйста, пройдите вход в систему.');
                    return;
                  }
                  setEditingOrderId(id);
                  setIsModalOpen(true);
                }}
                onDelete={(id, cid, title) => handleDelete(id, cid, title, '')}
                onComplete={handleComplete}
                onAssignOrder={openAssignModal}
                onTransferToInstallation={handleTransferToInstallation}
                onRestore={handleRestore}
                onView={setViewingOrder}
                isAdmin={isAdmin}
              />
            ) : (
              // РЕЖИМ КАНБАНА
              <>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <input placeholder="Поиск..." className="w-full flex-grow rounded-md border border-[#23252a] bg-[#0f1011] p-2 text-[#d0d6e0] outline-none placeholder:text-[#8a8f98] focus:border-[#C62828] md:max-w-md" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  <div className="flex w-full flex-wrap gap-2 rounded-md border border-[#23252a] bg-[#0f1011] p-1 md:w-auto">
                    {['active', 'general', 'completed', 'all'].map(t => (
                      <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 rounded-md px-4 py-1.5 text-xs font-normal transition md:flex-none ${activeTab === t ? 'bg-[#C62828] text-white' : 'text-[#8a8f98] hover:bg-[#C62828]/15 hover:text-white'}`}>
                        {t === 'active' ? '🔥 Актив' : t === 'general' ? '🌍 Общие' : t === 'completed' ? '✅ Архив' : '📦 Все'}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? <Loader2 className="animate-spin mx-auto mt-20" /> : (
                  <div className="flex flex-col md:flex-row gap-6 md:overflow-x-auto pb-6 items-start">
                
                {/* КОЛОНКА 1: НОВЫЕ */}
                <div className="flex w-full flex-col gap-4 rounded-xl border border-[#23252a] bg-[#0f1011] p-4 md:min-w-[320px] md:flex-1">
                  <h3 className="flex justify-between border-b border-[#23252a] pb-2 font-medium text-white">🆕 Новые <span className="text-[#8a8f98]">{filteredOrders.filter(o => o.status === 'new').length}</span></h3>
                  {filteredOrders.filter(o => o.status === 'new').map((o: any) => (
                    <OrderCard key={o.id} order={o} onView={setViewingOrder} onEdit={id => {
                      if (!currentUserId) {
                        alert('❌ Ошибка: Вы не авторизованы. Пожалуйста, пройдите вход в систему.');
                        return;
                      }
                      setEditingOrderId(id);
                      setIsModalOpen(true);
                    }} onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)} onComplete={handleComplete} onAssignOrder={openAssignModal} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>

                {/* КОЛОНКА 2: В РАБОТЕ */}
                <div className="flex w-full flex-col gap-4 rounded-xl border border-[#23252a] bg-[#0f1011] p-4 md:min-w-[320px] md:flex-1">
                  <h3 className="flex justify-between border-b border-[#23252a] pb-2 font-medium text-white">⏳ В работе <span className="text-[#8a8f98]">{filteredOrders.filter(o => o.status === 'in_progress').length}</span></h3>
                  {filteredOrders.filter(o => o.status === 'in_progress').map((o: any) => (
                    <OrderCard key={o.id} order={o} onView={setViewingOrder} onEdit={id => {
                      if (!currentUserId) {
                        alert('❌ Ошибка: Вы не авторизованы. Пожалуйста, пройдите вход в систему.');
                        return;
                      }
                      setEditingOrderId(id);
                      setIsModalOpen(true);
                    }} onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)} onComplete={handleComplete} onAssignOrder={openAssignModal} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>

                {/* КОЛОНКА 3: ГОТОВО */}
                <div className="flex w-full flex-col gap-4 rounded-xl border border-[#23252a] bg-[#0f1011] p-4 md:min-w-[320px] md:flex-1">
                  <h3 className="flex justify-between border-b border-[#23252a] pb-2 font-medium text-white">✅ Готово <span className="text-[#8a8f98]">{filteredOrders.filter(o => o.status === 'completed').length}</span></h3>
                  {filteredOrders.filter(o => o.status === 'completed').map((o: any) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onView={setViewingOrder}
                      onEdit={id => {
                        if (!currentUserId) {
                          alert('❌ Ошибка: Вы не авторизованы. Пожалуйста, пройдите вход в систему.');
                          return;
                        }
                        setEditingOrderId(id);
                        setIsModalOpen(true);
                      }}
                      onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)}
                      onComplete={handleComplete}
                      onAssignOrder={openAssignModal}
                      onTransferToInstallation={handleTransferToInstallation}
                      onRestore={handleRestore}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>

              </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {profiles.map(p => (
              <div key={p.id} className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-medium text-white">
                      {p.full_name} {p.role === 'admin' && '🛡️'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                        PIN: {p.pin_code}
                      </span>
                      <span className={`rounded-md border border-[#23252a] px-2 py-1 text-[10px] font-normal uppercase tracking-wider ${
                        p.telegram_chat_id 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {p.telegram_chat_id ? '✅ Бот активен' : '❌ Нет бота'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => deleteStaff(p.id)} className="rounded-md p-2 text-[#8a8f98] transition hover:bg-[#C62828]/15 hover:text-[#C62828]" title="Удалить сотрудника">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <label className="flex items-center gap-1 text-[#d0d6e0]"><input type="checkbox" className="accent-[#C62828]" checked={p.can_design} onChange={() => toggleRole(p.id, 'can_design', p.can_design)} /> 🎨 Дизайн</label>
                  <label className="flex items-center gap-1 text-[#d0d6e0]"><input type="checkbox" className="accent-[#C62828]" checked={p.can_print} onChange={() => toggleRole(p.id, 'can_print', p.can_print)} /> 🖨 Печать</label>
                  <label className="flex items-center gap-1 text-[#d0d6e0]"><input type="checkbox" className="accent-[#C62828]" checked={p.can_install} onChange={() => toggleRole(p.id, 'can_install', p.can_install)} /> 🛠 Монтаж</label>
                </div>
              </div>
            ))}
            {isAdmin && <Button onClick={addStaff} className="h-full border-dashed border-2 bg-transparent text-muted-foreground">+ Добавить сотрудника</Button>}
          </div>
        )}

        {/* МОДАЛКИ */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-xl overflow-hidden rounded-xl border border-[#23252a] bg-[#0f1011] p-0 text-[#d0d6e0]">
            <DialogHeader className="p-6 pb-0"><DialogTitle className="text-xl font-medium uppercase tracking-tight text-white">Параметры объекта</DialogTitle></DialogHeader>
            <OrderForm orderId={editingOrderId} onSave={() => { setIsModalOpen(false); fetchAllData(); }} creatorId={currentUserId || ''} editorName={currentUserName || undefined} />
          </DialogContent>
        </Dialog>

        <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
          <DialogContent className="max-w-sm rounded-xl border border-[#23252a] bg-[#0f1011] text-[#d0d6e0]">
            <DialogHeader><DialogTitle className="text-lg font-medium text-white">Выгрузка в Excel</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div><label className="mb-1 block text-xs font-normal uppercase text-[#8a8f98]">С даты:</label><input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none focus:border-[#C62828]" /></div>
              <div><label className="mb-1 block text-xs font-normal uppercase text-[#8a8f98]">По дату:</label><input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full rounded-md border border-[#23252a] bg-[#08090a] p-2 text-[#d0d6e0] outline-none focus:border-[#C62828]" /></div>
              <Button onClick={executeExport} className="mt-2 w-full rounded-md bg-[#C62828] font-medium text-white hover:bg-red-800">Скачать таблицу</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="max-w-sm rounded-xl border border-[#23252a] bg-[#0f1011] text-[#d0d6e0]">
            <DialogHeader>
              <DialogTitle className="text-lg font-medium text-white">Кому передать в работу?</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-4 max-h-[60vh] overflow-y-auto">
              {profiles.filter(p => p.role !== 'admin').map(p => (
                <Button key={p.id} onClick={() => executeAssign(p.id)} className="justify-start rounded-md border border-[#23252a] bg-[#161718] font-normal text-[#d0d6e0] transition hover:bg-[#C62828] hover:text-white">
                  <User className="w-4 h-4 mr-2"/> {p.full_name}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-xl border border-[#23252a] bg-[#0f1011] text-[#d0d6e0]">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium uppercase text-white">Полная информация о заказе</DialogTitle>
            </DialogHeader>
            
            {viewingOrder && (
              <div className="space-y-6 py-4">
                {/* ОСНОВНАЯ ИНФОРМАЦИЯ */}
                <div>
                  <h3 className="mb-2 text-lg font-medium text-white">{viewingOrder.title}</h3>
                  <div className="flex gap-2 flex-wrap mb-3">
                    <span className="rounded-md border border-[#23252a] bg-[#161718] px-3 py-1 text-[10px] font-normal uppercase text-[#8a8f98]">
                      {viewingOrder.department === 'print' ? '🖨 Печать' : viewingOrder.department === 'production' ? '🏭 Изготовление' : '🛠 Монтаж'}
                    </span>
                    <span className={`rounded-md border border-[#23252a] px-3 py-1 text-[10px] font-normal uppercase ${
                      viewingOrder.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600' : 
                      viewingOrder.status === 'in_progress' ? 'bg-[#C62828]/15 text-[#d0d6e0]' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {viewingOrder.status === 'completed' ? 'Завершен' : viewingOrder.status === 'in_progress' ? 'В работе' : 'Новый'}
                    </span>
                  </div>
                </div>

                {/* ОПИСАНИЕ */}
                {viewingOrder.description && (
                  <div className="rounded-md border border-[#23252a] bg-[#08090a] p-4">
                    <p className="mb-2 text-xs font-normal uppercase text-[#8a8f98]">Описание</p>
                    <p className="break-words leading-relaxed text-[#d0d6e0] whitespace-pre-wrap">{viewingOrder.description}</p>
                  </div>
                )}

                {/* ДЕТАЛИ */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-md border border-[#23252a] bg-[#08090a] p-3">
                    <p className="mb-1 text-[10px] font-normal uppercase text-[#8a8f98]">Дедлайн</p>
                    <p className="font-normal text-[#d0d6e0]">{viewingOrder.deadline ? new Date(viewingOrder.deadline).toLocaleDateString('ru-RU') : '—'}</p>
                  </div>
                  
                  <div className="rounded-md border border-[#23252a] bg-[#08090a] p-3">
                    <p className="mb-1 text-[10px] font-normal uppercase text-[#8a8f98]">Исполнитель</p>
                    <p className="font-normal text-[#d0d6e0]">
                      {viewingOrder.is_general ? 'Общий заказ' : (viewingOrder.profiles?.full_name || 'Не назначен')}
                    </p>
                  </div>

                  {viewingOrder.dimensions && (
                    <div className="rounded-md border border-[#23252a] bg-[#08090a] p-3">
                      <p className="mb-1 text-[10px] font-normal uppercase text-[#8a8f98]">Размеры</p>
                      <p className="font-normal text-[#d0d6e0]">{viewingOrder.dimensions}</p>
                    </div>
                  )}

                  {viewingOrder.material && (
                    <div className="rounded-md border border-[#23252a] bg-[#08090a] p-3">
                      <p className="mb-1 text-[10px] font-normal uppercase text-[#8a8f98]">Материал</p>
                      <p className="font-normal text-[#d0d6e0]">{viewingOrder.material}</p>
                    </div>
                  )}

                  {viewingOrder.source_link && (
                    <div className="col-span-2 rounded-md border border-[#23252a] bg-[#08090a] p-3">
                      <p className="mb-1 text-[10px] font-normal uppercase text-[#8a8f98]">Источник</p>
                      <a href={viewingOrder.source_link} target="_blank" rel="noopener noreferrer" className="break-all text-[#C62828] hover:underline">
                        {viewingOrder.source_link}
                      </a>
                    </div>
                  )}

                  <div className="rounded-md border border-[#23252a] bg-[#08090a] p-3">
                    <p className="mb-1 text-[10px] font-normal uppercase text-[#8a8f98]">Создал</p>
                    <p className="font-normal text-[#d0d6e0]">{viewingOrder.creator_name || 'Админ'}</p>
                  </div>
                </div>

                {/* ИЗОБРАЖЕНИЯ */}
                {(viewingOrder.image_urls || viewingOrder.report_photo) && (
                  <div>
                    <p className="mb-3 text-xs font-normal uppercase text-[#8a8f98]">Изображения</p>
                    <div className="grid grid-cols-2 gap-3">
                      {viewingOrder.image_urls && Array.isArray(viewingOrder.image_urls) && viewingOrder.image_urls.map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-md border border-[#23252a]">
                          <img src={url} alt={`Изображение ${idx + 1}`} className="w-full h-auto object-cover group-hover:scale-105 transition" />
                        </a>
                      ))}
                      {viewingOrder.report_photo && (
                        <a href={viewingOrder.report_photo} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-md border border-[#23252a]">
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