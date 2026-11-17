import { ChevronDown, IdCard, LogOut, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { UserAvatar } from '@/features/auth/components/UserAvatar';

import { headerRoutes } from './header.config';

import type { HeaderAccount } from './header.types';

interface HeaderActionsProps {
  readonly account: HeaderAccount;
  readonly compact?: boolean;
  readonly onProfileClick?: () => void;
  readonly onSignOut?: () => Promise<void>;
}

export function HeaderActions({
  account,
  compact = false,
  onProfileClick,
  onSignOut,
}: Readonly<HeaderActionsProps>) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsAccountMenuOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isAccountMenuOpen]);

  if (account.status === 'anonymous') {
    return (
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <Link
          aria-label="Entrar"
          className="grid size-10 place-items-center rounded-full text-white transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          title="Entrar"
          to="/entrar"
        >
          <UserRound aria-hidden="true" size={22} strokeWidth={1.7} />
        </Link>
      </div>
    );
  }

  const { user } = account;
  const handleSignOut = async () => {
    if (onSignOut === undefined || isSigningOut) return;

    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await onSignOut();
      setIsAccountMenuOpen(false);
    } catch {
      setSignOutError('Não foi possível sair. Tente novamente.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div
      className={`${compact ? 'flex' : 'ml-auto flex'} shrink-0 items-center gap-2`}
      ref={menuRef}
    >
      <Link
        aria-label={`Abrir perfil de ${user.name}`}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={() => {
          setIsAccountMenuOpen(false);
          onProfileClick?.();
        }}
        title={user.name}
        to={headerRoutes.profile}
      >
        <UserAvatar
          avatarUrl={user.avatarUrl ?? null}
          className={
            compact
              ? 'size-10 border border-white/50 text-xs'
              : 'size-9 border border-white/50 text-[11px]'
          }
          initials={user.initials}
          name={user.name}
        />
      </Link>
      <div className="relative min-w-0">
        <button
          aria-controls={menuId}
          aria-expanded={isAccountMenuOpen}
          aria-label={`Minha conta: ${user.name}`}
          className="flex max-w-40 flex-col items-start rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={() => {
            setIsAccountMenuOpen((isOpen) => !isOpen);
            setSignOutError(null);
          }}
          ref={triggerRef}
          type="button"
        >
          <span
            className={`block truncate text-sm font-semibold text-white ${compact ? 'max-w-28' : 'max-w-40'}`}
          >
            {user.name}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-white/80">
            Minha conta
            <ChevronDown
              aria-hidden="true"
              className={`transition-transform duration-150 ${isAccountMenuOpen ? 'rotate-180' : ''}`}
              size={14}
              strokeWidth={2}
            />
          </span>
        </button>
        {isAccountMenuOpen ? (
          <div
            aria-busy={isSigningOut}
            className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-border bg-surface p-1.5 text-text-primary shadow-xl"
            id={menuId}
          >
            <Link
              className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm transition-colors hover:bg-brand-bright/20 focus-visible:outline-2 focus-visible:outline-brand-bright"
              onClick={() => {
                setIsAccountMenuOpen(false);
                onProfileClick?.();
              }}
              to={headerRoutes.profile}
            >
              <IdCard aria-hidden="true" size={18} strokeWidth={1.7} />
              Meus dados
            </Link>
            <button
              className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm transition-colors hover:bg-brand-bright/20 focus-visible:outline-2 focus-visible:outline-brand-bright disabled:cursor-wait disabled:opacity-60"
              disabled={onSignOut === undefined || isSigningOut}
              onClick={() => {
                void handleSignOut();
              }}
              type="button"
            >
              <LogOut aria-hidden="true" size={18} strokeWidth={1.7} />
              {isSigningOut ? 'Saindo…' : 'Sair'}
            </button>
            {signOutError === null ? null : (
              <p className="px-3 py-2 text-xs text-red-700" role="alert">
                {signOutError}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
