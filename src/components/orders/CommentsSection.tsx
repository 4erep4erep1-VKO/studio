"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Comment } from '@/lib/types';
import { getComments, addComment, subscribeToComments } from '@/lib/api';
import { cn, playNotificationSound } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CommentsSectionProps {
  orderId: string;
  currentUserId?: string;
  currentUserName?: string;
  className?: string;
}

export function CommentsSection({
  orderId,
  currentUserId,
  currentUserName,
  className
}: CommentsSectionProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Загрузка комментариев при монтировании
  useEffect(() => {
    const loadComments = async () => {
      try {
        setIsLoading(true);
        const data = await getComments(orderId);
        setComments(data);
      } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadComments();
  }, [orderId]);

  // Подписка на realtime обновления
  useEffect(() => {
    const unsubscribe = subscribeToComments(orderId, (newComment) => {
      setComments((prev) =>
        prev.some((comment) => comment.id === newComment.id)
          ? prev
          : [...prev, newComment]
      );
    });

    return unsubscribe;
  }, [orderId]);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim()) return;

    try {
      setIsSubmitting(true);
      const comment = await addComment(orderId, newComment);
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      toast({ title: 'Комментарий добавлен' });
      playNotificationSound();
    } catch (error: any) {
      console.error('Ошибка добавления комментария:', error);
      toast({
        title: 'Ошибка добавления комментария',
        description: error?.message || 'Попробуйте снова.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className={cn("flex flex-col h-96", className)}>
      <CardContent className="flex-1 flex flex-col p-4">
        {/* Заголовок */}
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Комментарии ({comments.length})
          </span>
        </div>

        {/* Список комментариев */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <div className="text-sm text-muted-foreground">Загрузка...</div>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex items-center justify-center h-20">
              <div className="text-sm text-muted-foreground">Нет комментариев</div>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs">
                    {getInitials(comment.userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">
                      {comment.userName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(comment.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm text-foreground break-words">
                    {comment.message}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Форма добавления комментария */}
        {currentUserId && currentUserName && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ваш комментарий..."
              className="min-h-[60px] resize-none"
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newComment.trim() || isSubmitting}
              className="h-[60px] w-[60px] flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}