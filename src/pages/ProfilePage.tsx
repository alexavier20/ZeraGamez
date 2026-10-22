import { ArrowLeft, CheckCircle2, ImagePlus, LogOut, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { clearPendingAuthIntent } from '@/features/auth/model/pending-auth-intent';
import { headerRoutes } from '@/shared/components/header/header.config';

import type { AuthContextValue } from '@/features/auth/context/AuthProvider';
import type { AuthenticatedUser } from '@/features/auth/model/auth';
import type { ChangeEvent, SyntheticEvent } from 'react';

const signOutErrorMessage = 'Não foi possível sair. Tente novamente.';
const saveProfileErrorMessage = 'Não foi possível salvar seu perfil. Tente novamente.';
const avatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxAvatarSize = 5 * 1024 * 1024;

interface ProfileSettingsProps {
  readonly auth: AuthContextValue;
  readonly user: AuthenticatedUser;
}

function ProfileSettings({ auth, user }: ProfileSettingsProps) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user.name);
  const [selectedAvatar, setSelectedAvatar] = useState<{
    readonly file: File;
    readonly previewUrl: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const previewUrl = selectedAvatar?.previewUrl;
    return () => {
      if (previewUrl !== undefined) URL.revokeObjectURL(previewUrl);
    };
  }, [selectedAvatar]);

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) return;

    if (!avatarTypes.has(file.type) || file.size > maxAvatarSize) {
      setSelectedAvatar(null);
      setProfileError('Escolha uma imagem JPEG, PNG ou WebP com até 5 MB.');
      setSuccess(null);
      return;
    }

    setSelectedAvatar({ file, previewUrl: URL.createObjectURL(file) });
    setProfileError(null);
    setSuccess(null);
  };

  const handleSaveProfile = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = displayName.trim();
    if (normalizedName.length === 0 || normalizedName.length > 50) {
      setProfileError('Informe um nome com até 50 caracteres.');
      setSuccess(null);
      return;
    }
    if (saving) return;

    setSaving(true);
    setProfileError(null);
    setSuccess(null);
    try {
      const updatedUser = await auth.updateProfile({
        avatarFile: selectedAvatar?.file,
        displayName: normalizedName,
      });
      setDisplayName(updatedUser.name);
      setSelectedAvatar(null);
      setSuccess('Perfil atualizado com sucesso.');
    } catch {
      setProfileError(saveProfileErrorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSignOutError(null);
    setSigningOut(true);
    clearPendingAuthIntent(sessionStorage);
    const finishLogoutNavigation = auth.beginLogoutNavigation();
    try {
      await auth.signOut();
      clearPendingAuthIntent(sessionStorage);
      await navigate(headerRoutes.home, { replace: true });
    } catch {
      setSignOutError(signOutErrorMessage);
      setSigningOut(false);
    } finally {
      finishLogoutNavigation();
    }
  };

  const visibleAvatarUrl = selectedAvatar?.previewUrl ?? user.avatarUrl;
  const handleBack = () => {
    const historyState: unknown = window.history.state;
    const historyIndex =
      typeof historyState === 'object' && historyState !== null && 'idx' in historyState
        ? historyState.idx
        : undefined;
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      void navigate(-1);
      return;
    }
    void navigate(headerRoutes.home, { replace: true });
  };

  return (
    <main className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-xl px-4 pt-8 pb-28 sm:px-5 sm:pb-12 lg:pt-10">
      <button
        className="mb-4 inline-flex min-h-9 items-center gap-2 rounded-lg text-sm font-semibold text-text-muted transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={handleBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        Voltar
      </button>
      <section
        aria-label="Conta"
        className="rounded-2xl border border-white/10 bg-surface p-5 sm:p-6"
      >
        <h1 className="sr-only">Perfil</h1>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar
              avatarUrl={visibleAvatarUrl}
              className="size-12 shrink-0 border border-white text-lg"
              initials={user.initials}
              name={displayName.trim() || user.name}
            />
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-bold text-content-primary sm:text-xl">
                Olá, {user.name}
              </h1>
              <p className="truncate text-sm text-text-muted">{user.email}</p>
            </div>
          </div>
          <button
            className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-content-primary transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            <LogOut aria-hidden="true" size={15} />
            {signingOut ? 'Saindo…' : 'Sair'}
          </button>
        </div>

        {signOutError === null ? null : (
          <p
            className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
            role="alert"
          >
            {signOutError}
          </p>
        )}

        <form
          className="mt-6 border-t border-white/10 pt-5"
          onSubmit={(event) => {
            void handleSaveProfile(event);
          }}
        >
          <h2 className="font-heading text-lg font-bold text-content-primary">
            Configurações do perfil
          </h2>

          <div className="mt-5 space-y-5">
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-content-primary"
                htmlFor="profile-name"
              >
                Nome para exibição
              </label>
              <input
                autoComplete="nickname"
                className="min-h-11 w-full rounded-xl border border-white/15 bg-app px-3 text-sm text-text-primary outline-none transition focus:border-brand-bright focus:ring-2 focus:ring-brand/30"
                id="profile-name"
                maxLength={50}
                onChange={(event) => {
                  setDisplayName(event.currentTarget.value);
                }}
                required
                value={displayName}
              />
              <p className="mt-2 text-xs text-text-muted">
                Esse nome aparece na saudação e no seu perfil.
              </p>
            </div>

            <div>
              <span className="mb-2 block text-sm font-semibold text-content-primary">
                Foto de perfil
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-content-primary transition hover:border-brand/50 hover:bg-brand/10 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand"
                  htmlFor="profile-photo"
                >
                  <ImagePlus aria-hidden="true" size={17} />
                  Escolher imagem
                </label>
                {visibleAvatarUrl === null ? null : (
                  <img
                    alt=""
                    aria-hidden="true"
                    className="size-9 rounded-full border border-white object-cover"
                    src={visibleAvatarUrl}
                  />
                )}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  id="profile-photo"
                  onChange={handleAvatarChange}
                  type="file"
                />
                <p className="basis-full text-xs text-text-muted">
                  {selectedAvatar?.file.name ?? 'JPEG, PNG ou WebP, até 5 MB.'}
                </p>
              </div>
            </div>
          </div>

          {profileError === null ? null : (
            <p
              className="mt-5 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
              role="alert"
            >
              {profileError}
            </p>
          )}
          {success === null ? null : (
            <p
              className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"
              role="status"
            >
              <CheckCircle2 aria-hidden="true" className="shrink-0" size={17} />
              {success}
            </p>
          )}
          <div className="mt-5 flex justify-center">
            <button
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-40"
              disabled={saving}
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
          {saving ? (
            <p aria-live="polite" className="sr-only" role="status">
              Salvando perfil…
            </p>
          ) : null}
        </form>

        <div className="mt-6 border-t border-white/10 pt-5">
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

        {signingOut ? (
          <p aria-live="polite" className="sr-only" role="status">
            Saindo…
          </p>
        ) : null}
      </section>
    </main>
  );
}

export function ProfilePage() {
  const auth = useAuth();
  const { state } = auth;

  if (state.status !== 'authenticated') {
    return <p role="status">Carregando perfil</p>;
  }

  return <ProfileSettings auth={auth} key={state.user.id} user={state.user} />;
}
