'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Loader2, RefreshCcw, Megaphone, 
  Users, LayoutDashboard, Search, Bell, 
  Trash2, UserPlus, CheckCircle2, Clock, 
  BarChart3, X, LogOut, ShieldCheck
} from 'lucide-react';
import { Order } from '@/lib/types';
import OrderForm from '@/components/orders/OrderForm';
import { OrderCard } from '@/components/orders/OrderCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  const [view, setView] = useState<'orders' | 'staff'>('orders');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'general' | 'completed' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const [notifications, setNotifications] = useState<{id: string, text: string, time: string}[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  
  const { toast } = useToast();

  // Проверка сессии при загрузке
  useEffect(() => {
    const savedAuth = localStorage.getItem('adminAuth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const fetchAllData = async () => {
    try {
      const { data: rawOrders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      const { data: rawProfiles } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });

      if (rawProfiles) setProfiles(rawProfiles);

      const mergedOrders = (rawOrders || []).map((order: any) => {
        const assignedProfile = rawProfiles?.find(p => p.id === order.assigned_to);
        return {
          ...order,
          profiles: assignedProfile ? { 
            full_name: assignedProfile.full_name, 
            telegram_chat_id: assignedProfile.telegram_chat_id 
          } : null
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
        localStorage.setItem('adminAuth', 'true');
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
    setIsAuthenticated(false);
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

  const handleBroadcast = async () => {
    const msg = prompt("Введите текст объявления для всех монтажников:");
    if (!msg) return;
    setLoading(true);
    profiles.forEach(p => p.telegram_chat_id && notifyTelegram(p.telegram_chat_id, `📢 <b>ОБЪЯВЛЕНИЕ:</b>\n\n${msg}`));
    setLoading(false);
    toast({ title: "Рассылка запущена" });
  };

  const addStaff = async () => {
    const name = prompt("ФИО сотрудника:");
    if (!name) return;
    const pin = prompt("Придумайте ПИН-код для входа:");
    if (!pin) return;
    const roleChoice = prompt("Выберите роль:\n1 — Монтажник\n2 — Администратор", "1");
    
    const role = roleChoice === "2" ? "admin" : "installer";
    const newId = crypto.randomUUID();

    const { error } = await supabase.from('profiles').insert([{ 
      id: newId, 
      full_name: name, 
      pin_code: pin, 
      role: role 
    }]);

    if (error) {
      alert("❌ ОШИБКА: " + error.message);
    } else {
      toast({ title: role === 'admin' ? "Админ добавлен" : "Монтажник добавлен" });
      fetchAllData();
    }
  };

  const deleteStaff = async (id: string) => {
    if (confirm("Удалить этот профиль навсегда?")) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (!error) fetchAllData();
    }
  };

  const filteredOrders = orders.filter((o: any) => {
    // ИСПРАВЛЕННАЯ СТРОКА 245: добавляем проверку на наличие title
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
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-96 text-center shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 tracking-tight">Montazhka PRO Admin</h2>
          <input 
            type="password" 
            placeholder="Введите ПИН-код" 
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg mb-4 text-center text-xl tracking-widest outline-none focus:border-blue-500 transition" 
            onKeyDown={e => e.key === 'Enter' && handleLogin()} 
            onChange={e => setPassword(e.target.value)} 
          />
          <Button onClick={handleLogin} disabled={isLoggingIn} className="w-full bg-blue-600 font-bold h-12">
            {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Войти'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Панель статистики */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
            <div className="p-3 bg-blue-600/20 rounded-lg"><BarChart3 className="text-blue-500" /></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">Заказы</p><p className="text-2xl font-bold">{stats.total}</p></div>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
            <div className="p-3 bg-yellow-600/20 rounded-lg"><Clock className="text-yellow-500" /></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">В работе</p><p className="text-2xl font-bold">{stats.active}</p></div>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
            <div className="p-3 bg-green-600/20 rounded-lg"><CheckCircle2 className="text-green-500" /></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">Сделано</p><p className="text-2xl font-bold">{stats.done}</p></div>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-4 relative">
             <div className="p-3 bg-orange-600/20 rounded-lg cursor-pointer" onClick={() => setShowNotifs(!showNotifs)}>
                <Bell className={notifications.length > 0 ? "text-orange-500 animate-pulse" : "text-slate-500"} />
             </div>
             <div className="flex-grow">
                <p className="text-xs text-slate-500 uppercase font-bold">Система</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400 font-medium">Активна</p>
                  <LogOut onClick={handleLogout} className="w-5 h-5 text-red-500 cursor-pointer hover:text-red-400" title="Выйти" />
                </div>
             </div>
             
             {showNotifs && (
               <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl p-3 z-50 shadow-2xl">
                 <div className="flex justify-between mb-2 border-b border-slate-800 pb-1">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">События</span>
                   <X className="w-3 h-3 cursor-pointer" onClick={() => setShowNotifs(false)} />
                 </div>
                 {notifications.length === 0 ? <p className="text-[10px] text-slate-600 text-center py-2">Уведомлений нет</p> : 
                  notifications.map(n => (
                    <div key={n.id} className="text-[10px] mb-2 last:mb-0 border-l-2 border-blue-600 pl-2">
                      <span className="text-slate-500">{n.time}</span> — {n.text}
                    </div>
                  ))
                 }
               </div>
             )}
          </div>
        </div>

        {/* Навигация */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setView('orders')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'orders' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <LayoutDashboard className="w-4 h-4" /> Заказы
            </button>
            <button onClick={() => setView('staff')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition ${view === 'staff' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Users className="w-4 h-4" /> Команда
            </button>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleBroadcast} className="bg-orange-600 font-bold hover:bg-orange-700">
              <Megaphone className="w-4 h-4 mr-2" /> Объявление
            </Button>
            {view === 'orders' ? (
              <Button onClick={() => { setEditingOrderId(null); setIsModalOpen(true); }} className="bg-blue-600 font-bold hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Новый объект
              </Button>
            ) : (
              <Button onClick={addStaff} className="bg-green-600 font-bold hover:bg-green-700">
                <UserPlus className="w-4 h-4 mr-2" /> Добавить профиль
              </Button>
            )}
          </div>
        </div>

        {view === 'orders' ? (
          <>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input 
                  placeholder="Поиск по названию..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg outline-none focus:border-blue-500" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                />
              </div>
              <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                {['active', 'general', 'completed', 'all'].map(t => (
                  <button 
                    key={t} 
                    onClick={() => setActiveTab(t as any)} 
                    className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition ${activeTab === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
                  >
                    {t === 'active' ? '🔥 Актив' : t === 'general' ? '🌍 Общие' : t === 'completed' ? '✅ Архив' : '📦 Все'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredOrders.map((o: any) => (
                  <OrderCard 
                    key={o.id} 
                    order={o} 
                    onEdit={id => { setEditingOrderId(id); setIsModalOpen(true); }} 
                    onDelete={(id, cid, title) => handleDelete(id, cid, title, o.status)} 
                    onComplete={fetchAllData} 
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map(p => (
              <div key={p.id} className={`bg-slate-900 border ${p.role === 'admin' ? 'border-blue-500/50' : 'border-slate-800'} p-5 rounded-xl flex justify-between items-center hover:border-slate-600 transition`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold">{p.full_name}</h3>
                    {p.role === 'admin' && <ShieldCheck className="w-4 h-4 text-blue-500" />}
                  </div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">{p.role === 'admin' ? 'Администратор' : 'Монтажник'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-blue-400 font-mono border border-slate-800">PIN: {p.pin_code}</span>
                    <span className={`text-[10px] px-2 py-1 rounded font-bold ${p.telegram_chat_id ? 'bg-green-900/20 text-green-400 border border-green-900/50' : 'bg-red-900/20 text-red-400 border border-red-900/50'}`}>
                      {p.telegram_chat_id ? 'Бот активен' : 'Бот не привязан'}
                    </span>
                  </div>
                </div>
                <button onClick={() => deleteStaff(p.id)} className="p-2 text-slate-600 hover:text-red-500 transition"><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-xl bg-slate-900 border-slate-800 text-white p-0 shadow-2xl overflow-hidden">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-xl font-bold uppercase italic tracking-tight">Параметры объекта</DialogTitle>
            </DialogHeader>
            <OrderForm orderId={editingOrderId} onSave={() => setIsModalOpen(false)} />
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}