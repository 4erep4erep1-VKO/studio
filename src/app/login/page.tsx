'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Briefcase, Loader2, Eye, EyeOff, AlertCircle, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { signIn, signUp, getCurrentUser } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Проверяем, авторизован ли пользователь
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
          router.push('/')
        }
      } catch (err) {
        // Пользователь не авторизован, остаёмся на логине
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Все пользователи входят через Supabase auth с email и password
      await signIn(email, password)
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Ошибка входа. Проверьте данные и повторите попытку.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }

    if (!name.trim()) {
      setError('Укажите имя пользователя')
      return
    }

    setIsLoading(true)

    try {
      // Регистрируем как монтажника (роль может быть изменена админом позже)
      console.log('🚀 Starting registration process...');
      console.log('📧 Email:', email.trim().toLowerCase());
      console.log('👤 Name:', name.trim());

      const result = await signUp(email.trim().toLowerCase(), password, name.trim(), 'installer');

      console.log('✅ Registration successful:', result);

      setError('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setName('')
      setTab('signin')
      alert('Аккаунт создан! Теперь войдите с помощью email и пароля.')
    } catch (err: any) {
      console.error('❌ Registration failed:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.status,
        details: err
      });

      // Показываем более детальную ошибку
      let errorMessage = 'Ошибка регистрации.';
      if (err.message?.includes('Database error')) {
        errorMessage = 'Ошибка базы данных. Проверьте настройки Supabase.';
      } else if (err.message?.includes('already registered')) {
        errorMessage = 'Пользователь с таким email уже зарегистрирован.';
      } else if (err.message) {
        errorMessage = `Ошибка: ${err.message}`;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-500">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-headline font-bold">MontazhkaPRO</h1>
          <p className="text-muted-foreground text-sm">Профессиональная система управления монтажом v 3.0</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'signin' | 'signup')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/30">
            <TabsTrigger value="signin">Вход</TabsTrigger>
            <TabsTrigger value="signup">Регистрация</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-6 mt-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Вход в систему</CardTitle>
                <CardDescription>Введите ваши учетные данные</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email-signin">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email-signin"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password-signin">Пароль</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="password-signin"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Вход...
                      </>
                    ) : (
                      'Войти'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup" className="space-y-6 mt-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Создать аккаунт</CardTitle>
                <CardDescription>Зарегистрируйтесь для доступа к системе</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email-signup">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email-signup"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name-signup">Имя</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name-signup"
                        type="text"
                        placeholder="Иван Иванов"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password-signup">Пароль</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="password-signup"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Минимум 6 символов"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Подтверждение пароля</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Повторите пароль"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Регистрация...
                      </>
                    ) : (
                      'Зарегистрироваться'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
