import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  FileText,
  Users,
  LogOut,
  Menu,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';
import NotificationBell from '../../modules/notifications/NotificationBell';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Separator } from '../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

function getNavItems(role: string): NavItem[] {
  if (role === 'admin') {
    return [
      { to: '/admin/users', icon: Users, label: 'Users' },
      { to: '/admin/projects', icon: Briefcase, label: 'Projects Overview' },
    ];
  }
  if (role === 'finance_officer') {
    return [
      { to: '/finance/projects', icon: Briefcase, label: 'Projects' },
      { to: '/finance/claims', icon: FileText, label: 'Claims' },
    ];
  }
  if (role === 'director_pm') {
    return [
      { to: '/director/projects', icon: Briefcase, label: 'My Projects' },
    ];
  }
  return [];
}

function NavItems({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )
          }
        >
          <item.icon size={17} />
          <span>{item.label}</span>
          <ChevronRight size={14} className="ml-auto opacity-40" />
        </NavLink>
      ))}
    </nav>
  );
}

function Sidebar({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col h-full bg-primary text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="min-w-0">
          <div className="font-bold text-base tracking-wide leading-none">FND</div>
          <div className="text-[8px] text-blue-200 tracking-widest uppercase mt-0.5 truncate">
            Fahim, Nanji & D'souza Pvt Ltd
          </div>
        </div>
      </div>

      <NavItems items={items} onNavigate={onNavigate} />

      <Separator className="bg-white/10 mx-3" />

      {/* User footer */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/10 transition-colors text-left">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{profile?.full_name}</div>
                <div className="text-[11px] text-blue-200 truncate">{profile?.label}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52">
            <div className="px-3 py-2">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut size={14} className="mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = profile?.role ?? '';
  const items = getNavItems(role);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 shrink-0">
        <Sidebar items={items} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b bg-card flex items-center px-4 gap-3 shrink-0">
          {/* Mobile menu trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
                <Menu size={18} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar items={items} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 lg:hidden">
            <img
              src="/assets/images/Gemini_Generated_Image_dx05judx05judx05.png"
              alt="FND"
              className="h-7 w-7 object-contain"
            />
            <span className="font-bold text-primary">FND</span>
          </div>

          <div className="flex-1" />

          <NotificationBell />

          {/* Desktop user badge */}
          <div className="hidden lg:flex items-center gap-2 border-l pl-3 ml-1">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {profile?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div className="hidden xl:block">
              <p className="text-xs font-medium leading-none">{profile?.full_name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{profile?.label}</p>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
