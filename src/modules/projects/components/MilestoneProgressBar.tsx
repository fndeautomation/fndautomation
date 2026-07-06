import type { Milestone } from '../../../types/database';
import { cn } from '../../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../../components/ui/tooltip';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-border',
  claim_submitted: 'bg-amber-400',
  approved: 'bg-green-500',
  paid: 'bg-primary',
};

export default function MilestoneProgressBar({ milestones }: { milestones: Milestone[] }) {
  const sorted = [...milestones].sort((a, b) => a.order_index - b.order_index);

  return (
    <TooltipProvider>
      <div className="flex w-full h-3 rounded-full overflow-hidden gap-0.5">
        {sorted.map(m => (
          <Tooltip key={m.id}>
            <TooltipTrigger asChild>
              <div
                className={cn('h-full transition-colors cursor-pointer', STATUS_COLORS[m.status] ?? 'bg-border')}
                style={{ width: `${m.percentage}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium text-xs">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.percentage}% · {m.status.replace('_', ' ')}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
