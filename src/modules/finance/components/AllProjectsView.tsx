import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronRight, Briefcase } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { Profile, Project, ProjectStatus } from '../../../types/database';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import StatusBadge from '../../../components/shared/StatusBadge';
import EmptyState from '../../../components/shared/EmptyState';
import CreateProjectSheet from './CreateProjectSheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { formatDistanceToNow } from 'date-fns';

function formatPKR(v: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(v);
}

interface ProjectRow extends Project {
  assigned_to_profile?: Pick<Profile, 'full_name' | 'label'> | null;
}

const STATUS_OPTIONS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

export default function AllProjectsView() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('*, assigned_to_profile:assigned_to(full_name, label)')
      .order('created_at', { ascending: false });
    setProjects((data as ProjectRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = projects.filter(p => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.short_id.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">All Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={15} className="mr-2" /> New Project
        </Button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as ProjectStatus | 'all')}>
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
          {[1,2,3].map(i => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects found"
          description={search || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Create your first project to get started.'}
          action={
            !search && statusFilter === 'all' ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus size={14} className="mr-1.5" /> New Project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Project</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Value</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Assigned To</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Created</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.id}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/finance/projects/${p.id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-primary font-semibold">{p.short_id}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                    {formatPKR(p.total_value)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {p.assigned_to_profile ? (
                      <div>
                        <div className="font-medium">{p.assigned_to_profile.full_name}</div>
                        <div className="text-xs text-muted-foreground">{p.assigned_to_profile.label}</div>
                      </div>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={15} className="text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateProjectSheet open={createOpen} onOpenChange={setCreateOpen} onCreated={fetch} />
    </div>
  );
}
