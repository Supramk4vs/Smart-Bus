import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AdminDashboard } from '../AdminDashboard.tsx';
import { WelcomeScreen } from '../../components/WelcomeScreen.tsx';

interface AdminPortalProps {
  activeNav: string;
  onNavigate: (nav: string) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ activeNav, onNavigate }) => {
  const { user } = useAuth();
  const adminName = (user as any)?.name || (user as any)?.admin_id || 'Administrator';

  if (activeNav === 'WELCOME') {
    return (
      <WelcomeScreen
        role="ADMIN"
        userName={adminName}
        onNavigate={onNavigate}
      />
    );
  }

  return <AdminDashboard activeNav={activeNav} onNavigate={onNavigate} />;
};
