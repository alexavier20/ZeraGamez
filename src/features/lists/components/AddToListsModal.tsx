import { Check, ChevronLeft, ChevronRight, Library, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import type { AddToListsOption } from '@/features/lists/model/add-to-lists';
import type * as React from 'react';

export type { AddToListsOption } from '@/features/lists/model/add-to-lists';

export interface AddToListsModalProps {
  readonly gameName: string;
  readonly lists: readonly AddToListsOption[];
  readonly onClose: () => void;
  readonly onConfirm?: (listIds: readonly string[]) => void;
  readonly open: boolean;
}

const pageSize = 4;
const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function selectedLabel(count: number): string {
  if (count === 0) return 'Selecione uma ou mais listas';
  return `${String(count)} ${count === 1 ? 'lista selecionada' : 'listas selecionadas'}`;
}

interface ListOptionCardProps {
  readonly list: AddToListsOption;
  readonly onToggle: (id: string) => void;
  readonly selected: boolean;
}

function ListOptionCard({ list, onToggle, selected }: ListOptionCardProps) {
  return (
    <button
      aria-label={list.name}
      aria-pressed={selected}
      className={`relative flex h-[126px] min-w-0 flex-col gap-2 overflow-hidden rounded-xl border bg-bg-secondary p-2 text-left transition-colors sm:h-[116px] ${
        selected
          ? 'border-2 border-brand bg-list-selected'
          : 'border-border-brand hover:border-brand/60'
      }`}
      onClick={() => {
        onToggle(list.id);
      }}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`absolute right-2.5 top-2.5 z-10 flex size-[22px] items-center justify-center rounded-[7px] border ${
          selected
            ? 'border-brand bg-brand text-white'
            : 'border-white/35 bg-[#17131fdd] text-transparent'
        }`}
      >
        <Check size={13} />
      </span>
      <span className="flex h-[72px] w-full shrink-0 gap-0.5 overflow-hidden rounded-lg">
        {list.covers.slice(0, 3).map((cover) => (
          <img
            alt=""
            className="min-w-0 flex-1 object-cover"
            key={cover}
            loading="lazy"
            src={cover}
          />
        ))}
      </span>
      <span className="min-w-0 text-xs font-semibold leading-[1.15] text-content-primary sm:truncate">
        {selected ? '✓ ' : null}
        {list.name}
      </span>
    </button>
  );
}

type AddToListsDialogProps = Omit<AddToListsModalProps, 'open'>;

function AddToListsDialog({
  gameName,
  lists,
  onClose,
  onConfirm,
}: AddToListsDialogProps): React.ReactElement {
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const pageCount = Math.ceil(lists.length / pageSize);
  const visibleLists = lists.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      const first = controls.at(0);
      const last = controls.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
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
    };
  }, [onClose]);

  const toggleList = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-[88px] sm:py-[160px]">
      <button
        aria-label="Fechar ao clicar fora do modal"
        className="absolute inset-0 size-full bg-black/70"
        data-testid="add-to-lists-backdrop"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-describedby={lists.length > 0 ? descriptionId : undefined}
        aria-label={`Adicionar ${gameName} à lista`}
        aria-modal="true"
        className="relative z-10 flex w-full max-w-[358px] flex-col gap-[18px] rounded-2xl border border-border-brand bg-surface p-5 shadow-[0_14px_36px_#00000077] sm:max-w-[480px] sm:p-6"
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex h-11 items-center justify-between sm:h-[34px]">
          <h2 className="font-heading text-lg font-semibold text-content-primary">
            Adicionar à lista
          </h2>
          <button
            aria-label="Fechar modal"
            className="flex size-11 items-center justify-center rounded-[11px] bg-bg-secondary text-text-muted transition-colors hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:size-[34px] sm:rounded-[9px]"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        {lists.length === 0 ? (
          <div className="flex h-[236px] flex-col items-center justify-center gap-3 sm:h-[230px]">
            <Library aria-hidden="true" className="text-brand" size={38} />
            <h3 className="font-heading text-lg font-semibold text-content-primary">
              Sua biblioteca começa aqui
            </h3>
            <p className="max-w-[280px] text-center text-xs text-text-muted sm:max-w-[320px]">
              Crie uma lista para organizar os jogos que você quer acompanhar.
            </p>
            <Link
              className="flex h-11 items-center rounded-[10px] bg-brand px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-10"
              onClick={onClose}
              to="/minhas-listas/nova"
            >
              Adicionar nova lista
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-text-muted" id={descriptionId}>
              {selectedLabel(selectedIds.size)}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {visibleLists.map((list) => (
                <ListOptionCard
                  key={list.id}
                  list={list}
                  onToggle={toggleList}
                  selected={selectedIds.has(list.id)}
                />
              ))}
            </div>

            {pageCount > 1 ? (
              <div className="flex h-11 items-center justify-center gap-2 sm:h-10 sm:gap-2.5">
                <button
                  aria-label="Página anterior"
                  className="flex size-11 items-center justify-center rounded-[11px] border border-border-brand bg-bg-secondary text-text-muted transition-colors enabled:hover:text-content-primary disabled:opacity-55 sm:size-10 sm:rounded-[10px]"
                  disabled={page === 0}
                  onClick={() => {
                    setPage((current) => current - 1);
                  }}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                </button>
                <span className="flex h-11 items-center rounded-[11px] border border-border-brand bg-bg-secondary px-3 text-xs font-semibold text-content-primary sm:h-10 sm:rounded-[10px]">
                  Página {String(page + 1)} de {String(pageCount)}
                </span>
                <button
                  aria-label="Próxima página"
                  className="flex size-11 items-center justify-center rounded-[11px] border border-border-brand bg-brand text-white transition-colors enabled:hover:bg-brand-bright disabled:bg-bg-secondary disabled:text-text-muted disabled:opacity-55 sm:size-10 sm:rounded-[10px]"
                  disabled={page === pageCount - 1}
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              </div>
            ) : null}

            <div className="flex h-11 justify-end gap-2.5 sm:h-10">
              <button
                className="rounded-[10px] bg-bg-secondary px-4 text-xs font-semibold text-content-primary transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={onClose}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-[10px] bg-brand px-4 text-xs font-semibold text-white transition-colors enabled:hover:bg-brand-bright disabled:bg-bg-secondary disabled:text-text-muted"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  onConfirm?.([...selectedIds]);
                  onClose();
                }}
                type="button"
              >
                Adicionar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function AddToListsModal({
  gameName,
  lists,
  onClose,
  onConfirm,
  open,
}: AddToListsModalProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <AddToListsDialog gameName={gameName} lists={lists} onClose={onClose} onConfirm={onConfirm} />
  );
}
