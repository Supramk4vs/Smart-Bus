import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, NavOption } from './components/Sidebar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { StudentPortal } from './pages/student/StudentPortal.tsx';
import { DriverPortal } from './pages/driver/DriverPortal.tsx';
import { AdminPortal } from './pages/admin/AdminPortal.tsx';
import { Bus, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Application ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-100 text-rose-700 mb-4 shadow-sm">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900">
            Campus Transport Portal Notice
          </h2>
          <p className="mt-1 max-w-md text-xs text-slate-600">
            A temporary display or network error occurred. Please reload to resume your live transport session.
          </p>
          {this.state.error?.message && (
            <p className="mt-2 p-2 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700 max-w-sm truncate">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 inline-flex items-center space-x-2 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white px-5 py-2.5 text-xs font-bold shadow-md transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reload Portal</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const MainLayout: React.FC = () => {
  const { user, role, logout, isLoading } = useAuth();
  const [activeNav, setActiveNav] = useState<NavOption>('WELCOME');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // When user logs in or switches, always start at WELCOME screen
  useEffect(() => {
    if (user) {
      setActiveNav('WELCOME');
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-700 text-white shadow-xl shadow-purple-600/30 animate-pulse mb-4">
          <Bus className="h-8 w-8" />
        </div>
        <h2 className="text-sm font-bold text-slate-800 tracking-wide">
          SMART CAMPUS TRANSPORT INTELLIGENCE
        </h2>
        <div className="flex items-center space-x-2 text-xs text-purple-700 font-semibold mt-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Verifying pre-registered database session...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Show original login page unmodified
  if (!user || !role) {
    return (
      <>
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        <AuthPage />
      </>
    );
  }

  const isFullScreenGps =
    activeNav === 'LIVE_GPS' ||
    activeNav === 'BUS_GPS' ||
    activeNav === 'FLEET_GPS';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-purple-200 selection:text-purple-900">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* 1. FIXED SIDEBAR NAVIGATION (Permanent, role-based) */}
      <Sidebar
        role={role}
        activeNav={activeNav}
        onSelectNav={(opt) => {
          setActiveNav(opt);
          setIsMobileSidebarOpen(false);
        }}
        onLogout={logout}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. MAIN LAYOUT WRAPPER (Shifted by 64 (16rem) on desktop to accommodate fixed sidebar) */}
      <div className="flex-1 flex flex-col lg:pl-64 min-h-screen">
        {/* Top Navbar */}
        <Navbar
          onToggleSidebarMobile={() => setIsMobileSidebarOpen((prev) => !prev)}
          onSelectNav={(navTab) => setActiveNav(navTab as NavOption)}
        />

        {/* Dynamic Main Content Container */}
        <main className={`flex-1 ${isFullScreenGps ? 'p-0 overflow-hidden' : 'p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8'}`}>
          <ErrorBoundary>
            {role === 'STUDENT' && (
              <StudentPortal
                activeNav={activeNav}
                onNavigate={(nav) => setActiveNav(nav as NavOption)}
              />
            )}
            {role === 'DRIVER' && (
              <DriverPortal
                activeNav={activeNav}
                onNavigate={(nav) => setActiveNav(nav as NavOption)}
              />
            )}
            {role === 'ADMIN' && (
              <AdminPortal
                activeNav={activeNav}
                onNavigate={(nav) => setActiveNav(nav as NavOption)}
              />
            )}
          </ErrorBoundary>
        </main>

        {/* 3. MOBILE BOTTOM NAVIGATION BAR (Fixed at bottom for quick thumb reach) */}
        <BottomNav
          role={role}
          activeNav={activeNav}
          onSelectNav={(opt) => {
            setActiveNav(opt);
            setIsMobileSidebarOpen(false);
          }}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ErrorBoundary>
  );
}
