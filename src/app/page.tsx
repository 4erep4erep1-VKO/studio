'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Users, User, LayoutDashboard, Search, Bell, 
  Trash2, UserPlus, CheckCircle2, Clock, 
  BarChart3, X, LogOut, ShieldCheck, Download,
  ChevronDown, ChevronUp, Flame, Calendar
} from 'lucide-react';
import { Order, OrderTemplate } from '@/lib/types';
import OrderForm from '@/components/orders/OrderForm';
import { OrderCard } from '@/components/orders/OrderCard';
import OrderListManager from '@/components/orders/OrderListManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

async function fetchAllOrders(searchQuery = '') {
  const sanitizedQuery = searchQuery.trim().replace(/[,()]/g, ' ');
  const filter = sanitizedQuery
    ? `title.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`
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

function getAlmatyDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isOrderUrgent(deadline: unknown, todayStr: string): boolean {
  if (!deadline) return false;
  const raw = String(deadline).trim();
  if (!raw) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw <= todayStr;
  }
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return false;
  return getAlmatyDateString(parsed) <= todayStr;
}

function getLoadBadgeInfo(activeCount: number) {
  if (activeCount === 0) {
    return {
      icon: '🟢',
      label: 'Свободен',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    };
  }
  if (activeCount <= 2) {
    return {
      icon: '🟡',
      label: `В работе: ${activeCount}`,
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    };
  }
  return {
    icon: '🔴',
    label: `Загружен: ${activeCount}`,
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  };
}

function getDepartmentLabel(department?: string | null) {
  if (department === 'print') return '🖨 Печать';
  if (department === 'production') return '🏭 Цех';
  return '🛠 Монтаж';
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [listSearchResults, setListSearchResults] = useState<Order[] | null>(null);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [duplicateOrder, setDuplicateOrder] = useState<OrderTemplate | null>(null);
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);
  const [completionPhotos, setCompletionPhotos] = useState<File[]>([]);
  const [isCompletingOrder, setIsCompletingOrder] = useState(false);

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
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('all');
  const [expandedStaffIds, setExpandedStaffIds] = useState<Record<string, boolean>>({});
  const [assignPreviewStaffId, setAssignPreviewStaffId] = useState<string | null>(null);
  const [staffSortBy, setStaffSortBy] = useState<'load' | 'name'>('load');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [stats, setStats] = useState({ total: 0, done: 0, cancelled: 0 });

  const [notifications, setNotifications] = useState<{id: string, text: string, time: string}[]>([]);
  
  const { toast } = useToast();

  const profilesRef = useRef<any[]>(profiles);
  profilesRef.current = profiles;

  const ordersRef = useRef<Order[]>(orders);
  ordersRef.current = orders;

  const currentUserIdRef = useRef<string | null>(currentUserId);
  currentUserIdRef.current = currentUserId;

  const searchRequestIdRef = useRef(0);

  const handleEditOrder = useCallback((id: string) => {
    if (!currentUserIdRef.current) {
      alert('❌ Ошибка: Вы не авторизованы. Пожалуйста, пройдите вход в систему.');
      return;
    }
    setEditingOrderId(id);
    setDuplicateOrder(null);
    setIsModalOpen(true);
  }, []);

  const openDuplicateOrder = useCallback((order: OrderTemplate) => {
    if (!currentUserIdRef.current) {
      alert('❌ Ошибка: Вы не авторизованы. Пожалуйста, пройдите вход в систему.');
      return;
    }

    setEditingOrderId(null);
    setDuplicateOrder({
      title: order.title,
      description: order.description,
      department: order.department,
      dimensions: order.dimensions,
      material: order.material,
      source_link: order.source_link,
    });
    setIsModalOpen(true);
  }, []);

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

  const fetchAllData = useCallback(async () => {
    try {
      const [
        { orders: rawOrders, count: totalCount },
        { count: doneCount, error: doneCountError },
        { count: cancelledCount, error: cancelledCountError },
        { data: rawProfiles },
      ] = await Promise.all([
        fetchAllOrders(),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase.from('profiles').select('*').order('full_name', { ascending: true }),
      ]);
      if (doneCountError) throw doneCountError;
      if (cancelledCountError) throw cancelledCountError;

      if (rawProfiles) setProfiles(rawProfiles);
      const profilesMap = new Map((rawProfiles || []).map((p: any) => [p.id, p]));

      const total = totalCount || 0;
      const done = doneCount || 0;
      const cancelled = cancelledCount || 0;
      setStats({ total, done, cancelled });
      setTotalOrdersCount(totalCount || 0);

      const mergedOrders = (rawOrders || []).map((order: any) => {
        const assignedProfile = order.assigned_to ? profilesMap.get(order.assigned_to) : undefined;
        const creatorProfile = order.created_by ? profilesMap.get(order.created_by) : undefined;

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
  }, []);

  const searchOrders = useCallback(async (query: string) => {
    const requestId = ++searchRequestIdRef.current;
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

    if (requestId !== searchRequestIdRef.current) return;

    const profilesMap = new Map(profilesRef.current.map((profile: any) => [profile.id, profile]));
    const results = rawOrders.map((order: any) => {
      const assignedProfile = order.assigned_to ? profilesMap.get(order.assigned_to) : undefined;
      const creatorProfile = order.created_by ? profilesMap.get(order.created_by) : undefined;

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
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchAllData();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('global_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const text = payload.eventType === 'INSERT' ? 'Создан новый заказ' : 'Заказ обновлен';
        addNotification(text);
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          fetchAllData();
        }, 400);
      })
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, fetchAllData]);

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

  const notifyTelegram = useCallback(async (chatId: string, text: string) => {
    const token = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
    });
  }, []);

  const handleDelete = useCallback(async (id: string, chatId: string | null, title: string, status = '') => {
    if (!confirm(`Удалить заказ "${title}"?`)) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (!error) {
      toast({ title: "Заказ удален" });
      if (chatId && status !== 'completed') {
        await notifyTelegram(chatId, `⚠️ Заказ отменен админом: ${title}`);
      }
      fetchAllData();
    }
  }, [fetchAllData, notifyTelegram, toast]);

  const openAssignModal = useCallback((id: string) => {
    setAssigningOrderId(id);
    setAssignPreviewStaffId(null);
    setIsAssignModalOpen(true);
  }, []);

  const openWorkerOnKanban = useCallback((workerId: string) => {
    setSelectedWorkerId(workerId);
    setView('orders');
    setDisplayMode('kanban');
    setActiveTab('active');
  }, []);

  const toggleStaffExpanded = useCallback((staffId: string) => {
    setExpandedStaffIds(prev => ({ ...prev, [staffId]: !prev[staffId] }));
  }, []);

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

  const handleComplete = useCallback((id: string) => {
    setCompletingOrderId(id);
    setCompletionPhotos([]);
  }, []);

  const submitOrderCompletion = async () => {
    if (!completingOrderId) return;
    setIsCompletingOrder(true);
    try {
      const order = orders.find(item => item.id === completingOrderId);
      if (!order) throw new Error('Заказ не найден. Обновите список и попробуйте снова.');
      if (completionPhotos.some(file => !file.type.startsWith('image/'))) {
        throw new Error('Фотоотчет должен содержать только изображения.');
      }

      const { data: currentOrder, error: fetchError } = await supabase
        .from('orders')
        .select('image_urls')
        .eq('id', completingOrderId)
        .single();
      if (fetchError) throw fetchError;
      const currentImages = Array.isArray(currentOrder.image_urls)
        ? currentOrder.image_urls as string[]
        : Array.isArray(order.image_urls)
          ? order.image_urls
          : [];
      const uploadedPhotos: string[] = [];

      for (const file of completionPhotos) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `reports/${completingOrderId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('order-photos').upload(filePath, file, {
          contentType: file.type,
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('order-photos').getPublicUrl(filePath);
        uploadedPhotos.push(data.publicUrl);
      }

      const { error } = await supabase.from('orders').update({
        status: 'completed',
        image_urls: [...currentImages, ...uploadedPhotos],
      }).eq('id', completingOrderId);
      if (error) throw error;
      void import('canvas-confetti').then((m) =>
        m.default({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#C62828', '#10B981', '#F59E0B', '#FFFFFF'],
        })
      );
      toast({ title: "Заказ завершен!", description: uploadedPhotos.length ? 'Фотоотчет прикреплен.' : undefined });
      setCompletingOrderId(null);
      setCompletionPhotos([]);
      await fetchAllData();
    } catch (err: any) {
      toast({ title: 'Не удалось завершить заказ', description: err.message, variant: 'destructive' });
    } finally {
      setIsCompletingOrder(false);
    }
  };

  const handleRestore = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'in_progress' }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Заказ возвращен в работу' });
      fetchAllData();
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  }, [fetchAllData, toast]);

  const handleTransferToInstallation = useCallback(async (id: string) => {
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

      const orderTitle = ordersRef.current.find(o => o.id === id)?.title || 'Неизвестный объект';
      const text = `🛠 <b>ПЕРЕДАНО МОНТАЖНИКАМ!</b>\n\nНапечатанный баннер готов:\n📍 Объект: <b>${orderTitle}</b>\n\nЗайдите в раздел «🆓 Свободные заказы» в боте.`;
      await notifyTelegram(GROUP_ID, text);

      toast({ title: "Заказ передан монтажникам!" });
      fetchAllData();
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  }, [fetchAllData, notifyTelegram, toast]);

  const executeExport = async () => {
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

    try {
      const { default: writeExcelFile } = await import('write-excel-file/browser');
      const sheetData = [
        [
          { value: 'Объект', fontWeight: 'bold' as const },
          { value: 'Описание', fontWeight: 'bold' as const },
          { value: 'Статус', fontWeight: 'bold' as const },
          { value: 'Дедлайн', fontWeight: 'bold' as const },
          { value: 'Отдел', fontWeight: 'bold' as const },
          { value: 'Тип заказа', fontWeight: 'bold' as const },
          { value: 'Исполнитель', fontWeight: 'bold' as const },
          { value: 'Создал (Админ)', fontWeight: 'bold' as const },
          { value: 'Дата создания', fontWeight: 'bold' as const },
        ],
        ...filteredForExport.map((o: any) => [
          { value: o.title || '' },
          { value: o.description || '-' },
          { value: o.status === 'completed' ? 'Завершен' : o.status === 'in_progress' ? 'В работе' : 'Новый' },
          { value: o.deadline ? new Date(o.deadline).toLocaleDateString('ru-RU') : '-' },
          { value: o.department === 'installation' ? 'Монтаж' : o.department === 'print' ? 'Печать' : o.department === 'production' ? 'Изготовление' : 'Не указан' },
          { value: o.is_general ? 'Общий' : 'Личный' },
          { value: o.profiles?.full_name || 'Не назначен' },
          { value: o.creator_name || 'Система' },
          { value: new Date(o.created_at).toLocaleDateString('ru-RU') },
        ]),
      ];

      let fileName = "Отчет_Монтажка";
      if (exportStart && exportEnd) fileName += `_${exportStart}_по_${exportEnd}`;
      await writeExcelFile(sheetData, { sheet: 'Заказы' }).toFile(`${fileName}.xlsx`);
      toast({ title: "Excel файл скачан!" });
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error('Ошибка экспорта в Excel:', err);
      alert('Не удалось сформировать Excel файл: ' + (err?.message || 'Неизвестная ошибка'));
    }
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

  const inProgressCount = useMemo(
    () => orders.filter(o => o.status === 'new' || o.status === 'in_progress').length,
    [orders]
  );

  const workloadStats = useMemo(() => {
    const todayStr = getAlmatyDateString(new Date());
    const ordersByUser: Record<string, Order[]> = {};
    const statsByUser: Record<string, { total: number; urgent: number }> = {};
    let assignedActiveCount = 0;
    let freeActiveCount = 0;
    let urgentActiveCount = 0;

    for (const order of orders) {
      if (order.status === 'completed' || order.status === 'cancelled') continue;
      const urgent = isOrderUrgent(order.deadline, todayStr);
      if (urgent) urgentActiveCount += 1;

      if (!order.assigned_to) {
        freeActiveCount += 1;
        continue;
      }

      assignedActiveCount += 1;
      if (!ordersByUser[order.assigned_to]) {
        ordersByUser[order.assigned_to] = [];
      }
      ordersByUser[order.assigned_to].push(order);

      const current = statsByUser[order.assigned_to] || { total: 0, urgent: 0 };
      current.total += 1;
      if (urgent) current.urgent += 1;
      statsByUser[order.assigned_to] = current;
    }

    const parseDeadlineTs = (d?: string | null) => {
      if (!d) return Number.POSITIVE_INFINITY;
      const ts = new Date(d).getTime();
      return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
    };

    for (const userId of Object.keys(ordersByUser)) {
      ordersByUser[userId].sort((a, b) => parseDeadlineTs(a.deadline) - parseDeadlineTs(b.deadline));
    }

    const staffWithWorkload = profiles.map((p: any) => {
      const displayName = String(p.full_name || p.name || 'Сотрудник');
      const userOrders = ordersByUser[p.id] || [];
      const counts = statsByUser[p.id] || { total: 0, urgent: 0 };
      const loadLevel: 'free' | 'medium' | 'high' =
        counts.total === 0 ? 'free' : counts.total <= 2 ? 'medium' : 'high';
      return {
        ...p,
        displayName,
        activeOrders: userOrders,
        activeCount: counts.total,
        urgentCount: counts.urgent,
        loadLevel,
      };
    });

    const freeStaffCount = staffWithWorkload.filter(
      (p) => p.role !== 'admin' && p.activeCount === 0
    ).length;

    const sortedStaffForTeam = [...staffWithWorkload].sort((a, b) => {
      if (staffSortBy === 'name') {
        return a.displayName.localeCompare(b.displayName, 'ru');
      }
      const aAdminZero = a.role === 'admin' && a.activeCount === 0 ? 1 : 0;
      const bAdminZero = b.role === 'admin' && b.activeCount === 0 ? 1 : 0;
      if (aAdminZero !== bAdminZero) return aAdminZero - bAdminZero;
      return a.activeCount - b.activeCount || a.displayName.localeCompare(b.displayName, 'ru');
    });

    const sortedInstallersForAssign = [...staffWithWorkload]
      .filter((p) => p.role !== 'admin')
      .sort((a, b) => a.activeCount - b.activeCount || a.displayName.localeCompare(b.displayName, 'ru'));

    return {
      todayStr,
      assignedActiveCount,
      freeActiveCount,
      urgentActiveCount,
      freeStaffCount,
      sortedStaffForTeam,
      sortedInstallersForAssign,
    };
  }, [orders, profiles, staffSortBy]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return orders.filter((o: any) => {
      const matchesSearch = (o.title || '').toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (selectedWorkerId === 'unassigned') {
        if (o.assigned_to) return false;
      } else if (selectedWorkerId !== 'all') {
        if (o.assigned_to !== selectedWorkerId) return false;
      }
      if (activeTab === 'active') return o.status === 'new' || o.status === 'in_progress';
      if (activeTab === 'completed') return o.status === 'completed';
      if (activeTab === 'general') return o.is_general === true;
      return true;
    });
  }, [orders, searchQuery, activeTab, selectedWorkerId]);

  const { newOrders, inProgressOrders, completedOrders } = useMemo(() => {
    const grouped = {
      newOrders: [] as Order[],
      inProgressOrders: [] as Order[],
      completedOrders: [] as Order[],
    };
    for (const o of filteredOrders) {
      if (o.status === 'new') grouped.newOrders.push(o);
      else if (o.status === 'in_progress') grouped.inProgressOrders.push(o);
      else if (o.status === 'completed') grouped.completedOrders.push(o);
    }
    return grouped;
  }, [filteredOrders]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="bg-card p-8 rounded-2xl border border-border border-t-4 border-t-primary shadow-xl w-full max-w-sm text-center">
          <h2 className="text-2xl font-bold mb-6 text-foreground tracking-tight">Montazhka <span className="text-primary">PRO</span></h2>
          <input type="password" placeholder="ПИН-код" className="w-full h-11 px-3 bg-background border border-border rounded-lg mb-4 text-center outline-none focus:border-primary transition" onKeyDown={e => e.key === 'Enter' && handleLogin()} onChange={e => setPassword(e.target.value)} />
          <Button onClick={handleLogin} disabled={isLoggingIn} className="w-full bg-primary hover:bg-primary/90 h-12">{isLoggingIn ? '...' : 'Войти'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-24 bg-background min-h-screen text-foreground transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        
        {/* СТАТИСТИКА */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <button
            type="button"
            onClick={() => { setView('orders'); setDisplayMode('kanban'); setActiveTab('all'); setSelectedWorkerId('all'); }}
            className={`text-left bg-card p-4 rounded-xl border border-border flex items-center gap-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] transition-all duration-200 cursor-pointer ${view === 'orders' && displayMode === 'kanban' && activeTab === 'all' && selectedWorkerId === 'all' ? 'ring-2 ring-primary/35 border-primary/50' : ''}`}
          >
            <div className="p-3 bg-primary/10 rounded-lg shrink-0"><BarChart3 className="text-primary" /></div>
            <div><p className="text-xs text-muted-foreground font-bold">Заказы</p><p className="text-2xl font-bold">{stats.total}</p></div>
          </button>
          <button
            type="button"
            onClick={() => { setView('orders'); setDisplayMode('kanban'); setActiveTab('active'); setSelectedWorkerId('all'); }}
            className={`text-left bg-card p-4 rounded-xl border border-border flex items-center gap-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] transition-all duration-200 cursor-pointer ${view === 'orders' && displayMode === 'kanban' && activeTab === 'active' && selectedWorkerId === 'all' ? 'ring-2 ring-primary/35 border-primary/50' : ''}`}
          >
            <div className="p-3 bg-amber-500/15 rounded-lg shrink-0"><Clock className="text-amber-600 dark:text-amber-400" /></div>
            <div><p className="text-xs text-muted-foreground font-bold">В работе</p><p className="text-2xl font-bold">{inProgressCount}</p></div>
          </button>
          <button
            type="button"
            onClick={() => { setView('orders'); setDisplayMode('kanban'); setActiveTab('completed'); setSelectedWorkerId('all'); }}
            className={`text-left bg-card p-4 rounded-xl border border-border flex items-center gap-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] transition-all duration-200 cursor-pointer ${view === 'orders' && displayMode === 'kanban' && activeTab === 'completed' && selectedWorkerId === 'all' ? 'ring-2 ring-primary/35 border-primary/50' : ''}`}
          >
            <div className="p-3 bg-emerald-500/10 rounded-lg shrink-0"><CheckCircle2 className="text-emerald-500" /></div>
            <div><p className="text-xs text-muted-foreground font-bold">Сделано</p><p className="text-2xl font-bold">{stats.done}</p></div>
          </button>
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-lg shrink-0"><X className="text-red-500" /></div>
            <div><p className="text-xs text-muted-foreground font-bold">Отменено</p><p className="text-2xl font-bold">{stats.cancelled}</p></div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-4 relative">
             <div className="p-3 bg-muted rounded-lg shrink-0">
                <Bell className={notifications.length > 0 ? "text-primary animate-pulse" : "text-muted-foreground"} />
             </div>
             <div className="flex-grow min-w-0">
                <p className="text-xs text-muted-foreground font-bold">Система</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {isCurrentUserLoading ? (
                    <div className="h-5 w-24 rounded-full bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
                  ) : currentUserName ? (
                    <span className="text-sm text-muted-foreground truncate">{currentUserName}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="shrink-0 ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 active:scale-95 transition"
                    title="Выйти"
                    aria-label="Выйти"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
             </div>
          </div>
        </div>

        {/* ПЕРЕКЛЮЧАТЕЛИ И КНОПКИ */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="h-10 inline-flex items-center bg-card p-1 rounded-xl border border-border shadow-sm">
              <button onClick={() => setView('orders')} className={`h-8 px-3.5 sm:px-4 rounded-lg text-sm font-bold whitespace-nowrap inline-flex items-center justify-center transition active:scale-[0.98] ${view === 'orders' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Заказы</button>
              <button onClick={() => setView('staff')} className={`h-8 px-3.5 sm:px-4 rounded-lg text-sm font-bold whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${view === 'staff' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <span>Команда</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold leading-none ${view === 'staff' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {profiles.length}
                </span>
              </button>
            </div>
            
            {view === 'orders' && (
              <div className="h-10 inline-flex items-center bg-card p-1 rounded-xl border border-border shadow-sm">
                <button onClick={() => setDisplayMode('kanban')} className={`h-8 px-3.5 sm:px-4 rounded-lg text-sm font-bold whitespace-nowrap inline-flex items-center justify-center transition active:scale-[0.98] ${displayMode === 'kanban' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>📊 Канбан</button>
                <button onClick={() => setDisplayMode('list')} className={`h-8 px-3.5 sm:px-4 rounded-lg text-sm font-bold whitespace-nowrap inline-flex items-center justify-center transition active:scale-[0.98] ${displayMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>📋 Список</button>
              </div>
            )}
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={() => setIsExportModalOpen(true)} className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1 md:flex-none whitespace-nowrap">Excel Отчет</Button>
            <Button onClick={() => {
              if (!currentUserId) {
                alert('❌ Ошибка: Вы не авторизованы. Пожалуйста, пройдите вход в систему, используя ПИН-код.');
                return;
              }
              setEditingOrderId(null);
              setDuplicateOrder(null);
              setIsModalOpen(true);
            }} className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex-1 md:flex-none whitespace-nowrap">Новый объект</Button>
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
                onEdit={handleEditOrder}
                onDuplicate={openDuplicateOrder}
                onDelete={handleDelete}
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
                <div className="flex flex-col lg:flex-row gap-3 mb-6 items-stretch lg:items-center">
                  <input placeholder="Поиск..." className="h-10 px-3 flex-grow w-full lg:max-w-sm bg-card border border-border rounded-lg outline-none focus:border-primary" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  <div className="flex items-center gap-2 w-full lg:w-auto">
                    <select
                      value={selectedWorkerId}
                      onChange={e => setSelectedWorkerId(e.target.value)}
                      aria-label="Фильтр по исполнителю"
                      className="h-10 px-3 flex-1 lg:w-64 bg-card text-foreground border border-border rounded-lg text-sm outline-none focus:border-primary transition"
                    >
                      <option value="all">👥 Все сотрудники</option>
                      <option value="unassigned">🔓 Не назначен ({workloadStats.freeActiveCount})</option>
                      {workloadStats.sortedInstallersForAssign.map((p) => {
                        const icon = p.activeCount === 0 ? '🟢' : p.activeCount <= 2 ? '🟡' : '🔴';
                        const urgentPart = p.urgentCount > 0 ? `, 🔥${p.urgentCount}` : '';
                        return (
                          <option key={p.id} value={p.id}>
                            {icon} {p.displayName} ({p.activeCount}{urgentPart})
                          </option>
                        );
                      })}
                    </select>
                    {selectedWorkerId !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setSelectedWorkerId('all')}
                        className="h-10 px-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 text-xs font-bold whitespace-nowrap inline-flex items-center gap-1 transition active:scale-[0.98]"
                        title="Сбросить фильтр по сотруднику"
                      >
                        Сбросить фильтр <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 bg-card p-1 rounded-lg border border-border w-full lg:w-auto lg:ml-auto">
                    {['active', 'general', 'completed', 'all'].map(t => (
                      <button key={t} onClick={() => setActiveTab(t as any)} className={`h-8 px-3 rounded-md text-xs font-bold whitespace-nowrap inline-flex items-center justify-center transition ${activeTab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        {t === 'active' ? '🔥 Актив' : t === 'general' ? '🌍 Общие' : t === 'completed' ? '✅ Архив' : '📦 Все'}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col md:flex-row gap-6 pb-6 items-start">
                    {[0, 1, 2].map((col) => (
                      <div key={col} className="w-full min-w-0 md:flex-1 bg-card/60 border border-border p-4 rounded-xl flex flex-col gap-4">
                        <div className="h-6 w-32 rounded bg-muted animate-pulse" />
                        {[0, 1].map((card) => (
                          <div key={card} className="h-64 rounded-xl bg-card border border-border p-5 space-y-4">
                            <div className="flex justify-between gap-2">
                              <div className="h-5 w-2/3 rounded bg-muted animate-pulse" />
                              <div className="h-5 w-16 rounded bg-muted animate-pulse" />
                            </div>
                            <div className="h-4 w-full rounded bg-muted animate-pulse" />
                            <div className="h-24 w-full rounded-lg bg-muted/60 animate-pulse" />
                            <div className="flex justify-between pt-2">
                              <div className="h-6 w-20 rounded bg-muted animate-pulse" />
                              <div className="h-6 w-24 rounded bg-muted animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row gap-6 md:overflow-x-auto pb-6 items-start">
                
                {/* КОЛОНКА 1: НОВЫЕ */}
                <div className="w-full min-w-0 md:min-w-[320px] md:flex-1 bg-muted/40 border border-border p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold border-b border-border pb-2 flex justify-between">🆕 Новые <span>{newOrders.length}</span></h3>
                  {newOrders.map((o: any) => (
                    <OrderCard key={o.id} order={o} onView={setViewingOrder} onEdit={handleEditOrder} onDuplicate={openDuplicateOrder} onDelete={handleDelete} onComplete={handleComplete} onAssignOrder={openAssignModal} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>

                {/* КОЛОНКА 2: В РАБОТЕ */}
                <div className="w-full min-w-0 md:min-w-[320px] md:flex-1 bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold border-b border-amber-500/20 pb-2 flex justify-between">⏳ В работе <span>{inProgressOrders.length}</span></h3>
                  {inProgressOrders.map((o: any) => (
                    <OrderCard key={o.id} order={o} onView={setViewingOrder} onEdit={handleEditOrder} onDuplicate={openDuplicateOrder} onDelete={handleDelete} onComplete={handleComplete} onAssignOrder={openAssignModal} onTransferToInstallation={handleTransferToInstallation} />
                  ))}
                </div>

                {/* КОЛОНКА 3: ГОТОВО */}
                <div className="w-full min-w-0 md:min-w-[320px] md:flex-1 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col gap-4">
                  <h3 className="font-bold border-b border-emerald-500/20 pb-2 flex justify-between">✅ Готово <span>{completedOrders.length}</span></h3>
                  {completedOrders.map((o: any) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onView={setViewingOrder}
                      onEdit={handleEditOrder}
                      onDuplicate={openDuplicateOrder}
                      onDelete={handleDelete}
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
          <div className="space-y-6">
            {/* СВОДНАЯ ПАНЕЛЬ ЗАНЯТОСТИ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3.5">
                <div className="p-2.5 bg-emerald-500/10 rounded-lg shrink-0 text-lg leading-none">🟢</div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-bold">Свободны сейчас</p>
                  <p className="text-2xl font-bold">{workloadStats.freeStaffCount}</p>
                </div>
              </div>
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3.5">
                <div className="p-2.5 bg-amber-500/10 rounded-lg shrink-0 text-lg leading-none">👷</div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-bold">В работе у команды</p>
                  <p className="text-2xl font-bold">{workloadStats.assignedActiveCount}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openWorkerOnKanban('unassigned')}
                className="text-left bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 active:scale-[0.99] transition-all duration-200 cursor-pointer"
                title="Открыть нераспределённые заказы на Канбане"
              >
                <div className="p-2.5 bg-primary/10 rounded-lg shrink-0 text-lg leading-none">🔓</div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-bold">Свободные заказы →</p>
                  <p className="text-2xl font-bold">{workloadStats.freeActiveCount}</p>
                </div>
              </button>
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3.5">
                <div className="p-2.5 bg-destructive/10 rounded-lg shrink-0"><Flame className="w-5 h-5 text-destructive" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-bold">Горящие дедлайны</p>
                  <p className="text-2xl font-bold">{workloadStats.urgentActiveCount}</p>
                </div>
              </div>
            </div>

            {/* ПАНЕЛЬ СОРТИРОВКИ */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Занятость сотрудников</h2>
                <p className="text-xs text-muted-foreground">Нажмите на блок заказов в карточке, чтобы увидеть активные объекты сотрудника</p>
              </div>
              <div className="h-9 inline-flex items-center bg-card p-1 rounded-xl border border-border shadow-sm">
                <button
                  type="button"
                  onClick={() => setStaffSortBy('load')}
                  className={`h-7 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition ${staffSortBy === 'load' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Сначала свободные
                </button>
                <button
                  type="button"
                  onClick={() => setStaffSortBy('name')}
                  className={`h-7 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition ${staffSortBy === 'name' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  По алфавиту
                </button>
              </div>
            </div>

            {/* СЕТКА СОТРУДНИКОВ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {workloadStats.sortedStaffForTeam.map((p: any) => {
                const loadBadge = getLoadBadgeInfo(p.activeCount);
                const isExpanded = Boolean(expandedStaffIds[p.id]);
                const hasRoles = Boolean(p.can_design || p.can_print || p.can_install);

                return (
                  <div key={p.id} className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col justify-between min-w-0 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <span className="truncate">{p.displayName}</span>
                          {p.role === 'admin' && <span className="shrink-0" title="Администратор">🛡️</span>}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap ${loadBadge.badgeClass}`}>
                            {loadBadge.icon} {loadBadge.label}
                          </span>
                          {p.urgentCount > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md font-bold bg-destructive/10 text-destructive border border-destructive/20 inline-flex items-center gap-1 whitespace-nowrap">
                              <Flame className="w-3 h-3" /> {p.urgentCount} горит
                            </span>
                          )}
                          {isAdmin && (
                            <span className="text-[11px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border whitespace-nowrap">
                              PIN: {p.pin_code}
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider whitespace-nowrap ${
                            p.telegram_chat_id 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                          }`}>
                            {p.telegram_chat_id ? '✅ Бот активен' : '❌ Нет бота'}
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <button onClick={() => deleteStaff(p.id)} className="shrink-0 h-8 w-8 inline-flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg transition" title="Удалить сотрудника" aria-label={`Удалить сотрудника ${p.displayName}`}>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {isAdmin ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs mb-4">
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={Boolean(p.can_design)} onChange={() => toggleRole(p.id, 'can_design', Boolean(p.can_design))} /> 🎨 Дизайн</label>
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={Boolean(p.can_print)} onChange={() => toggleRole(p.id, 'can_print', Boolean(p.can_print))} /> 🖨 Печать</label>
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={Boolean(p.can_install)} onChange={() => toggleRole(p.id, 'can_install', Boolean(p.can_install))} /> 🛠 Монтаж</label>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 text-[11px] mb-4">
                        {p.can_design && <span className="px-2 py-0.5 rounded bg-muted text-foreground font-medium">🎨 Дизайн</span>}
                        {p.can_print && <span className="px-2 py-0.5 rounded bg-muted text-foreground font-medium">🖨 Печать</span>}
                        {p.can_install && <span className="px-2 py-0.5 rounded bg-muted text-foreground font-medium">🛠 Монтаж</span>}
                        {!hasRoles && <span className="text-xs text-muted-foreground">Отделы не назначены</span>}
                      </div>
                    )}

                    <div className="border-t border-border pt-3 mt-auto space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStaffExpanded(p.id)}
                          className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-muted/60 hover:bg-muted text-xs font-bold text-foreground inline-flex items-center justify-between gap-2 transition active:scale-[0.98]"
                        >
                          <span className="truncate">
                            {p.activeCount > 0 ? `📋 Активные заказы: ${p.activeCount}` : '🟢 Свободен — заказов нет'}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openWorkerOnKanban(p.id)}
                          className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary text-xs font-bold whitespace-nowrap transition active:scale-[0.98] shrink-0"
                          title={`Показать заказы сотрудника ${p.displayName} на Канбане`}
                        >
                          На доске →
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="bg-background/70 rounded-lg border border-border p-2 space-y-1.5">
                          {p.activeOrders.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Сейчас свободен — активных заказов нет
                            </p>
                          ) : (
                            p.activeOrders.map((ord: Order, idx: number) => {
                              const urgent = isOrderUrgent(ord.deadline, workloadStats.todayStr);
                              return (
                                <button
                                  key={ord.id}
                                  type="button"
                                  onClick={() => setViewingOrder(ord)}
                                  className="w-full text-left p-2 rounded-md bg-card hover:bg-muted border border-border/70 transition flex items-start justify-between gap-2 group"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-foreground group-hover:text-primary truncate transition-colors">
                                      {idx + 1}. {ord.title}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                                      <span className="px-1.5 py-0.5 rounded bg-muted font-medium">
                                        {getDepartmentLabel(ord.department)}
                                      </span>
                                      {ord.deadline && (
                                        <span className={`inline-flex items-center gap-1 font-medium ${urgent ? 'text-destructive font-bold' : ''}`}>
                                          <Calendar className="w-3 h-3" />
                                          {new Date(ord.deadline).toLocaleDateString('ru-RU')}
                                          {urgent ? ' 🔥' : ''}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isAdmin && <Button onClick={addStaff} className="min-h-[180px] h-full border-dashed border-2 bg-transparent text-muted-foreground hover:bg-muted/40 hover:border-primary hover:text-primary">+ Добавить сотрудника</Button>}
            </div>
          </div>
        )}

        {/* МОДАЛКИ */}
        <Dialog open={isModalOpen} onOpenChange={open => {
          setIsModalOpen(open);
          if (!open) setDuplicateOrder(null);
        }}>
          <DialogContent className="max-w-xl bg-card border-border text-foreground p-0 shadow-2xl overflow-hidden">
            <DialogHeader className="p-6 pb-0"><DialogTitle className="pr-8 text-xl font-bold uppercase italic tracking-tight text-foreground">Параметры объекта</DialogTitle></DialogHeader>
            <OrderForm orderId={editingOrderId} duplicateFrom={duplicateOrder} onSave={() => { setIsModalOpen(false); setDuplicateOrder(null); fetchAllData(); }} creatorId={currentUserId || ''} editorName={currentUserName || undefined} />
          </DialogContent>
        </Dialog>

        <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
          <DialogContent className="max-w-sm bg-card border-border text-foreground shadow-2xl">
            <DialogHeader><DialogTitle className="pr-8 text-lg font-bold text-foreground">Выгрузка в Excel</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div><label className="block text-xs font-bold text-muted-foreground uppercase mb-1">С даты:</label><input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full h-10 px-3 bg-background border border-border rounded outline-none focus:border-primary" /></div>
              <div><label className="block text-xs font-bold text-muted-foreground uppercase mb-1">По дату:</label><input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full h-10 px-3 bg-background border border-border rounded outline-none focus:border-primary" /></div>
              <Button onClick={executeExport} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold mt-2">Скачать таблицу</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isAssignModalOpen} onOpenChange={(open) => {
          setIsAssignModalOpen(open);
          if (!open) setAssignPreviewStaffId(null);
        }}>
          <DialogContent className="max-w-md bg-card border-border text-foreground shadow-2xl">
            <DialogHeader>
              <DialogTitle className="pr-8 text-lg font-bold text-foreground">Кому передать в работу?</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {workloadStats.sortedInstallersForAssign.map(p => {
                const badge = getLoadBadgeInfo(p.activeCount);
                const isPreviewOpen = assignPreviewStaffId === p.id;
                return (
                  <div key={p.id} className="rounded-lg border border-border bg-muted/40 overflow-hidden">
                    <div className="flex items-center gap-1.5 p-1.5">
                      <Button
                        type="button"
                        onClick={() => executeAssign(p.id)}
                        className="flex-1 min-w-0 justify-between bg-card hover:bg-primary hover:text-primary-foreground text-foreground font-bold transition border border-border h-auto py-2 px-3"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0">{badge.icon}</span>
                          <span className="truncate">{p.displayName}</span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0 ml-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-muted text-foreground font-bold">
                            {p.activeCount} зак.
                          </span>
                          {p.urgentCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-bold">
                              🔥 {p.urgentCount}
                            </span>
                          )}
                        </span>
                      </Button>
                      {p.activeCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setAssignPreviewStaffId(isPreviewOpen ? null : p.id)}
                          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition"
                          title={isPreviewOpen ? 'Скрыть заказы' : 'Посмотреть текущие заказы'}
                          aria-label={`Текущие заказы сотрудника ${p.displayName}`}
                        >
                          {isPreviewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    {isPreviewOpen && p.activeOrders.length > 0 && (
                      <div className="border-t border-border bg-background/70 px-3 py-2 space-y-1.5">
                        {p.activeOrders.map((ord: Order, idx: number) => {
                          const urgent = isOrderUrgent(ord.deadline, workloadStats.todayStr);
                          return (
                            <div key={ord.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-foreground font-medium">
                                {idx + 1}. {ord.title}
                              </span>
                              <span className={`shrink-0 text-[11px] ${urgent ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                {ord.deadline ? new Date(ord.deadline).toLocaleDateString('ru-RU') : 'без срока'}
                                {urgent ? ' 🔥' : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!completingOrderId} onOpenChange={(open) => {
          if (!open && !isCompletingOrder) {
            setCompletingOrderId(null);
            setCompletionPhotos([]);
          }
        }}>
          <DialogContent className="max-w-lg border-border bg-card text-card-foreground shadow-2xl">
            <DialogHeader>
              <DialogTitle className="pr-8 text-lg font-bold text-card-foreground">Завершение заказа</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Прикрепите фотографии выполненной работы. Они попадут в фотоотчеты отдельно от макетов заказа.</p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setCompletionPhotos(Array.from(event.target.files || []))}
                className="block w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-accent-foreground"
              />
              {completionPhotos.length > 0 && <p className="text-xs text-muted-foreground">Выбрано фотографий: {completionPhotos.length}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" disabled={isCompletingOrder} onClick={() => setCompletionPhotos([])}>Сбросить фото</Button>
                <Button disabled={isCompletingOrder} onClick={submitOrderCompletion} className="bg-emerald-600 font-bold text-white hover:bg-emerald-700">
                  {isCompletingOrder ? 'Завершение...' : completionPhotos.length ? 'Завершить с фотоотчетом' : 'Завершить без фото'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
          <DialogContent className="max-w-2xl bg-card border-border text-foreground shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
            <DialogHeader>
              <DialogTitle className="pr-8 text-xl font-bold text-foreground uppercase">Полная информация о заказе</DialogTitle>
            </DialogHeader>
            
            {viewingOrder && (
              <div className="space-y-6 py-4">
                {/* ОСНОВНАЯ ИНФОРМАЦИЯ */}
                <div>
                  <h3 className="font-bold text-lg text-primary mb-2 break-words">{viewingOrder.title}</h3>
                  <div className="flex gap-2 flex-wrap mb-3">
                    <span className={`text-[10px] px-3 py-1 rounded font-bold uppercase ${viewingOrder.department === 'print' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : viewingOrder.department === 'production' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'}`}>
                      {viewingOrder.department === 'print' ? '🖨 Печать' : viewingOrder.department === 'production' ? '🏭 Изготовление' : '🛠 Монтаж'}
                    </span>
                    <span className={`text-[10px] px-3 py-1 rounded font-bold uppercase ${
                      viewingOrder.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 
                      viewingOrder.status === 'in_progress' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Дедлайн</p>
                    <p className="text-foreground font-medium break-words">{viewingOrder.deadline ? new Date(viewingOrder.deadline).toLocaleDateString('ru-RU') : '—'}</p>
                  </div>
                  
                  <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Исполнитель</p>
                    <p className="text-foreground font-medium break-words">
                      {viewingOrder.is_general ? 'Общий заказ' : (viewingOrder.profiles?.full_name || 'Не назначен')}
                    </p>
                  </div>

                  {viewingOrder.dimensions && (
                    <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Размеры</p>
                      <p className="text-foreground font-medium break-words">{viewingOrder.dimensions}</p>
                    </div>
                  )}

                  {viewingOrder.material && (
                    <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Материал</p>
                      <p className="text-foreground font-medium break-words">{viewingOrder.material}</p>
                    </div>
                  )}

                  {viewingOrder.source_link && (
                    <div className="bg-background/50 p-3 rounded-lg border border-border/50 sm:col-span-2">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Источник</p>
                      <a href={viewingOrder.source_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                        {viewingOrder.source_link}
                      </a>
                    </div>
                  )}

                  <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Создал</p>
                    <p className="text-foreground font-medium break-words">{viewingOrder.creator_name || 'Админ'}</p>
                  </div>
                </div>

                {/* ИЗОБРАЖЕНИЯ */}
                {viewingOrder.image_urls && Array.isArray(viewingOrder.image_urls) && viewingOrder.image_urls.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase mb-3">Изображения</p>
                    <div className="grid grid-cols-2 gap-3">
                      {viewingOrder.image_urls && Array.isArray(viewingOrder.image_urls) && viewingOrder.image_urls.map((url: string, idx: number) => (
                        <a key={`preview-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="relative group overflow-hidden rounded-lg border border-border">
                          <img src={url} alt={`Изображение ${idx + 1}`} className="w-full h-auto object-cover group-hover:scale-105 transition" />
                          <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-foreground">📷 Фото</span>
                        </a>
                      ))}
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