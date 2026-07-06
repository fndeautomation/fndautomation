import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import type { Project, Milestone } from '../../../types/database';
import StatusBadge from '../../../components/shared/StatusBadge';
import MilestoneProgressBar from '../../projects/components/MilestoneProgressBar';
import EmptyState from '../../../components/shared/EmptyState';
import { formatDistanceToNow } from 'date-fns';

function formatPKR(v: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(v);
}

interface ProjectRow extends Project {
  milestones?: Milestone[];
}

export default function MyProjectsView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('*, milestones(*)')
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false });
    setProjects((data as ProjectRow[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-3">
        {[1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">My Projects</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {projects.length} project{projects.length !== 1 ? 's' : ''} assigned to you
        </p>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects assigned yet"
          description="Your Finance Officer will notify you when a project is ready."
        />
      ) : (
        <div className="space-y-3">
          {projects.map(p => {
            const ms = p.milestones ?? [];
            const paidCount = ms.filter(m => m.status === 'paid').length;
            const approvedCount = ms.filter(m => ['approved', 'paid'].includes(m.status)).length;

            return (
              <div
                key={p.id}
                className="bg-card border rounded-xl p-5 cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all group"
                onClick={() => navigate(`/director/projects/${p.id}`)}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-primary font-bold">{p.short_id}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <h3 className="font-semibold text-base truncate">{p.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5 font-mono">{formatPKR(p.total_value)}</p>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>

                {ms.length > 0 && (
                  <div>
                    <MilestoneProgressBar milestones={ms} />
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{approvedCount}/{ms.length} milestones approved</span>
                      <span>{paidCount} paid</span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-3">
                  Assigned {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
