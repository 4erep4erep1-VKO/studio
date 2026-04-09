import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function playNotificationSound(url = '/notification.wav') {
  if (typeof window === 'undefined') return

  const audio = new Audio(url)
  audio.volume = 0.35
  void audio.play().catch(() => {
    // Браузер может запретить воспроизведение без взаимодействия пользователя.
  })
}
