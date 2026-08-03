import { ArrowLeft, Bell, Ellipsis, Share2, X } from 'lucide-react';

import { HeaderBrand } from './HeaderBrand';
import { headerCopy } from './header.config';
import type { HeaderContextAction } from './header.types';

type MobileContextHeaderProps =
  | Readonly<{ variant: 'default'; onNotificationsClick?: () => void }>
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
        <button
          aria-label={headerCopy.notificationsLabel}
          className="grid size-10 place-items-center rounded-lg text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
          onClick={props.onNotificationsClick}
          type="button"
        >
          <Bell aria-hidden="true" size={20} />
        </button>
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
