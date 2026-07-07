import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, MessageSquare, Send } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import type { ClaimWithDetails, ClaimComment, Profile } from '../../../types/database';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import StatusBadge from '../../../components/shared/StatusBadge';
import { useToast } from '../../../hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Separator } from '../../../components/ui/separator';

function formatPKR(v: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(v);
}

interface Props {
  claimId: string;
  onUpdated: () => void;
}

export default function ClaimReviewPanel({ claimId, onUpdated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [claim, setClaim] = useState<ClaimWithDetails | null>(null);
  const [comments, setComments] = useState<(ClaimComment & { author?: Profile })[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    loadClaim();
    loadComments();
  }, [claimId]);

  const loadClaim = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('claims')
      .select(`
        *,
        milestone:milestone_id(*),
        engineer:project_engineer_id(*),
        raised_by_profile:raised_by(full_name, label),
        reviewed_by_profile:reviewed_by(full_name, label),
        project:project_id(short_id, name)
      `)
      .eq('id', claimId)
      .maybeSingle();
    setClaim(data as ClaimWithDetails);
    setLoading(false);
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from('claim_comments')
      .select('*, author:author_id(full_name, label, role)')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: true });
    setComments((data ?? []) as (ClaimComment & { author?: Profile })[]);
  };

  const sendComment = async () => {
    if (!comment.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('claim_comments').insert({
      claim_id: claimId,
      author_id: user.id,
      comment: comment.trim(),
    });
    if (!error) {
      setComment('');
      loadComments();
      // Notify Director/PM
      if (claim?.raised_by) {
        await supabase.from('notifications').insert({
          recipient_id: claim.raised_by,
          type: 'claim_commented',
          reference_id: claimId,
        });
      }
    }
    setSubmitting(false);
  };

  const approveClaim = async () => {
    if (!user || !claim) return;
    setActionLoading('approve');
    const { error } = await supabase
      .from('claims')
      .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', claimId);

    if (!error) {
      await supabase
        .from('milestones')
        .update({ status: 'approved' })
        .eq('id', claim.milestone_id);

      await supabase.from('notifications').insert({
        recipient_id: claim.raised_by,
        type: 'claim_approved',
        reference_id: claimId,
      });

      toast({ title: 'Claim approved', description: 'The Director/PM has been notified.' });
      loadClaim();
      onUpdated();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const markPaid = async () => {
    if (!claim) return;
    setActionLoading('approve');
    await supabase.from('milestones').update({ status: 'paid' }).eq('id', claim.milestone_id);
    toast({ title: 'Marked as paid' });
    loadClaim();
    onUpdated();
    setActionLoading(null);
  };

  const rejectClaim = async () => {
    if (!rejectReason.trim() || !user || !claim) {
      toast({ title: 'Rejection reason required', variant: 'destructive' });
      return;
    }
    setActionLoading('reject');

    const { error } = await supabase
      .from('claims')
      .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', claimId);

    if (!error) {
      await supabase.from('claim_comments').insert({
        claim_id: claimId,
        author_id: user.id,
        comment: `[Rejection reason] ${rejectReason.trim()}`,
      });

      await supabase.from('notifications').insert({
        recipient_id: claim.raised_by,
        type: 'claim_rejected',
        reference_id: claimId,
      });

      toast({ title: 'Claim rejected', description: 'The Director/PM has been notified.' });
      setShowRejectForm(false);
      setRejectReason('');
      loadClaim();
      loadComments();
      onUpdated();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!claim) return null;

  const isPending = claim.status === 'pending_review';
  const isApproved = claim.status === 'approved';
  const milestoneStatus = (claim.milestone as { status?: string })?.status;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-primary font-semibold">
              {(claim.project as { short_id?: string })?.short_id}
            </span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-xs text-muted-foreground">{(claim.milestone as { title?: string })?.title}</span>
          </div>
          <h3 className="font-semibold text-foreground">{(claim.project as { name?: string })?.name}</h3>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Amount</p>
          <p className="font-semibold text-foreground font-mono text-xs">{formatPKR(claim.amount)}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Raised by</p>
          <p className="font-medium text-foreground text-xs truncate">{(claim.raised_by_profile as { full_name?: string })?.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{(claim.raised_by_profile as { label?: string })?.label}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Submitted</p>
          <p className="font-medium text-foreground text-xs truncate">{format(new Date(claim.created_at), 'dd MMM yyyy')}</p>
          <p className="text-xs text-muted-foreground truncate">{formatDistanceToNow(new Date(claim.created_at), { addSuffix: true })}</p>
        </div>
      </div>

      {/* Milestone status */}
      {milestoneStatus && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Milestone:</span>
          <StatusBadge status={milestoneStatus as Parameters<typeof StatusBadge>[0]['status']} />
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="space-y-3">
          {showRejectForm ? (
            <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-700">Rejection reason (required)</p>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this claim is being rejected…"
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={rejectClaim}
                  disabled={actionLoading === 'reject'}
                >
                  {actionLoading === 'reject' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Confirm Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowRejectForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={approveClaim}
                disabled={!!actionLoading}
              >
                {actionLoading === 'approve' ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle size={15} className="mr-1.5" />
                )}
                Approve Claim
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setShowRejectForm(true)}
              >
                <XCircle size={15} className="mr-1.5" /> Reject
              </Button>
            </div>
          )}
        </div>
      )}

      {isApproved && milestoneStatus === 'approved' && (
        <Button
          className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
          variant="outline"
          onClick={markPaid}
          disabled={!!actionLoading}
        >
          {actionLoading === 'approve' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Mark as Paid
        </Button>
      )}

      <Separator />

      {/* Comments */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold">Discussion ({comments.length})</span>
        </div>

        <ScrollArea className="max-h-52 mb-3">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
          ) : (
            <div className="space-y-3 pr-2">
              {comments.map(c => {
                const isRejection = c.comment.startsWith('[Rejection reason]');
                return (
                  <div key={c.id} className={`text-sm ${isRejection ? 'bg-red-50 border border-red-100 rounded-lg p-2.5' : ''}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-semibold text-xs text-foreground">{c.author?.full_name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.author?.label}</Badge>
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-foreground/80 text-xs leading-relaxed">
                      {isRejection ? c.comment.replace('[Rejection reason] ', '') : c.comment}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2">
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="resize-none text-sm"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendComment();
            }}
          />
          <Button
            size="icon"
            className="self-end h-9 w-9 shrink-0"
            onClick={sendComment}
            disabled={!comment.trim() || submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={15} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
