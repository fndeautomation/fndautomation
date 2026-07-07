import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Briefcase, FileText, MessageSquare, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import type { Notification, NotificationType } from '../../types/database';
import { Button } from '../../components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { ScrollArea } from '../../components/ui/scroll-area';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';

const typeConfig: Record<NotificationType, { icon: typeof Bell; label: string; color: string }> = {
  project_assigned: { icon: Briefcase, label: 'Project assigned to you', color: 'text-blue-600' },
  claim_raised: { icon: FileText, label: 'New claim submitted', color: 'text-amber-600' },
  claim_approved: { icon: DollarSign, label: 'Claim approved', color: 'text-green-600' },
  claim_rejected: { icon: DollarSign, label: 'Claim rejected', color: 'text-red-600' },
  claim_commented: { icon: MessageSquare, label: 'Comment on claim', color: 'text-blue-600' },
  new_message: { icon: MessageSquare, label: 'New project message', color: 'text-primary' },
};

export default function NotificationBell() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifications(data ?? []);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new as Notification, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Notification;
            setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = async (n: Notification) => {
    await markRead(n.id);
    setOpen(false);
    if (n.reference_id) {
      const role = profile?.role;
      if (n.type === 'new_message') {
        const base = role === 'admin' ? '/admin' : role === 'finance_officer' ? '/finance' : '/director';
        navigate(`${base}/projects/${n.reference_id}?tab=inbox`);
      } else if (n.type === 'project_assigned') {
        const base = role === 'admin' ? '/admin' : role === 'finance_officer' ? '/finance' : '/director';
        navigate(`${base}/projects/${n.reference_id}`);
      } else if (['claim_raised', 'claim_approved', 'claim_rejected', 'claim_commented'].includes(n.type)) {
        if (role === 'admin') {
          navigate('/admin/projects');
        } else if (role === 'finance_officer') {
          navigate('/finance/claims');
        } else {
          navigate(`/director/projects`);
        }
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center leading-none border border-background">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <CheckCheck size={12} /> Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(n => {
                const cfg = typeConfig[n.type];
                const Icon = cfg?.icon ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors',
                      !n.is_read && 'bg-blue-50/50'
                    )}
                  >
                    <div className={cn('mt-0.5 shrink-0', cfg?.color ?? 'text-muted-foreground')}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs leading-snug', !n.is_read ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                        {cfg?.label ?? n.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
