import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, DollarSign, FileText, File, Download, Trash2, Paperclip, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import type { Project, Milestone, Claim, Profile, ProjectDocumentWithProfile } from '../../types/database';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
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

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return <FileText className="text-red-500" size={20} />;
    case 'doc':
    case 'docx':
      return <FileText className="text-blue-500" size={20} />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <FileText className="text-green-500" size={20} />;
    case 'zip':
    case 'rar':
      return <File className="text-amber-500" size={20} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
      return <File className="text-purple-500" size={20} />;
    default:
      return <File className="text-slate-500" size={20} />;
  }
}

interface ClaimWithDetails extends Claim {
  milestone?: Milestone;
  raised_by_profile?: Pick<Profile, 'full_name' | 'label'>;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'milestones';
  const setActiveTab = (val: string) => {
    setSearchParams({ tab: val });
  };

  const [project, setProject] = useState<Project & { assigned_to_profile?: Pick<Profile, 'full_name' | 'label'> } | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ProjectDocumentWithProfile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isDirector = profile?.role === 'director_pm';
  const isFinance = profile?.role === 'finance_officer';
  const isAdmin = profile?.role === 'admin';
  const backPath = isAdmin ? '/admin/projects' : isDirector ? '/director/projects' : '/finance/projects';

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [{ data: proj }, { data: ms }, { data: cls }, { data: docs }] = await Promise.all([
      supabase.from('projects').select('*, assigned_to_profile:assigned_to(full_name, label)').eq('id', id).maybeSingle(),
      supabase.from('milestones').select('*').eq('project_id', id).order('order_index'),
      supabase.from('claims').select('*, milestone:milestone_id(*), raised_by_profile:raised_by(full_name, label)').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('project_documents').select('*, uploaded_by_profile:uploaded_by(full_name, label)').eq('project_id', id).order('created_at', { ascending: false }),
    ]);

    setProject(proj as typeof project);
    setMilestones((ms as Milestone[]) ?? []);
    setClaims((cls as ClaimWithDetails[]) ?? []);
    setDocuments((docs as ProjectDocumentWithProfile[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !profile) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const uniqueId = Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      const storageFilePath = `${id}/${uniqueId}.${fileExt}`;

      // 1. Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(storageFilePath, file);

      if (uploadError) throw uploadError;

      // 2. Insert metadata into public.project_documents table
      const { error: dbError } = await supabase.from('project_documents').insert({
        project_id: id,
        name: file.name,
        file_path: storageFilePath,
        size: file.size,
        mime_type: file.type || null,
        uploaded_by: profile.id,
      });

      if (dbError) throw dbError;

      toast({ title: 'Success', description: 'Document uploaded successfully.' });
      load();
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Upload failed',
        description: error.message || 'An error occurred during file upload.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Reset the file input value
      e.target.value = '';
    }
  };

  const handleDownload = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(filePath, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Download failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDocument = async (docId: string, filePath: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    setDeletingId(docId);
    try {
      // 1. Delete from Storage
      const { error: storageError } = await supabase.storage
        .from('project-documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // 2. Delete from database table
      const { error: dbError } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', docId);

      if (dbError) throw dbError;

      toast({ title: 'Success', description: 'Document deleted successfully.' });
      load();
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
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

      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Milestones</p>
          <p className="font-semibold text-lg">{milestones.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Paid</p>
          <p className="font-semibold text-lg text-primary">{paidMs}/{milestones.length}</p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
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
                      {(isDirector || isAdmin) && (
                        <RaiseClaimDialog
                          project={project}
                          milestone={m}
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
                  onClick={() => (isFinance || isAdmin) ? setSelectedClaimId(c.id) : undefined}
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
                        <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    {(isFinance || isAdmin) && c.status === 'pending_review' && (
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

      {/* Documents Section */}
      <div className="mt-8 pt-8 border-t">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Paperclip size={18} className="text-primary" />
              Project Documents
            </h2>
            <p className="text-xs text-muted-foreground">
              Official documents and references uploaded for this project.
            </p>
          </div>
          {(isFinance || isAdmin) && (
            <div>
              <Label
                htmlFor="file-upload"
                className={cn(
                  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 cursor-pointer gap-1.5",
                  uploading && "opacity-50 pointer-events-none"
                )}
              >
                {uploading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <UploadCloud size={15} />
                )}
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Label>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
            <Paperclip size={32} className="text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium">No documents uploaded yet.</p>
            {(isFinance || isAdmin) && (
              <p className="text-xs mt-1">Upload files such as project plans, invoices, or specifications.</p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group border rounded-lg p-3 bg-card hover:bg-muted/30 transition-all duration-200 flex items-center justify-between gap-3 shadow-sm hover:shadow-md"
              >
                <div
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  onClick={() => handleDownload(doc.file_path)}
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                    {getFileIcon(doc.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors duration-200">
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{formatBytes(doc.size)}</span>
                      <span>·</span>
                      <span className="truncate">
                        by {doc.uploaded_by_profile?.full_name || 'System'}
                      </span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleDownload(doc.file_path)}
                  >
                    <Download size={14} />
                  </Button>
                  {(isFinance || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === doc.id}
                      onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
                    >
                      {deletingId === doc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
