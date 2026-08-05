import { Outlet } from 'react-router';

import { Header } from '@/shared/components/header/Header';
import { MobileBottomNav } from '@/shared/components/header/MobileBottomNav';

import type { HeaderUser } from '@/shared/components/header/header.types';

const appUser = {
  name: 'Alex',
  initials: 'AB',
} as const satisfies HeaderUser;

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-app text-text-primary">
      <Header user={appUser} />
      <Outlet />
      <MobileBottomNav />
    </div>
  );
}
