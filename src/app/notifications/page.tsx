"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, Heart, Repeat, MessageSquare, UserPlus, 
  Loader2, ChevronLeft, Check, CheckCheck
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { 
  collection, query, orderBy, limit, onSnapshot, 
  where, updateDoc, doc, writeBatch, Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface Notification {
  id: string;
  type: 'like' | 'retweet' | 'comment' | 'follow';
  fromUserId: string;
  fromUserName: string;
  fromUserImage: string;
  postId?: string;
  postContent?: string;
  message: string;
  timestamp: any;
  isRead: boolean;
  createdAt: any;
}

const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return '';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}分前`;
  } else if (diffHours < 24) {
    return `${diffHours}時間前`;
  } else if (diffDays < 7) {
    return `${diffDays}日前`;
  } else {
    return date.toLocaleDateString('ja-JP');
  }
};

export default function NotificationsPage() {
  const { isAuthenticated, currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { hasPremium: isPremium, isLoading: subscriptionLoading } = useSubscription();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'like' | 'retweet' | 'comment'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  // 認証チェック
  useEffect(() => {
    if (!subscriptionLoading && !isAuthenticated && !currentUser) {
      router.push('/login');
    }
  }, [isAuthenticated, currentUser, router, subscriptionLoading]);

  // 通知を取得
  useEffect(() => {
    if (!currentUser || !db) return;

    const notificationsRef = collection(db, 'users', currentUser.uid, 'notifications');
    const notificationsQuery = query(
      notificationsRef,
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Notification));
        
        setNotifications(notificationsData);
        setUnreadCount(notificationsData.filter(n => !n.isRead).length);
        setLoadingNotifications(false);
      },
      (error) => {
        console.error('Error fetching notifications:', error);
        toast({
          title: "エラー",
          description: "通知の取得に失敗しました。",
          variant: "destructive",
        });
        setLoadingNotifications(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, toast]);

  // 通知を既読にする
  const markAsRead = async (notificationId: string) => {
    if (!currentUser || !db) return;

    try {
      const notificationRef = doc(db, 'users', currentUser.uid, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // すべて既読にする
  const markAllAsRead = async () => {
    if (!currentUser || !db || notifications.length === 0) return;

    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.isRead);
      
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db!, 'users', currentUser.uid, 'notifications', notification.id);
        batch.update(notificationRef, {
          isRead: true,
          readAt: Timestamp.now()
        });
      });

      await batch.commit();
      toast({
        title: "すべて既読にしました",
        description: `${unreadNotifications.length}件の通知を既読にしました。`,
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: "エラー",
        description: "既読処理に失敗しました。",
        variant: "destructive",
      });
    }
  };

  // 通知アイコンを取得
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-5 w-5 text-red-500 fill-current" />;
      case 'retweet':
        return <Repeat className="h-5 w-5 text-green-500" />;
      case 'comment':
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  // フィルタリングされた通知
  const filteredNotifications = filterType === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filterType);

  if (subscriptionLoading || loadingNotifications) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold">通知</h1>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                すべて既読
              </Button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
              className="flex-shrink-0"
            >
              すべて
            </Button>
            <Button
              variant={filterType === 'like' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('like')}
              className="flex-shrink-0"
            >
              <Heart className="h-4 w-4 mr-1" />
              いいね
            </Button>
            <Button
              variant={filterType === 'retweet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('retweet')}
              className="flex-shrink-0"
            >
              <Repeat className="h-4 w-4 mr-1" />
              リツイート
            </Button>
            <Button
              variant={filterType === 'comment' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('comment')}
              className="flex-shrink-0"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              コメント
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {filterType === 'all' ? '通知はありません' : `${filterType}の通知はありません`}
              </p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                  !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => {
                  markAsRead(notification.id);
                  if (notification.postId) {
                    router.push('/community');
                  }
                }}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 pt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="w-10 h-10 flex-shrink-0">
                    <Image
                      src={notification.fromUserImage || 'https://placehold.co/40x40/FFB6C1/FFFFFF?text=U'}
                      alt={notification.fromUserName}
                      width={40}
                      height={40}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm">
                          <span className="font-bold">{notification.fromUserName}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {notification.type === 'like' && ' があなたの投稿にいいねしました'}
                            {notification.type === 'retweet' && ' があなたの投稿をリツイートしました'}
                            {notification.type === 'comment' && ' があなたの投稿にコメントしました'}
                            {notification.type === 'follow' && ' があなたをフォローしました'}
                          </span>
                        </p>
                        {notification.postContent && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {notification.postContent}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(notification.timestamp)}
                        </span>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}