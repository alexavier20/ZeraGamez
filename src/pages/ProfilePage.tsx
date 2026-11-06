import { ArrowLeft, CheckCircle2, ImagePlus, LogOut, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { clearPendingAuthIntent } from '@/features/auth/model/pending-auth-intent';
import { headerRoutes } from '@/shared/components/header/header.config';
import { ProfileLoading } from '@/shared/components/LoadingSkeletons';

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
      setSuccess('Perfil atualizado');
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
    <main className="site-container min-h-[calc(100dvh-3.5rem)] max-w-xl pb-28 pt-5 sm:pb-12 sm:pt-6 lg:pt-7">
      <button
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-text-muted transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={handleBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.5} />
        Voltar
      </button>
      <section
        aria-labelledby="profile-title"
        className="rounded-2xl border border-white/10 bg-surface p-5 sm:p-6"
      >
        <h1
          id="profile-title"
          className="font-heading text-2xl font-semibold leading-tight text-content-primary sm:text-[28px]"
        >
          Perfil
        </h1>
        <div className="mt-5 grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 sm:grid-cols-[3rem_minmax(0,1fr)_auto]">
          <UserAvatar
            appearance="neutral"
            avatarUrl={visibleAvatarUrl}
            className="size-12 border border-white/10 text-lg"
            initials={user.initials}
            name={displayName.trim() || user.name}
          />
          <div className="min-w-0">
            <p className="break-words text-base font-medium text-content-primary">{user.name}</p>
            <p className="mt-1 break-all text-sm text-text-muted">{user.email}</p>
          </div>
          <button
            className="col-start-2 inline-flex min-h-11 items-center justify-self-start gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-content-primary transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary disabled:cursor-not-allowed disabled:opacity-60 sm:col-start-3 sm:row-start-1"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            <LogOut aria-hidden="true" size={18} strokeWidth={1.5} />
            {signingOut ? 'Saindo…' : 'Sair'}
          </button>
        </div>

        {signOutError === null ? null : (
          <p
            className="mt-4 break-words rounded-lg border border-red-400/20 bg-red-500/5 p-3 text-sm text-red-200"
            role="alert"
          >
            {signOutError}
          </p>
        )}

        <form
          aria-busy={saving}
          className="mt-6 border-t border-white/10 pt-5"
          onSubmit={(event) => {
            void handleSaveProfile(event);
          }}
        >
          <h2 className="font-heading text-lg font-semibold text-content-primary">
            Configurações do perfil
          </h2>

          <div className="mt-5 space-y-5">
            <div>
              <label
                className="mb-2 block text-sm font-medium text-content-primary"
                htmlFor="profile-name"
              >
                Nome para exibição
              </label>
              <input
                autoComplete="nickname"
                aria-describedby="profile-name-help"
                className="min-h-11 w-full rounded-lg border border-white/10 bg-app px-3 text-sm text-text-primary outline-none transition-colors focus:border-brand-bright focus:ring-2 focus:ring-brand/30"
                id="profile-name"
                maxLength={50}
                onChange={(event) => {
                  setDisplayName(event.currentTarget.value);
                }}
                required
                value={displayName}
              />
              <p className="mt-2 text-xs text-text-muted" id="profile-name-help">
                Nome exibido no seu perfil
              </p>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-content-primary">
                Foto de perfil
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-content-primary transition-colors hover:bg-white/10 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-text-primary"
                  htmlFor="profile-photo"
                >
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    aria-describedby="profile-photo-help"
                    className="sr-only"
                    id="profile-photo"
                    onChange={handleAvatarChange}
                    type="file"
                  />
                  <ImagePlus aria-hidden="true" size={18} strokeWidth={1.5} />
                  Escolher imagem
                </label>
                <p
                  className="min-w-0 basis-full break-all text-xs text-text-muted"
                  id="profile-photo-help"
                >
                  {selectedAvatar?.file.name ?? 'JPEG, PNG ou WebP, até 5 MB'}
                </p>
              </div>
            </div>
          </div>

          {profileError === null ? null : (
            <p
              className="mt-5 break-words rounded-lg border border-red-400/20 bg-red-500/5 p-3 text-sm text-red-200"
              role="alert"
            >
              {profileError}
            </p>
          )}
          {success === null ? null : (
            <p
              className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm text-emerald-200"
              role="status"
            >
              <CheckCircle2 aria-hidden="true" className="shrink-0" size={18} strokeWidth={1.5} />
              {success}
            </p>
          )}
          <div className="mt-5 flex justify-end">
            <button
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-44"
              disabled={saving}
              type="submit"
            >
              <Save aria-hidden="true" size={18} strokeWidth={1.5} />
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
          <h2 className="font-heading text-lg font-semibold text-content-primary">
            Métodos de acesso
          </h2>
          <ul className="mt-3 space-y-2" aria-label="Métodos de acesso disponíveis">
            {['Código por e-mail', 'Google'].map((method) => (
              <li className="text-sm text-text-muted" key={method}>
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
    return <ProfileLoading />;
  }

  return <ProfileSettings auth={auth} key={state.user.id} user={state.user} />;
}
