import { useEffect, useState, useCallback } from 'react';
import { FileText, Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { Claim, Profile, Project, Milestone, ProjectEngineer, ClaimStatus } from '../../../types/database';
import { Input } from '../../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import StatusBadge from '../../../components/shared/StatusBadge';
import EmptyState from '../../../components/shared/EmptyState';
import ClaimReviewPanel from './ClaimReviewPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../../components/ui/sheet';
import { formatDistanceToNow } from 'date-fns';

function formatPKR(v: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(v);
}

interface ClaimRow extends Claim {
  project?: Pick<Project, 'short_id' | 'name'> | null;
  milestone?: Pick<Milestone, 'title'> | null;
  engineer?: Pick<ProjectEngineer, 'engineer_name' | 'engineer_role_tag'> | null;
  raised_by_profile?: Pick<Profile, 'full_name' | 'label'> | null;
}

const STATUS_OPTIONS: { value: ClaimStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AllClaimsView() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('claims')
      .select(`
        *,
        project:project_id(short_id, name),
        milestone:milestone_id(title),
        engineer:project_engineer_id(engineer_name, engineer_role_tag),
        raised_by_profile:raised_by(full_name, label)
      `)
      .order('created_at', { ascending: false });
    setClaims((data as ClaimRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime: new claim submitted
  useEffect(() => {
    const channel = supabase
      .channel('claims-fo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch]);

  const filtered = claims.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.project?.name?.toLowerCase().includes(q) ||
      c.project?.short_id?.toLowerCase().includes(q) ||
      c.engineer?.engineer_name?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const pendingCount = claims.filter(c => c.status === 'pending_review').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            All Claims
            {pendingCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-semibold">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{claims.length} claim{claims.length !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by project or engineer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as ClaimStatus | 'all')}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No claims found"
          description={search || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Claims from Directors/PMs will appear here.'}
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Project</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Milestone</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Engineer</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedClaimId(c.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-primary font-semibold">{c.project?.short_id}</div>
                    <div className="font-medium text-foreground text-xs mt-0.5">{c.project?.name}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{c.milestone?.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-sm">{c.engineer?.engineer_name}</div>
                    <div className="text-xs text-muted-foreground">{c.engineer?.engineer_role_tag}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                    {formatPKR(c.amount)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!selectedClaimId} onOpenChange={v => !v && setSelectedClaimId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review Claim</SheetTitle>
          </SheetHeader>
          {selectedClaimId && (
            <div className="mt-4">
              <ClaimReviewPanel
                claimId={selectedClaimId}
                onUpdated={() => { fetch(); setSelectedClaimId(null); }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
