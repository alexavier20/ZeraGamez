import { ArrowLeft, Ellipsis, Share2, X } from 'lucide-react';
import { Link } from 'react-router';

import { UserAvatar } from '@/features/auth/components/UserAvatar';

import { headerRoutes } from './header.config';
import { HeaderBrand } from './HeaderBrand';

import type { HeaderAccount, HeaderContextAction } from './header.types';

type MobileContextHeaderProps =
  | Readonly<{
      variant: 'default';
      account?: HeaderAccount;
      onProfileClick?: () => void;
    }>
  | Readonly<{
      variant: 'detail';
      title: string;
      onBack: () => void;
      contextAction?: HeaderContextAction;
    }>
  | Readonly<{
      variant: 'form';
      title: string;
      onClose: () => void;
      contextAction: HeaderContextAction;
    }>;

function ContextAction({ action }: Readonly<{ action: HeaderContextAction }>) {
  const content =
    action.kind === 'text' ? (
      action.text
    ) : action.kind === 'share' ? (
      <Share2 aria-hidden="true" size={20} />
    ) : (
      <Ellipsis aria-hidden="true" size={20} />
    );

  return (
    <button
      aria-label={action.label}
      className="grid min-h-10 min-w-10 place-items-center rounded-lg px-2 text-sm font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
      onClick={action.onClick}
      type="button"
    >
      {content}
    </button>
  );
}

export function MobileContextHeader(props: MobileContextHeaderProps) {
  if (props.variant === 'default') {
    return (
      <div
        className="flex h-[62px] items-center justify-between px-4"
        data-testid="mobile-context-header"
      >
        <HeaderBrand compact />
        {props.account?.status === 'authenticated' ? (
          <Link
            aria-label={`Abrir perfil de ${props.account.user.name}`}
            className="flex min-w-0 items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
            onClick={props.onProfileClick}
            to={headerRoutes.profile}
          >
            <UserAvatar
              avatarUrl={props.account.user.avatarUrl ?? null}
              className="size-9 border border-white text-[11px]"
              initials={props.account.user.initials}
              name={props.account.user.name}
            />
            <span className="max-w-28 truncate text-xs font-semibold text-content-primary">
              Olá, {props.account.user.name}
            </span>
          </Link>
        ) : null}
      </div>
    );
  }

  const leadingAction =
    props.variant === 'detail' ? (
      <button
        aria-label="Voltar"
        className="grid size-10 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={props.onBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={21} />
      </button>
    ) : (
      <button
        aria-label="Fechar"
        className="grid size-10 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        onClick={props.onClose}
        type="button"
      >
        <X aria-hidden="true" size={21} />
      </button>
    );

  return (
    <div
      className="grid h-[58px] grid-cols-[4rem_1fr_4rem] items-center px-4 text-text-primary"
      data-testid="mobile-context-header"
    >
      {leadingAction}
      <strong className="truncate text-center font-heading text-sm">{props.title}</strong>
      {props.contextAction ? (
        <ContextAction action={props.contextAction} />
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}
