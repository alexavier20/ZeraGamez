import { Outlet, useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { clearPendingAuthIntent } from '@/features/auth/model/pending-auth-intent';
import { Header } from '@/shared/components/header/Header';
import { MobileBottomNav } from '@/shared/components/header/MobileBottomNav';
import { headerRoutes } from '@/shared/components/header/header.config';

import type { HeaderAccount } from '@/shared/components/header/header.types';

export function AppLayout() {
  const { beginLogoutNavigation, signOut, state } = useAuth();
  const navigate = useNavigate();
  const account: HeaderAccount =
    state.status === 'authenticated'
      ? {
          status: 'authenticated',
          user: {
            name: state.user.name,
            initials: state.user.initials,
            avatarUrl: state.user.avatarUrl,
          },
        }
      : { status: 'anonymous' };

  const handleSignOut = async () => {
    clearPendingAuthIntent(sessionStorage);
    const finishLogoutNavigation = beginLogoutNavigation();
    try {
      await signOut();
      clearPendingAuthIntent(sessionStorage);
      await navigate(headerRoutes.home, { replace: true });
    } finally {
      finishLogoutNavigation();
    }
  };

  return (
    <div className="min-h-dvh bg-app text-text-primary">
      <Header account={account} onSignOut={handleSignOut} />
      <Outlet />
      <MobileBottomNav />
    </div>
  );
}
