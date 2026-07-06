import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Loader2, UserPlus, HardHat, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import type { Project, Milestone, ProjectEngineer, Claim, Profile } from '../../types/database';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import StatusBadge from '../../components/shared/StatusBadge';
import MilestoneProgressBar from './components/MilestoneProgressBar';
import RaiseClaimDialog from './components/RaiseClaimDialog';
import ProjectInbox from '../inbox/ProjectInbox';
import ClaimReviewPanel from '../finance/components/ClaimReviewPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { useToast } from '../../hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';

function formatPKR(v: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(v);
}

const ENGINEER_ROLE_TAGS = [
  'Site Engineer',
  'MEP Engineer',
  'MEP Lead',
  'Electrical Engineer',
  'Mechanical Engineer',
  'Civil Engineer',
  'Project Supervisor',
  'Site Foreman',
];

interface ClaimWithDetails extends Claim {
  milestone?: Milestone;
  engineer?: Pick<ProjectEngineer, 'engineer_name' | 'engineer_role_tag'>;
  raised_by_profile?: Pick<Profile, 'full_name' | 'label'>;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [project, setProject] = useState<Project & { assigned_to_profile?: Pick<Profile, 'full_name' | 'label'> } | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [engineers, setEngineers] = useState<ProjectEngineer[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const [addEngineerOpen, setAddEngineerOpen] = useState(false);
  const [engineerName, setEngineerName] = useState('');
  const [engineerRole, setEngineerRole] = useState('');
  const [addingEngineer, setAddingEngineer] = useState(false);

  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const isDirector = profile?.role === 'director_pm';
  const isFinance = profile?.role === 'finance_officer';
  const backPath = isDirector ? '/director/projects' : '/finance/projects';

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [{ data: proj }, { data: ms }, { data: engs }, { data: cls }] = await Promise.all([
      supabase.from('projects').select('*, assigned_to_profile:assigned_to(full_name, label)').eq('id', id).maybeSingle(),
      supabase.from('milestones').select('*').eq('project_id', id).order('order_index'),
      supabase.from('project_engineers').select('*').eq('project_id', id).order('created_at'),
      supabase.from('claims').select('*, milestone:milestone_id(*), engineer:project_engineer_id(engineer_name, engineer_role_tag), raised_by_profile:raised_by(full_name, label)').eq('project_id', id).order('created_at', { ascending: false }),
    ]);

    setProject(proj as typeof project);
    setMilestones((ms as Milestone[]) ?? []);
    setEngineers((engs as ProjectEngineer[]) ?? []);
    setClaims((cls as ClaimWithDetails[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addEngineer = async () => {
    if (!engineerName.trim() || !engineerRole || !id || !profile) return;
    setAddingEngineer(true);
    const { error } = await supabase.from('project_engineers').insert({
      project_id: id,
      engineer_name: engineerName.trim(),
      engineer_role_tag: engineerRole,
      added_by: profile.id,
    });
    setAddingEngineer(false);
    if (!error) {
      setEngineerName('');
      setEngineerRole('');
      setAddEngineerOpen(false);
      load();
      toast({ title: 'Engineer added' });
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const paidMs = milestones.filter(m => m.status === 'paid').length;
  const approvedMs = milestones.filter(m => ['approved', 'paid'].includes(m.status)).length;
  const pendingClaims = claims.filter(c => c.status === 'pending_review').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Project not found or you don't have access.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back + Header */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground"
        onClick={() => navigate(backPath)}
      >
        <ArrowLeft size={14} className="mr-1.5" /> Back to projects
      </Button>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-primary font-bold">{project.short_id}</span>
            <StatusBadge status={project.status} />
          </div>
          <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="font-mono">{formatPKR(project.total_value)}</span>
            {project.assigned_to_profile && (
              <>
                <span>·</span>
                <span>{project.assigned_to_profile.full_name} ({project.assigned_to_profile.label})</span>
              </>
            )}
            <span>·</span>
            <span>{format(new Date(project.created_at), 'dd MMM yyyy')}</span>
          </div>
        </div>
        {isDirector && (
          <Dialog open={addEngineerOpen} onOpenChange={setAddEngineerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus size={14} className="mr-1.5" /> Add Engineer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Engineer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Engineer name</Label>
                  <Input
                    placeholder="e.g. Hamza Iqbal"
                    value={engineerName}
                    onChange={e => setEngineerName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Discipline / Role</Label>
                  <Select value={engineerRole} onValueChange={setEngineerRole}>
                    <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
                    <SelectContent>
                      {ENGINEER_ROLE_TAGS.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddEngineerOpen(false)}>Cancel</Button>
                  <Button onClick={addEngineer} disabled={!engineerName.trim() || !engineerRole || addingEngineer}>
                    {addingEngineer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Engineer
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Milestones</p>
          <p className="font-semibold text-lg">{milestones.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Paid</p>
          <p className="font-semibold text-lg text-primary">{paidMs}/{milestones.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Engineers</p>
          <p className="font-semibold text-lg">{engineers.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Pending Claims</p>
          <p className={cn('font-semibold text-lg', pendingClaims > 0 ? 'text-amber-600' : '')}>{pendingClaims}</p>
        </div>
      </div>

      {/* Milestone progress bar */}
      {milestones.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progress</span>
            <span className="text-xs text-muted-foreground">{approvedMs}/{milestones.length} milestones approved</span>
          </div>
          <MilestoneProgressBar milestones={milestones} />
          <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-border inline-block" /> Pending</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400 inline-block" /> Claim Submitted</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500 inline-block" /> Approved</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary inline-block" /> Paid</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="milestones">
        <TabsList className="mb-4">
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="engineers">
            Engineers
            {engineers.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{engineers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="claims">
            Claims
            {pendingClaims > 0 && (
              <Badge className="ml-1.5 h-4 px-1 text-[10px] bg-amber-500">{pendingClaims}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
        </TabsList>

        {/* MILESTONES */}
        <TabsContent value="milestones">
          {milestones.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">No milestones defined.</div>
          ) : (
            <div className="space-y-2">
              {milestones.map(m => {
                const mileClaims = claims.filter(c => c.milestone_id === m.id);
                const latestClaim = mileClaims[0];
                return (
                  <div key={m.id} className="border rounded-lg p-4 bg-card hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{m.title}</span>
                          <StatusBadge status={m.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{m.percentage}%</span>
                          <span>·</span>
                          <span className="font-mono">{formatPKR(m.value)}</span>
                          {latestClaim && (
                            <>
                              <span>·</span>
                              <span>
                                Last claim: {formatDistanceToNow(new Date(latestClaim.created_at), { addSuffix: true })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {isDirector && (
                        <RaiseClaimDialog
                          project={project}
                          milestone={m}
                          engineers={engineers}
                          onRaised={load}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ENGINEERS */}
        <TabsContent value="engineers">
          {engineers.length === 0 ? (
            <div className="text-center py-8">
              <HardHat className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No engineers assigned yet.</p>
              {isDirector && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddEngineerOpen(true)}>
                  <UserPlus size={13} className="mr-1.5" /> Add Engineer
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {engineers.map(e => (
                <div key={e.id} className="border rounded-lg p-3 bg-card flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <HardHat size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{e.engineer_name}</p>
                    <p className="text-xs text-muted-foreground">{e.engineer_role_tag}</p>
                  </div>
                </div>
              ))}
              {isDirector && (
                <button
                  onClick={() => setAddEngineerOpen(true)}
                  className="border-2 border-dashed border-border rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors text-sm"
                >
                  <Plus size={14} /> Add engineer
                </button>
              )}
            </div>
          )}
        </TabsContent>

        {/* CLAIMS */}
        <TabsContent value="claims">
          {claims.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No claims submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {claims.map(c => (
                <div
                  key={c.id}
                  className="border rounded-lg p-4 bg-card hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => isFinance ? setSelectedClaimId(c.id) : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{(c.milestone as Milestone)?.title}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">{formatPKR(c.amount)}</span>
                        <span>·</span>
                        <span>{(c.engineer as ProjectEngineer)?.engineer_name}</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    {isFinance && c.status === 'pending_review' && (
                      <Button size="sm" variant="outline" onClick={() => setSelectedClaimId(c.id)}>
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* INBOX */}
        <TabsContent value="inbox">
          <ProjectInbox projectId={project.id} />
        </TabsContent>
      </Tabs>

      {/* Claim review sheet (Finance only) */}
      <Sheet open={!!selectedClaimId} onOpenChange={v => !v && setSelectedClaimId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review Claim</SheetTitle>
          </SheetHeader>
          {selectedClaimId && (
            <div className="mt-4">
              <ClaimReviewPanel
                claimId={selectedClaimId}
                onUpdated={() => { load(); setSelectedClaimId(null); }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
