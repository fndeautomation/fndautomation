import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Briefcase, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Profile, Project } from '../../types/database';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import StatusBadge from '../../components/shared/StatusBadge';
import EmptyState from '../../components/shared/EmptyState';
import CreateUserDialog from './components/CreateUserDialog';
import { formatDistanceToNow } from 'date-fns';

function formatPKR(v: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(v);
}

interface ProjectRow extends Project {
  created_by_profile?: Pick<Profile, 'full_name' | 'label'> | null;
  assigned_to_profile?: Pick<Profile, 'full_name' | 'label'> | null;
}

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = location.pathname.includes('/projects') ? 'projects' : 'users';

  const [users, setUsers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });
    setUsers(data ?? []);
    setLoadingUsers(false);
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    const { data } = await supabase
      .from('projects')
      .select('*, created_by_profile:created_by(full_name, label), assigned_to_profile:assigned_to(full_name, label)')
      .order('created_at', { ascending: false });
    setProjects((data as ProjectRow[]) ?? []);
    setLoadingProjects(false);
  }, []);

  useEffect(() => { fetchUsers(); fetchProjects(); }, [fetchUsers, fetchProjects]);

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.short_id.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage users and monitor projects</p>
      </div>

      <Tabs value={tab} onValueChange={v => navigate(v === 'users' ? '/admin/users' : '/admin/projects')}>
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="gap-2">
            <Users size={14} /> Users
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-2">
            <Briefcase size={14} /> Projects Overview
          </TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={fetchUsers} disabled={loadingUsers}>
                <RefreshCw size={15} className={loadingUsers ? 'animate-spin' : ''} />
              </Button>
              <CreateUserDialog onCreated={fetchUsers} />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Invite Finance Officers and Directors/PMs to get started."
            />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{u.full_name}</div>
                        <div className="text-xs text-muted-foreground md:hidden">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-xs w-fit">
                            {u.role === 'finance_officer' ? 'Finance' : 'Director/PM'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{u.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* PROJECTS TAB */}
        <TabsContent value="projects">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or ID…"
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={fetchProjects} disabled={loadingProjects}>
              <RefreshCw size={15} className={loadingProjects ? 'animate-spin' : ''} />
            </Button>
          </div>

          {filteredProjects.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No projects yet"
              description="Projects created by Finance Officers will appear here."
            />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Project</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Value (PKR)</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Assigned To</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-primary font-semibold">{p.short_id}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell font-mono text-xs">
                        {formatPKR(p.total_value)}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {p.assigned_to_profile ? (
                          <div>
                            <div className="font-medium text-foreground">{p.assigned_to_profile.full_name}</div>
                            <div className="text-xs text-muted-foreground">{p.assigned_to_profile.label}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
