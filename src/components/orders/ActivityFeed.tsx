'use client';

import React, { useMemo, useState } from 'react';
import { Activity, Download, ExternalLink, Image as ImageIcon, MessageSquare, Pencil, X } from 'lucide-react';
import { Order } from '@/lib/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type FeedTab = 'all' | 'photos' | 'stages' | 'completed' | 'new';
type FeedEventType = FeedTab;

interface ActivityFeedProps {
  orders: Order[];
  profiles: any[];
  searchQuery: string;
  onSearch: (query: string) => void;
  onView: (order: any) => void;
  onEdit: (orderId: string) => void;
  onDuplicate: (order: Order) => void;
}

interface FeedEvent {
  id: string;
  type: FeedEventType;
  label: string;
  order: any;
  date: string;
}

const getOrderPhotos = (order: any): string[] => {
  const photoFields = [order.image_urls, order.photos, order.report_photos, order.report_photo];
  return Array.from(new Set(photoFields.flatMap((value) => {
    if (typeof value === 'string') return [value];
    if (!Array.isArray(value)) return [];
    return value.flatMap((photo) => {
      if (typeof photo === 'string') return [photo];
      if (photo && typeof photo.url === 'string') return [photo.url];
      return [];
    });
  }).filter(Boolean)));
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const departmentLabel = (department?: string) => {
  if (department === 'print') return 'ПЕЧАТЬ';
  if (department === 'production') return 'ИЗГОТОВЛЕНИЕ';
  return 'МОНТАЖ';
};

const eventStyle: Record<FeedEventType, { label: string; color: string; badge: string }> = {
  all: { label: 'СОБЫТИЕ', color: 'border-l-slate-500', badge: 'bg-slate-500/15 text-slate-400' },
  photos: { label: '📸 ФОТООТЧЕТ', color: 'border-l-pink-500', badge: 'bg-pink-500/15 text-pink-400' },
  stages: { label: '🔄 В РАБОТЕ', color: 'border-l-blue-500', badge: 'bg-blue-500/15 text-blue-400' },
  completed: { label: '✅ ВЫПОЛНЕНО', color: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400' },
  new: { label: '🆕 НОВЫЙ ЗАКАЗ', color: 'border-l-amber-500', badge: 'bg-amber-500/15 text-amber-400' },
};

const buildFeedEvents = (orders: Order[]): FeedEvent[] => orders.flatMap((order) => {
  const row = order as any;
  const photos = getOrderPhotos(row);
  const createdAt = row.created_at || row.updated_at || new Date().toISOString();
  const updatedAt = row.updated_at || createdAt;
  const events: FeedEvent[] = [{
    id: `${row.id}-created`,
    type: 'new',
    label: '🆕 НОВЫЙ ЗАКАЗ',
    order: row,
    date: createdAt,
  }];

  if (row.status === 'completed') {
    events.push({ id: `${row.id}-completed`, type: 'completed', label: '✅ ВЫПОЛНЕНО', order: row, date: updatedAt });
  } else if (row.status !== 'new' && row.status !== 'cancelled') {
    const status = String(row.status || '').toLowerCase();
    const label = status.includes('office') || status.includes('в офис')
      ? '🏢 В ОФИС'
      : status.includes('install') || status.includes('монтаж') || row.department === 'installation'
        ? '🔧 НА МОНТАЖ'
        : row.assigned_to
          ? '👤 НАЗНАЧЕН ИСПОЛНИТЕЛЬ'
          : '🔄 В РАБОТЕ';
    events.push({ id: `${row.id}-stage`, type: 'stages', label, order: row, date: updatedAt });
  }

  if (photos.length > 0) {
    events.push({ id: `${row.id}-photos`, type: 'photos', label: '📸 ФОТООТЧЕТ', order: row, date: updatedAt });
  }

  return events;
}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

const tabs: { id: FeedTab; label: string }[] = [
  { id: 'all', label: '🔥 Все события' },
  { id: 'photos', label: '📸 Фотоотчеты' },
  { id: 'stages', label: '🔄 В работе / Этапы' },
  { id: 'completed', label: '✅ Готово' },
  { id: 'new', label: '➕ Новые' },
];

export default function ActivityFeed({
  orders,
  profiles,
  searchQuery,
  onSearch,
  onView,
  onEdit,
  onDuplicate,
}: ActivityFeedProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [photoView, setPhotoView] = useState<'chat' | 'gallery'>('chat');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [visibleCount, setVisibleCount] = useState(50);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const events = useMemo(() => buildFeedEvents(orders), [orders]);
  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ru');
    return events.filter((event) => {
      const order = event.order;
      const employeeMatches = selectedEmployee === 'all' || order.assigned_to === selectedEmployee;
      if (!employeeMatches) return false;
      if (!query) return true;
      const searchableText = [
        order.title,
        order.description,
        order.creator_name,
        order.profiles?.full_name,
        departmentLabel(order.department),
        event.label,
      ].filter(Boolean).join(' ').toLocaleLowerCase('ru');
      return searchableText.includes(query);
    });
  }, [events, searchQuery, selectedEmployee]);

  const counts = useMemo(() => ({
    all: filteredEvents.length,
    photos: filteredEvents.filter((event) => event.type === 'photos').length,
    stages: filteredEvents.filter((event) => event.type === 'stages').length,
    completed: filteredEvents.filter((event) => event.type === 'completed').length,
    new: filteredEvents.filter((event) => event.type === 'new' && event.order.status === 'new').length,
  }), [filteredEvents]);

  const tabEvents = activeTab === 'all'
    ? filteredEvents
    : activeTab === 'new'
      ? filteredEvents.filter((event) => event.type === 'new' && event.order.status === 'new')
      : filteredEvents.filter((event) => event.type === activeTab);
  const pageEvents = tabEvents.slice(0, visibleCount);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black"><Activity className="h-5 w-5 text-primary" />Лента событий</h2>
            <p className="mt-1 text-sm text-muted-foreground">История заказов и фотоотчетов</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={searchQuery}
              onChange={(event) => { onSearch(event.target.value); setVisibleCount(50); }}
              placeholder="Поиск по заказам и сотрудникам..."
              className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:w-72"
            />
            <select
              value={selectedEmployee}
              onChange={(event) => { setSelectedEmployee(event.target.value); setVisibleCount(50); }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              aria-label="Фильтр по исполнителю"
            >
              <option value="all">Все сотрудники</option>
              {profiles.filter((profile) => profile.role !== 'admin').map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.full_name || profile.name || 'Сотрудник'}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setVisibleCount(50); }}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}<span className="rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/10">{counts[tab.id]}</span>
            </button>
          ))}
        </div>

        {activeTab === 'photos' && (
          <div className="mt-4 flex w-fit rounded-lg border border-border bg-background p-1">
            <button onClick={() => setPhotoView('chat')} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold ${photoView === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              <MessageSquare className="h-4 w-4" />Вид чата
            </button>
            <button onClick={() => setPhotoView('gallery')} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold ${photoView === 'gallery' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              <ImageIcon className="h-4 w-4" />Сетка фото
            </button>
          </div>
        )}
      </div>

      {pageEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <div className="mb-3 text-4xl">📭</div>
          Нет событий по выбранным фильтрам
        </div>
      ) : activeTab === 'photos' && photoView === 'gallery' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {pageEvents.flatMap((event) => getOrderPhotos(event.order).map((photo, index) => (
            <button key={`${event.id}-${photo}`} onClick={() => setLightbox({ photos: getOrderPhotos(event.order), index })} className="group relative overflow-hidden rounded-xl border border-border bg-card text-left">
              <img src={photo} alt={`Фото: ${event.order.title}`} loading="lazy" className="h-48 w-full object-cover transition group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 text-sm font-bold text-white">{event.order.title}</span>
            </button>
          )))}
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-3">
          {pageEvents.map((event) => {
            const order = event.order;
            const photos = getOrderPhotos(order);
            const style = eventStyle[event.type];
            const employeeName = order.profiles?.full_name || 'Не назначен';
            const creatorName = order.creator_name || 'Админ';
            return (
              <article key={event.id} className={`overflow-hidden rounded-xl border border-border border-l-4 ${style.color} bg-card shadow-sm`}>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{(creatorName[0] || 'С').toUpperCase()}</span>
                      <span className="font-semibold">{creatorName}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-muted-foreground">{employeeName}</span>
                      <span className={`rounded-md px-2 py-1 text-[10px] font-black tracking-wide ${style.badge}`}>{event.label || style.label}</span>
                    </div>
                    <time className="text-xs text-muted-foreground">{formatDate(event.date)}</time>
                  </div>

                  <div className="ml-10 mt-3">
                    <h3 className="text-lg font-extrabold leading-snug">{order.title || 'Без названия'}</h3>
                    {order.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{order.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-secondary/10 px-2 py-1 text-[10px] font-bold tracking-wide text-secondary">{departmentLabel(order.department)}</span>
                      {order.deadline && <span className="text-xs text-muted-foreground">📅 Дедлайн: {new Date(order.deadline).toLocaleDateString('ru-RU')}</span>}
                    </div>

                    {photos.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {photos.slice(0, 6).map((photo, index) => (
                          <button key={`${photo}-${index}`} onClick={() => setLightbox({ photos, index })} className="overflow-hidden rounded-lg border border-border bg-background">
                            <img src={photo} alt={`Фото ${index + 1}: ${order.title}`} loading="lazy" className="h-32 w-full object-cover transition hover:scale-105" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => onView(order)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:border-primary hover:text-primary">Открыть</button>
                      <button onClick={() => onEdit(order.id)} className="flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:border-primary hover:text-primary"><Pencil className="h-3.5 w-3.5" />Правка</button>
                      <button onClick={() => onDuplicate(order)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:border-primary hover:text-primary">Как образец</button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pageEvents.length < tabEvents.length && (
        <div className="text-center">
          <button onClick={() => setVisibleCount((count) => count + 50)} className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-bold hover:border-primary hover:text-primary">
            Показать еще 50 <span className="text-muted-foreground">({tabEvents.length - pageEvents.length} осталось)</span>
          </button>
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(open) => { if (!open) setLightbox(null); }}>
        <DialogContent className="max-w-6xl border-border bg-black/95 p-3 text-white sm:p-5">
          {lightbox && (
            <div className="relative flex min-h-[50vh] flex-col items-center justify-center gap-4">
              <button onClick={() => setLightbox(null)} aria-label="Закрыть" className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-2 hover:bg-black"><X className="h-5 w-5" /></button>
              <img src={lightbox.photos[lightbox.index]} alt="Фотоотчет" className="max-h-[72vh] max-w-full object-contain" />
              <div className="flex items-center gap-3">
                <button onClick={() => setLightbox((current) => current && ({ ...current, index: (current.index - 1 + current.photos.length) % current.photos.length }))} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">←</button>
                <span className="text-sm text-white/70">{lightbox.index + 1} / {lightbox.photos.length}</span>
                <button onClick={() => setLightbox((current) => current && ({ ...current, index: (current.index + 1) % current.photos.length }))} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">→</button>
                <a href={lightbox.photos[lightbox.index]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"><ExternalLink className="h-4 w-4" />Открыть оригинал</a>
                <a href={lightbox.photos[lightbox.index]} download className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"><Download className="h-4 w-4" />Скачать</a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
