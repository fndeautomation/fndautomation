import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type {
  ProjectStatus,
  MilestoneStatus,
  ClaimStatus,
  UserStatus,
} from '../../types/database';

type AnyStatus = ProjectStatus | MilestoneStatus | ClaimStatus | UserStatus;

const CONFIG: Record<AnyStatus, { label: string; className: string }> = {
  // Project statuses
  unassigned: { label: 'Unassigned', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  active: { label: 'Active', className: 'bg-green-50 text-green-700 border-green-200' },
  on_hold: { label: 'On Hold', className: 'bg-red-50 text-red-700 border-red-200' },
  completed: { label: 'Completed', className: 'bg-blue-50 text-blue-700 border-blue-200' },

  // Milestone statuses
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  claim_submitted: { label: 'Claim Submitted', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved: { label: 'Approved', className: 'bg-green-50 text-green-700 border-green-200' },
  paid: { label: 'Paid', className: 'bg-primary/10 text-primary border-primary/20' },

  // Claim statuses
  pending_review: { label: 'Pending Review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },

  // User statuses (active already defined above, pending too)
};

interface Props {
  status: AnyStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  const config = CONFIG[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium px-2 py-0.5', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
