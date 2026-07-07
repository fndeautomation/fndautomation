import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import type { ProjectInboxMessage, Profile } from '../../types/database';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

function formatTime(d: string) {
  const date = new Date(d);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  return format(date, 'dd MMM, h:mm a');
}

interface MessageRow extends ProjectInboxMessage {
  sender?: Profile;
}

export default function ProjectInbox({ projectId }: { projectId: string }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [projectId]);

  useEffect(() => {
    const channel = supabase
      .channel(`inbox:${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_inbox_messages', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          const msg = payload.new as ProjectInboxMessage;
          // fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', msg.sender_id)
            .maybeSingle();
          setMessages(prev => [...prev, { ...msg, sender: sender ?? undefined }]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('project_inbox_messages')
      .select('*, sender:sender_id(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    setMessages((data as MessageRow[]) ?? []);
  };

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from('project_inbox_messages').insert({
      project_id: projectId,
      sender_id: user.id,
      message: text.trim(),
    });

    if (!error) {
      if (profile?.role === 'admin') {
        const { data: proj } = await supabase.from('projects').select('assigned_to').eq('id', projectId).maybeSingle();
        const { data: fos } = await supabase.from('profiles').select('id').eq('role', 'finance_officer');
        const recipients = [...(fos?.map(f => f.id) ?? [])];
        if (proj?.assigned_to) {
          recipients.push(proj.assigned_to);
        }
        if (recipients.length) {
          await supabase.from('notifications').insert(
            recipients.map(rId => ({ recipient_id: rId, type: 'new_message' as const, reference_id: projectId }))
          );
        }
      } else if (profile?.role === 'director_pm') {
        const { data: fos } = await supabase.from('profiles').select('id').eq('role', 'finance_officer');
        if (fos?.length) {
          await supabase.from('notifications').insert(
            fos.map(fo => ({ recipient_id: fo.id, type: 'new_message' as const, reference_id: projectId }))
          );
        }
      } else {
        const { data: proj } = await supabase.from('projects').select('assigned_to').eq('id', projectId).maybeSingle();
        if (proj?.assigned_to) {
          await supabase.from('notifications').insert({
            recipient_id: proj.assigned_to,
            type: 'new_message' as const,
            reference_id: projectId,
          });
        }
      }
      setText('');
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[500px] border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">Project Inbox</h3>
        <p className="text-xs text-muted-foreground">Messages visible to Finance Officers and the assigned Director/PM only</p>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-xs">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => {
              const isOwn = msg.sender_id === user?.id;
              const showAvatar = i === 0 || messages[i - 1]?.sender_id !== msg.sender_id;
              const initials = msg.sender?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
              return (
                <div key={msg.id} className={cn('flex items-end gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                  <div className={cn('h-7 w-7 shrink-0', !showAvatar && 'invisible')}>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className={cn('text-[10px] font-bold', isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className={cn('max-w-[75%] space-y-1', isOwn ? 'items-end' : 'items-start', 'flex flex-col')}>
                    {showAvatar && (
                      <div className={cn('flex items-center gap-1.5 mb-0.5', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                        <span className="text-xs font-semibold text-foreground">{msg.sender?.full_name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{msg.sender?.label}</Badge>
                      </div>
                    )}
                    <div
                      className={cn(
                        'px-3 py-2 rounded-2xl text-sm leading-relaxed',
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      )}
                    >
                      {msg.message}
                    </div>
                    <span className="text-[11px] text-muted-foreground px-1">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t flex gap-2 bg-card">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message…"
          rows={1}
          className="resize-none text-sm min-h-[38px] max-h-24"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          size="icon"
          className="h-[38px] w-[38px] shrink-0 self-end"
          onClick={send}
          disabled={!text.trim() || sending}
        >
          <Send size={15} />
        </Button>
      </div>
    </div>
  );
}
