import { useState } from 'react';
import { Loader2, DollarSign } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import type { Milestone, ProjectEngineer, Project } from '../../../types/database';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';

import { useToast } from '../../../hooks/use-toast';

function formatPKR(v: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(v);
}

interface Props {
  project: Project;
  milestone: Milestone;
  engineers?: ProjectEngineer[];
  onRaised: () => void;
}

export default function RaiseClaimDialog({ project, milestone, onRaised }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const canRaise = milestone.status === 'pending' || milestone.status === 'claim_submitted';

  const onSubmit = async () => {
    if (!user) return;
    setLoading(true);

    const { error: claimError } = await supabase.from('claims').insert({
      project_id: project.id,
      milestone_id: milestone.id,
      project_engineer_id: null,
      raised_by: user.id,
      status: 'pending_review',
      amount: milestone.value,
    });

    if (claimError) {
      toast({ title: 'Error', description: claimError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Update milestone status
    await supabase.from('milestones').update({ status: 'claim_submitted' }).eq('id', milestone.id);

    // Notify all Finance Officers
    const { data: fos } = await supabase.from('profiles').select('id').eq('role', 'finance_officer');
    if (fos?.length) {
      await supabase.from('notifications').insert(
        fos.map(fo => ({
          recipient_id: fo.id,
          type: 'claim_raised' as const,
          reference_id: project.id,
        }))
      );
    }

    toast({ title: 'Claim submitted!', description: `${milestone.title} — ${formatPKR(milestone.value)}` });
    setOpen(false);
    onRaised();
    setLoading(false);
  };

  if (!canRaise) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
          <DollarSign size={13} className="mr-1" /> Raise Claim
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Raise Payment Claim</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Milestone</p>
            <p className="font-semibold">{milestone.title}</p>
            <p className="text-sm text-muted-foreground">{milestone.percentage}% · <span className="font-mono">{formatPKR(milestone.value)}</span></p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Claim
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
