import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Bot,
  Database,
  Dna,
  FileText,
  FolderKanban,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/LandingPage';
import { AuthViews } from './components/AuthViews';
import { UserDashboard } from './components/UserDashboard';
import { DatasetManager } from './components/DatasetManager';
import { TaxonomicModule } from './components/TaxonomicModule';
import { BiodiversityModule } from './components/BiodiversityModule';
import { GeographicMapModule } from './components/GeographicMapModule';
import { ResearchAssistantModule } from './components/ResearchAssistantModule';
import { ReportGeneratorModule } from './components/ReportGeneratorModule';
import {
  NotificationsCenter,
  ProfileAndSettingsView,
} from './components/ProfileSettingsNotifications';
import { AdminControlPanel } from './components/AdminControlPanel';
import { apiFetch } from './lib/api';
import type { AppSection, NotificationItem } from './types/edna';

function AppShell() {
  const { firebaseUser, dbUser, loading, logout } = useAuth();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeSection, setActiveSection] = useState<AppSection>('dashboard');
  const [focusDatasetId, setFocusDatasetId] = useState<string | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigatePath = (nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
      setPathname(nextPath);
    }
  };

  useEffect(() => {
    if (!dbUser) return;
    apiFetch<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((res) => {
        setUnreadCount(res.notifications.filter((n) => n.status === 'unread').length);
      })
      .catch(() => {});
  }, [dbUser]);

  // Hidden administrator control route — never linked in public or regular user UI
  if (pathname === '/secure-control-panel') {
    return <AdminControlPanel />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6FAF7] flex items-center justify-center">
        <div className="text-sm font-medium text-[#174D35]">Initializing eDNA workspace...</div>
      </div>
    );
  }

  // Unauthenticated routes
  if (!firebaseUser || !dbUser) {
    if (pathname === '/login' || pathname === '/register') {
      return (
        <AuthViews
          initialMode={pathname === '/register' ? 'register' : authMode}
          onBackHome={() => navigatePath('/')}
          onSuccess={() => {
            navigatePath('/dashboard');
            setActiveSection('dashboard');
          }}
        />
      );
    }

    return (
      <LandingPage
        onNavigateLogin={() => {
          setAuthMode('login');
          navigatePath('/login');
        }}
        onNavigateRegister={() => {
          setAuthMode('register');
          navigatePath('/register');
        }}
      />
    );
  }

  const navItems: Array<{ id: AppSection; label: string; icon: React.ComponentType<any>; badge?: number }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'My Projects', icon: FolderKanban },
    { id: 'upload', label: 'Dataset Upload', icon: UploadCloud },
    { id: 'datasets', label: 'Dataset Management', icon: Database },
    { id: 'taxonomy', label: 'Taxonomic Identification', icon: Dna },
    { id: 'biodiversity', label: 'Biodiversity Assessment', icon: BarChart3 },
    { id: 'geography', label: 'Geographic Visualization', icon: Globe2 },
    { id: 'assistant', label: 'AI Research Assistant', icon: Bot },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSelectSection = (sec: AppSection) => {
    setActiveSection(sec);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F6FAF7] flex flex-col lg:flex-row">
      {/* Mobile Top Header */}
      <header className="no-print lg:hidden bg-[#174D35] text-white px-4 h-14 flex items-center justify-between sticky top-0 z-30">
        <span className="font-display font-bold text-sm truncate">eDNA Biodiversity Portal</span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          className="p-2 text-white cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Researcher Sidebar */}
      <aside
        className={`no-print ${
          mobileMenuOpen ? 'fixed inset-0 z-40 flex' : 'hidden'
        } lg:flex lg:w-64 lg:sticky lg:top-0 lg:h-screen bg-[#14251D] text-white flex-col shrink-0`}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold font-display text-white">eDNA Biodiversity</div>
            <div className="text-xs text-white/60 truncate max-w-[180px]">{dbUser.fullName}</div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 text-white/75"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto text-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSection(item.id)}
                className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#269B68] text-white font-semibold'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded bg-[#18A999] text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigatePath('/');
            }}
            className="w-full px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 flex items-center gap-2.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Workspace Content Viewport */}
      <main className="flex-1 min-w-0 p-5 sm:p-7 lg:p-8 max-w-[1440px] w-full mx-auto">
        {activeSection === 'dashboard' && <UserDashboard onNavigate={handleSelectSection} />}
        {activeSection === 'projects' && <DatasetManager mode="projects" />}
        {activeSection === 'upload' && (
          <DatasetManager
            mode="upload"
            onDatasetUploaded={(ds) => {
              setFocusDatasetId(ds.id);
            }}
          />
        )}
        {activeSection === 'datasets' && (
          <DatasetManager
            mode="datasets"
            onSelectForTaxonomy={(dsId) => {
              setFocusDatasetId(dsId);
              setActiveSection('taxonomy');
            }}
          />
        )}
        {activeSection === 'taxonomy' && (
          <TaxonomicModule
            initialDatasetId={focusDatasetId}
            onGoToBiodiversity={(dsId) => {
              setFocusDatasetId(dsId);
              setActiveSection('biodiversity');
            }}
          />
        )}
        {activeSection === 'biodiversity' && (
          <BiodiversityModule initialDatasetId={focusDatasetId} />
        )}
        {activeSection === 'geography' && <GeographicMapModule />}
        {activeSection === 'assistant' && <ResearchAssistantModule />}
        {activeSection === 'reports' && <ReportGeneratorModule />}
        {activeSection === 'notifications' && (
          <NotificationsCenter onUnreadChanged={setUnreadCount} />
        )}
        {activeSection === 'profile' && <ProfileAndSettingsView mode="profile" />}
        {activeSection === 'settings' && <ProfileAndSettingsView mode="settings" />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
