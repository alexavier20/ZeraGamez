import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import { createSupabaseAuthService, type AuthService } from '@/features/auth/api/auth-service';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import {
  createSupabaseListsRepository,
  type ListsRepository,
} from '@/features/lists/api/lists-repository';
import { ListsProvider } from '@/features/lists/context/ListsProvider';
import { CreateListPage } from '@/pages/CreateListPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { MyListsPage } from '@/pages/MyListsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ReleasesPage } from '@/pages/ReleasesPage';
import { headerRoutes } from '@/shared/components/header/header.config';
import { getSupabaseClient } from '@/shared/supabase/client';

interface AppRouterProps {
  readonly authService?: AuthService | null;
  readonly listsRepository?: ListsRepository | null;
}

interface DefaultDependencies {
  readonly authService: AuthService | null;
  readonly listsRepository: ListsRepository | null;
}

let defaultDependencies: DefaultDependencies | undefined;

function getDefaultDependencies(): DefaultDependencies {
  if (defaultDependencies !== undefined) return defaultDependencies;

  const client = getSupabaseClient();
  defaultDependencies = {
    authService: client === null ? null : createSupabaseAuthService(client),
    listsRepository: client === null ? null : createSupabaseListsRepository(client),
  };
  return defaultDependencies;
}

export function AppRouter({ authService, listsRepository }: AppRouterProps) {
  const defaults =
    authService === undefined || listsRepository === undefined ? getDefaultDependencies() : null;
  const service = authService === undefined ? (defaults?.authService ?? null) : authService;
  const repository =
    listsRepository === undefined ? (defaults?.listsRepository ?? null) : listsRepository;

  return (
    <AuthProvider service={service}>
      <ListsProvider repository={repository}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path={headerRoutes.releases} element={<ReleasesPage />} />
              <Route path="/entrar" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path={headerRoutes.lists} element={<MyListsPage />} />
                <Route path={headerRoutes.createList} element={<CreateListPage />} />
                <Route path={headerRoutes.profile} element={<ProfilePage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ListsProvider>
    </AuthProvider>
  );
}
