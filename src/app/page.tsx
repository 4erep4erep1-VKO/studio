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
import * as XLSX from 'xlsx'; // Подключили библиотеку для Excel

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  const [view, setView] = useState<'orders' | 'staff'>('orders');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'general' | 'completed' | 'all'>('all'); // По умолчанию показываем Канбан полностью
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

  // ФУНКЦИЯ "ВЗЯТЬ В РАБОТУ"
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

  // ФУНКЦИЯ "ЗАВЕРШИТЬ ЗАКАЗ"
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

  // ФУНКЦИЯ ЭКСПОРТА В EXCEL
  const exportToExcel = () => {
    if (orders.length === 0) {
      alert("Нет данных для выгрузки");
      return;
    }
    
    // Формируем красивую таблицу для Excel
    const dataToExport = orders.map((o: any) => ({
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
    
    // Авто-скачивание файла
    XLSX.writeFile(workbook, `Отчет_Монтажка_${new Date().toLocaleDateString()}.xlsx`);
    toast({ title: "Excel файл успешно скачан!" });
  };

  const handleBroadcast = async () => {
    const msg = prompt("Введите текст объявления для всех сотрудников:");
    if (!msg) return;
    setLoading(true);
    profiles.forEach(p => p.telegram_chat_id && notifyTelegram(p.telegram_chat_id, `📢 <b>ОБЪЯВЛЕНИЕ:</b>\n\n${msg}`));
    setLoading(false);
    toast({ title: "Рассылка запущена" });
  };

  // ... (addStaff, deleteStaff, toggleRole остаются без изменений)
  const addStaff = async () => {
    const name = prompt("ФИО сотрудника:");
    if (!name) return;
    const pin = prompt("Придумайте ПИН-код для входа:");
    if (!pin) return;
    const roleChoice = prompt("Выберите роль:\n1 — Монтажник\n2 — Администратор", "1");
    const role = roleChoice === "2" ? "admin" : "installer";
    const newId = crypto.randomUUID();
    const { error } = await supabase.from('profiles').insert([{ id: newId, full_name: name, pin_code: pin, role: role }]);
    if (error) alert("❌ ОШИБКА: " + error.message);
    else { toast({ title: role === 'admin' ? "Админ добавлен" : "Сотрудник добавлен" }); fetchAllData(); }
  };

  const deleteStaff = async (id: string) => {
    if (confirm("Удалить этот профиль навсегда?")) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (!error) fetchAllData();
    }
  };

  const toggleRole = async (userId: string, field: string, currentValue: boolean) => {
    const { error } = await supabase.from('profiles').update({ [field]: !currentValue }).eq('id', userId);
    if (!error) { fetchAllData(); toast({ title: "Допуск обновлен" }); } 
    else alert("Ошибка обновления прав: " + error.message);
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
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground transition-colors duration-300">
        <div className="bg-card p-8 rounded-2xl border border-border w-96 text-center shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 tracking-tight text-secondary">Montazhka PRO</h2>
          <input 
            type="password" 
            placeholder="Введите ПИН-код" 
            className="w-full p-3 bg-background border border-border rounded-lg mb-4 text-center text-xl tracking-widest outline-none focus:border-primary transition" 
            onKeyDown={e => e.key === 'Enter' && handleLogin()} 
            onChange={e => setPassword(e.target.value)} 
          />
          <Button onClick={handleLogin} disabled={isLoggingIn} className="w-full bg-primary text-primary-foreground font-bold h-12 hover:opacity-90">
            {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Войти'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen text-foreground font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-primary/10 rounded-lg"><BarChart3 className="text-primary" /></div>
            <div><p className="text-xs text-muted-foreground uppercase font-bold">Заказы</p><p className="text-2xl font-bold">{stats.total}</p></div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-amber-500/10 rounded-lg"><Clock className="text-amber-500" /></div>
            <div><p className="text-xs text-muted-foreground uppercase font-bold">В работе</p><p className="text-2xl font-bold">{stats.active}</p></div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-emerald-500/10 rounded-lg"><CheckCircle2 className="text-emerald-500" /></div>
            <div><p className="text-xs text-muted-foreground uppercase font-bold">Сделано</p><p className="text-2xl font-bold">{stats.done}</p></div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-4 relative shadow-sm">
             <div className="p-3 bg-secondary/10 rounded-lg cursor-pointer" onClick={() => setShowNotifs(!showNotifs)}>
                <Bell className={notifications.length > 0 ? "text-secondary animate-pulse" : "text-muted-foreground"} />
             </div>
             <div className="flex-grow">
                <p className="text-xs text-muted-foreground uppercase font-bold">Система</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground font-medium">Активна</p>
                  <LogOut onClick={handleLogout} className="w-5 h-5 text-destructive cursor-pointer hover:opacity-70" title="Выйти" />
                </div>
             </div>
             {showNotifs && (
               <div className="absolute top-full left-0 w-full mt-2 bg-card border border-border rounded-xl p-3 z-50 shadow-2xl z-50">
                 <div className="flex justify-between mb-2 border-b border-border pb-1">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">События</span>
                   <X className="w-3 h-3 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setShowNotifs(false)} />
                 </div>
                 {notifications.length === 0 ? <p className="text-[10px] text-muted-foreground text-center py-2">Уведомлений нет</p> : 
                  notifications.map(n => (
                    <div key={n.id} className="text-[10px] mb-2 last:mb-0 border-l-2 border-primary pl-2 text-foreground">
                      <span className="text-muted-foreground">{n.time}</span> — {n.text}
                    </div>
                  ))
                 }
               </div>
             )}
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div className="flex bg-card p-1 rounded-xl border border-border">
            <button onClick={() => setView('orders')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'orders' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutDashboard className="w-4 h-4" /> Заказы
            </button>
            <button onClick={() => setView('staff')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'staff' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
              <Users className="w-4 h-4" /> Команда
            </button>
          </div>

          <div className="flex gap-2">
            <Button onClick={exportToExcel} className="bg-emerald-600 text-white font-bold hover:bg-emerald-700">
              <Download className="w-4 h-4 mr-2" /> Excel Отчет
            </Button>
            <Button onClick={handleBroadcast} className="bg-secondary text-secondary-foreground font-bold hover:opacity-90">
              <Megaphone className="w-4 h-4 mr-2" /> Объявление
            </Button>
            {view === 'orders' ? (
              <Button onClick={() => { setEditingOrderId(null); setIsModalOpen(true); }} className="bg-primary text-primary-foreground font-bold hover:opacity-90 shadow-md border-0">
                <Plus className="w-4 h-4 mr-2" /> Новый объект
              </Button>
            ) : (
              <Button onClick={addStaff} className="bg-primary text-primary-foreground font-bold hover:opacity-90 shadow-md border-0">
                <UserPlus className="w-4 h-4 mr-2" /> Добавить профиль
              </Button>
            )}
          </div>
        </div>

        {view === 'orders' ? (
          <>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input 
                  placeholder="Поиск по названию..." 
                  className="w-full pl-10 pr-4 py-2 bg-card border border-border text-foreground rounded-lg outline-none focus:border-primary transition" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                />
              </div>
              <div className="flex gap-2 bg-card p-1 rounded-lg border border-border">
                {['active', 'general', 'completed', 'all'].map(t => (
                  <button 
                    key={t} 
                    onClick={() => setActiveTab(t as any)} 
                    className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition ${activeTab === t ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {t === 'active' ? '🔥 Актив' : t === 'general' ? '🌍 Общие' : t === 'completed' ? '✅ Архив' : '📦 Все'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>
            ) : (
              /* КАНБАН ДОСКА */
              <div className="flex gap-6 overflow-x-auto pb-6 items-start">
                
                {/* КОЛОНКА: НОВЫЕ */}
                <div className="min-w-[320px] flex-1 bg-muted/20 border border-border p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold text-foreground flex items-center justify-between border-b border-border pb-2">
                    <span>🆕 Новые</span>
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {filteredOrders.filter(o => o.status === 'new').length}
                    </span>
                  </h3>
                  {filteredOrders.filter(o => o.status === 'new').map((o: any) => (
                    <OrderCard 
                      key={o.id} order={o} 
                      onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} 
                      onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)} 
                      onComplete={handleComplete} 
                      onStartWork={handleStartWork}
                    />
                  ))}
                </div>

                {/* КОЛОНКА: В РАБОТЕ */}
                <div className="min-w-[320px] flex-1 bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <span>⏳ В работе</span>
                    <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {filteredOrders.filter(o => o.status === 'in_progress').length}
                    </span>
                  </h3>
                  {filteredOrders.filter(o => o.status === 'in_progress').map((o: any) => (
                    <OrderCard 
                      key={o.id} order={o} 
                      onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} 
                      onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)} 
                      onComplete={handleComplete} 
                      onStartWork={handleStartWork}
                    />
                  ))}
                </div>

                {/* КОЛОНКА: ГОТОВО */}
                <div className="min-w-[320px] flex-1 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between border-b border-emerald-500/20 pb-2">
                    <span>✅ Готово</span>
                    <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {filteredOrders.filter(o => o.status === 'completed').length}
                    </span>
                  </h3>
                  {filteredOrders.filter(o => o.status === 'completed').map((o: any) => (
                    <OrderCard 
                      key={o.id} order={o} 
                      onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} 
                      onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)} 
                      onComplete={handleComplete} 
                      onStartWork={handleStartWork}
                    />
                  ))}
                </div>

              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map(p => (
              <div key={p.id} className={`bg-card border ${p.role === 'admin' ? 'border-primary/50' : 'border-border'} p-5 rounded-xl flex flex-col justify-between hover:border-muted-foreground/30 transition shadow-sm`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-foreground">{p.full_name}</h3>
                      {p.role === 'admin' && <ShieldCheck className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">{p.role === 'admin' ? 'Администратор' : 'Сотрудник'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-[10px] bg-background px-2 py-1 rounded text-primary font-mono border border-border">PIN: {p.pin_code}</span>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold ${p.telegram_chat_id ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                        {p.telegram_chat_id ? 'Бот активен' : 'Бот не привязан'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => deleteStaff(p.id)} className="p-2 text-muted-foreground hover:text-destructive transition"><Trash2 className="w-5 h-5" /></button>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Права доступа:</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1 text-muted-foreground cursor-pointer hover:text-foreground transition">
                      <input type="checkbox" checked={p.can_design || false} onChange={() => toggleRole(p.id, 'can_design', p.can_design)} className="accent-primary" /> 🎨 Дизайн
                    </label>
                    <label className="flex items-center gap-1 text-muted-foreground cursor-pointer hover:text-foreground transition">
                      <input type="checkbox" checked={p.can_print || false} onChange={() => toggleRole(p.id, 'can_print', p.can_print)} className="accent-primary" /> 🖨 Печать
                    </label>
                    <label className="flex items-center gap-1 text-muted-foreground cursor-pointer hover:text-foreground transition">
                      <input type="checkbox" checked={p.can_install || false} onChange={() => toggleRole(p.id, 'can_install', p.can_install)} className="accent-primary" /> 🛠 Монтаж
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-xl bg-card border-border text-foreground p-0 shadow-2xl overflow-hidden">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-xl font-bold uppercase italic tracking-tight text-secondary">Параметры объекта</DialogTitle>
            </DialogHeader>
            <OrderForm 
              orderId={editingOrderId} 
              onSave={() => { setIsModalOpen(false); fetchAllData(); }} 
              creatorId={currentUserId || ''} 
            />
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}