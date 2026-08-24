import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { savePendingAuthIntent } from '@/features/auth/model/pending-auth-intent';

interface ProtectedRouteProps {
  readonly children?: ReactNode;
}

const protectedReturnPaths = [
  '/',
  '/lancamentos',
  '/minhas-listas',
  '/minhas-listas/nova',
  '/perfil',
] as const;

type ProtectedReturnPath = (typeof protectedReturnPaths)[number];

function isProtectedReturnPath(pathname: string): pathname is ProtectedReturnPath {
  return protectedReturnPaths.some((path) => path === pathname);
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { logoutNavigationPending, state } = useAuth();
  const { pathname } = useLocation();
  const [canRedirect, setCanRedirect] = useState(false);

  const needsAuthentication = state.status === 'anonymous' || state.status === 'unavailable';

  useEffect(() => {
    let active = true;
    const canRedirectAfterAuthCheck = needsAuthentication && !logoutNavigationPending;
    if (canRedirectAfterAuthCheck && isProtectedReturnPath(pathname)) {
      savePendingAuthIntent(sessionStorage, {
        version: 1,
        type: 'navigate',
        returnTo: pathname,
      });
    }
    queueMicrotask(() => {
      if (active) setCanRedirect(canRedirectAfterAuthCheck);
    });
    return () => {
      active = false;
    };
  }, [logoutNavigationPending, needsAuthentication, pathname]);

  if (state.status === 'authenticated') return children ?? <Outlet />;

  if (needsAuthentication && canRedirect && !logoutNavigationPending) {
    return <Navigate replace to="/entrar" />;
  }

  return <p role="status">Verificando sua sessão</p>;
}
