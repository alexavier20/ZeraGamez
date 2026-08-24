import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import {
  createSupabaseAuthService,
  type AuthService,
} from '@/features/auth/api/auth-service';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { ReleasesPage } from '@/pages/ReleasesPage';
import { headerRoutes } from '@/shared/components/header/header.config';
import { getSupabaseClient } from '@/shared/supabase/client';

interface AppRouterProps {
  readonly authService?: AuthService | null;
}

function getDefaultAuthService(): AuthService | null {
  const client = getSupabaseClient();
  return client === null ? null : createSupabaseAuthService(client);
}

export function AppRouter({ authService }: AppRouterProps) {
  const service = authService === undefined ? getDefaultAuthService() : authService;

  return (
    <AuthProvider service={service}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path={headerRoutes.releases} element={<ReleasesPage />} />
            <Route path="/entrar" element={<LoginPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
