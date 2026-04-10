'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Shield, Mail, Lock, Plus, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { useProfiles } from '@/hooks/use-profiles'
import { createProfile, updateProfilePin } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export default function AdminTeamPage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading, getRole } = useAuth()
  const { profiles, isLoading: isProfilesLoading, refresh } = useProfiles()
  const [isReady, setIsReady] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'installer' | 'admin'>('installer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { toast } = useToast()

  const isAdmin = getRole() === 'admin'

  useEffect(() => {
    if (!isAuthLoading) {
      if (!user) {
        router.push('/login')
      } else if (!isAdmin) {
        router.push('/')
      } else {
        setIsReady(true)
      }
    }
  }, [user, isAuthLoading, isAdmin, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim() || !email.trim()) {
      setError('Укажите имя и email.')
      return
    }

    setIsSubmitting(true)
    try {
      await createProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        pin: '0000',
      })

      setName('')
      setEmail('')
      setRole('installer')
      toast({
        title: 'Пользователь добавлен',
        description: 'Профиль создан с PIN-кодом 0000.',
      })
      await refresh()
    } catch (err: any) {
      setError(err.message || 'Не удалось создать профиль.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPin = async (id: string) => {
    try {
      await updateProfilePin(id, '0000')
      toast({
        title: 'PIN сброшен',
        description: 'PIN-код установлен обратно на 0000.',
      })
      await refresh()
    } catch (err: any) {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось сбросить PIN.',
        variant: 'destructive',
      })
    }
  }

  if (isAuthLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-headline font-bold">Управление командой</h1>
            <p className="text-sm text-muted-foreground">Добавляйте монтажников и управляйте PIN-кодами.</p>
          </div>
          <Button variant="secondary" onClick={() => router.push('/admin')}>
            <Shield className="w-4 h-4" /> Назад в админку
          </Button>
        </div>

        <Card className="border-border/50">
          <CardHeader className="bg-secondary/10">
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Новый пользователь</CardTitle>
                <CardDescription>Добавьте пользователя команды с PIN 0000 по умолчанию.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="team-name">Имя</Label>
                <Input
                  id="team-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван Иванов"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="team-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="installer@example.com"
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Роль</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={`py-3 rounded-lg border text-sm font-medium transition ${role === 'installer' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}
                    onClick={() => setRole('installer')}
                    disabled={isSubmitting}
                  >
                    <Users className="w-4 h-4" /> Монтажник
                  </button>
                  <button
                    type="button"
                    className={`py-3 rounded-lg border text-sm font-medium transition ${role === 'admin' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}
                    onClick={() => setRole('admin')}
                    disabled={isSubmitting}
                  >
                    <Shield className="w-4 h-4" /> Админ
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">PIN-код по умолчанию для нового пользователя: <span className="text-foreground font-medium">0000</span>.</p>
                {error && <p className="text-sm text-destructive pt-2">{error}</p>}
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Сохраняем...' : 'Добавить пользователя'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="bg-secondary/10">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Список команды</CardTitle>
                <CardDescription>Существующие профили сотрудников и PIN-коды.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isProfilesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Профили не найдены. Добавьте первого сотрудника.</p>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => (
                  <div key={profile.id} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-4 items-center rounded-2xl border border-border p-4 bg-background/80">
                    <div>
                      <p className="font-semibold">{profile.name}</p>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.12em] text-muted-foreground">Роль</p>
                      <p className="mt-1 text-sm font-medium">{profile.role === 'admin' ? 'Админ' : 'Монтажник'}</p>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.12em] text-muted-foreground">PIN</p>
                      <p className="mt-1 text-sm font-medium">{profile.pin}</p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleResetPin(profile.id)}>
                        <RefreshCw className="w-4 h-4" /> Сбросить PIN
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
