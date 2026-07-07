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

  // Calculate incremental widths
  const segments = sorted.map((m, i) => {
    const prevPct = i === 0 ? 0 : sorted[i - 1].percentage;
    const width = m.percentage - prevPct;
    return {
      id: m.id,
      title: m.title,
      percentage: m.percentage,
      width: Math.max(0, width),
      status: m.status,
    };
  });

  const lastPct = sorted.length > 0 ? sorted[sorted.length - 1].percentage : 0;
  const remainingWidth = 100 - lastPct;

  return (
    <TooltipProvider>
      <div className="flex w-full h-3 rounded-full overflow-hidden gap-0.5 bg-muted">
        {segments.map(s => (
          <Tooltip key={s.id}>
            <TooltipTrigger asChild>
              <div
                className={cn('h-full transition-colors cursor-pointer', STATUS_COLORS[s.status] ?? 'bg-border')}
                style={{ width: `${s.width}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium text-xs">{s.title}</p>
              <p className="text-xs text-muted-foreground">
                Target: {s.percentage}% (Share: {s.width.toFixed(1)}%) · {s.status.replace('_', ' ')}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingWidth > 0 && (
          <div
            className="h-full bg-border opacity-40"
            style={{ width: `${remainingWidth}%` }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
