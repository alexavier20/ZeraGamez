import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { clearPendingAuthIntent } from '@/features/auth/model/pending-auth-intent';
import { headerRoutes } from '@/shared/components/header/header.config';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

const signOutErrorMessage = 'Não foi possível sair. Tente novamente.';

export function ProfilePage() {
  const auth = useAuth();
  const { state } = auth;
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== 'authenticated') {
    return <p role="status">Carregando perfil</p>;
  }

  const { user } = state;

  const handleSignOut = async () => {
    if (pending) return;
    setError(null);
    setPending(true);
    clearPendingAuthIntent(sessionStorage);
    const finishLogoutNavigation = auth.beginLogoutNavigation();
    try {
      await auth.signOut();
      clearPendingAuthIntent(sessionStorage);
      await navigate(headerRoutes.home, { replace: true });
    } catch {
      setError(signOutErrorMessage);
      setPending(false);
    } finally {
      finishLogoutNavigation();
    }
  };

  return (
    <main className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-3xl px-4 pt-7 pb-28 sm:px-5 sm:pb-12 lg:pt-9">
      <PageHeading title="Perfil" subtitle="Gerencie sua conta no Zera GameZ" />

      <section
        aria-label="Conta"
        className="mt-8 rounded-2xl border border-white/10 bg-surface p-6 sm:p-8"
      >
        <div className="flex items-center gap-4">
          {user.avatarUrl === null ? (
            <span
              aria-label={`Avatar de ${user.name}`}
              className="grid size-16 shrink-0 place-items-center rounded-full bg-brand text-xl font-bold text-white"
            >
              {user.initials}
            </span>
          ) : (
            <img
              alt={`Avatar de ${user.name}`}
              className="size-16 shrink-0 rounded-full object-cover"
              src={user.avatarUrl}
            />
          )}
          <div className="min-w-0">
            <h2 className="truncate font-heading text-xl font-bold text-content-primary">
              {user.name}
            </h2>
            <p className="truncate text-sm text-text-muted">{user.email}</p>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <h3 className="font-heading text-base font-bold text-content-primary">
            Métodos de acesso
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Métodos de acesso disponíveis">
            {['Código por e-mail', 'Google'].map((method) => (
              <li
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-text-muted"
                key={method}
              >
                {method}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          {error === null ? null : (
            <p
              className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300/30 px-5 py-2.5 text-sm font-bold text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            onClick={() => void handleSignOut()}
            type="button"
          >
            <LogOut aria-hidden="true" size={18} />
            {pending ? 'Saindo…' : 'Sair'}
          </button>
          {pending ? (
            <p aria-live="polite" className="sr-only" role="status">
              Saindo…
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
