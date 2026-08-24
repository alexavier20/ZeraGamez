import { Outlet } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { Header } from '@/shared/components/header/Header';
import { MobileBottomNav } from '@/shared/components/header/MobileBottomNav';

import type { HeaderAccount } from '@/shared/components/header/header.types';

export function AppLayout() {
  const { state } = useAuth();
  const account: HeaderAccount =
    state.status === 'authenticated'
      ? { status: 'authenticated', user: { name: state.user.name, initials: state.user.initials } }
      : { status: 'anonymous' };

  return (
    <div className="min-h-dvh bg-app text-text-primary">
      <Header account={account} />
      <Outlet />
      <MobileBottomNav />
    </div>
  );
}
