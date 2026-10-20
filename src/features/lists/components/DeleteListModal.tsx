import { LoaderCircle, Trash2, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import type { UserListSummary } from '@/features/lists/model/lists';

interface DeleteListModalProps {
  readonly errorMessage: string | null;
  readonly isDeleting: boolean;
  readonly list: UserListSummary;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DeleteListModal({
  errorMessage,
  isDeleting,
  list,
  onClose,
  onConfirm,
}: DeleteListModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(isDeleting);
  busyRef.current = isDeleting;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusTo =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      const first = controls.at(0);
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (!controls.includes(document.activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-3 py-4 sm:px-6">
      <button
        aria-label="Cancelar exclusão da lista"
        className="absolute inset-0 size-full bg-black/75 disabled:cursor-not-allowed"
        disabled={isDeleting}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-busy={isDeleting || undefined}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-2xl border border-border-brand bg-surface p-6 shadow-[0_14px_36px_#00000077] sm:p-7"
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
      >
        <button
          aria-label="Cancelar exclusão da lista"
          className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-xl bg-bg-secondary text-text-muted transition-colors hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand"
          disabled={isDeleting}
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
        <div className="flex size-12 items-center justify-center rounded-xl bg-red-500/15 text-red-200">
          <Trash2 aria-hidden="true" size={22} />
        </div>
        <h2 className="mt-4 pr-10 font-heading text-xl font-bold text-content-primary" id={titleId}>
          Excluir lista?
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted" id={descriptionId}>
          A lista <span className="font-semibold text-content-primary">{list.name}</span>, seus
          jogos exclusivos e vínculos serão removidos. Jogos usados em outras listas serão
          preservados. Esta ação não pode ser desfeita.
        </p>
        {errorMessage === null ? null : (
          <p className="mt-4 text-sm text-red-200" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="min-h-11 rounded-xl border border-border-brand px-4 text-sm font-semibold text-content-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand"
            disabled={isDeleting}
            onClick={onClose}
            ref={cancelButtonRef}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
            ) : (
              <Trash2 aria-hidden="true" size={16} />
            )}
            {isDeleting ? 'Excluindo…' : 'Excluir lista'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
