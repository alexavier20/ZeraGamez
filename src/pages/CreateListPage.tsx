import { X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { ZodError } from 'zod';

import { useAuth } from '@/features/auth/context/AuthProvider';
import { isListsOperationCancelled, useLists } from '@/features/lists/context/ListsProvider';
import { normalizeCreateListInput } from '@/features/lists/model/lists';
import { createSupabaseTierListsRepository } from '@/features/tier-lists/api/tier-lists-repository';
import { headerRoutes } from '@/shared/components/header/header.config';
import { getSupabaseClient } from '@/shared/supabase/client';
import { DataError } from '@/shared/supabase/data-error';

type FormField = 'description' | 'name';

interface FormMessage {
  readonly field?: FormField;
  readonly text: string;
}

const creationErrorMessage = 'Não foi possível criar a lista. Tente novamente.';
const focusableSelector =
  'button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CreateListPage() {
  const lists = useLists();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [listType, setListType] = useState<'standard' | 'tier'>('standard');
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [pending, setPending] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef(pending);

  useLayoutEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const closeModal = useCallback(() => {
    void navigate(headerRoutes.lists, { replace: true });
  }, [navigate]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusTo =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    nameInput.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pendingRef.current) closeModal();
        return;
      }
      if (event.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;
      const controls = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector));
      const first = controls.at(0);
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        modal.focus();
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
  }, [closeModal]);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    let normalized;
    try {
      normalized = normalizeCreateListInput({ name, description });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        const field: FormField = issue.path[0] === 'description' ? 'description' : 'name';
        setMessage({ field, text: issue.message });
        queueMicrotask(() => {
          if (field === 'description') descriptionInput.current?.focus();
          else nameInput.current?.focus();
        });
        return;
      }
      setMessage({ text: creationErrorMessage });
      return;
    }

    setMessage(null);
    setPending(true);
    try {
      if (listType === 'tier') {
        const client = getSupabaseClient();
        if (authState.status !== 'authenticated') throw new DataError('unauthenticated');
        if (client === null) throw new DataError('configuration');

        const tierList = await createSupabaseTierListsRepository(client).createList(
          authState.user.id,
          normalized,
        );
        await navigate(`/minhas-listas/tier/${String(tierList.id)}`, { replace: true });
        return;
      }

      await lists.createList(normalized);
      await navigate(headerRoutes.lists, { replace: true });
    } catch (error) {
      if (isListsOperationCancelled(error)) return;
      if (
        error instanceof DataError &&
        (error.code === 'list_name_conflict' || error.code === 'list_name_reserved')
      ) {
        setMessage({ field: 'name', text: error.message });
        queueMicrotask(() => nameInput.current?.focus());
        return;
      }
      setMessage({ text: creationErrorMessage });
      queueMicrotask(() => nameInput.current?.focus());
    } finally {
      setPending(false);
    }
  };

  const nameError = message?.field === 'name' ? message : null;
  const descriptionError = message?.field === 'description' ? message : null;
  const submissionError = message !== null && message.field === undefined ? message : null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto px-3 py-4 sm:px-6">
      <button
        aria-label="Fechar criação de lista"
        className="absolute inset-0 size-full bg-black/75 disabled:cursor-not-allowed"
        disabled={pending}
        onClick={closeModal}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-lower-right-cut relative z-10 w-full max-w-2xl border-l-4 border-l-brand-bright bg-modal p-5 shadow-[0_14px_36px_#00000080] sm:p-7"
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="Cancelar criação da lista"
          className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-xl bg-bg-secondary text-text-muted transition-colors hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand-bright"
          disabled={pending}
          onClick={closeModal}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
        <h1 className="pr-12 font-heading text-2xl font-bold text-content-primary" id={titleId}>
          Criar lista
        </h1>
        <p className="mt-2 text-sm text-text-muted" id={descriptionId}>
          Dê um nome e uma descrição para sua coleção
        </p>
        <form
          className="mt-6 space-y-5"
          noValidate
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div>
            <label
              className="mb-2 block text-sm font-bold text-content-primary"
              htmlFor="create-list-name"
            >
              Nome da lista
            </label>
            <input
              aria-describedby={nameError === null ? undefined : 'create-list-name-error'}
              aria-invalid={nameError === null ? undefined : true}
              className="min-h-12 w-full rounded-xl border border-border bg-app px-4 text-content-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-2 focus:ring-brand-bright/30"
              id="create-list-name"
              maxLength={80}
              disabled={pending}
              onChange={(event) => {
                setName(event.target.value);
                if (message?.field === 'name') setMessage(null);
              }}
              ref={nameInput}
              value={name}
            />
            {nameError === null ? null : (
              <p className="mt-2 text-sm text-red-700" id="create-list-name-error" role="alert">
                {nameError.text}
              </p>
            )}
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-bold text-content-primary"
              htmlFor="create-list-type"
            >
              Tipo da lista
            </label>
            <select
              className="min-h-12 w-full rounded-xl border border-border bg-app px-4 text-content-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-bright/30"
              disabled={pending}
              id="create-list-type"
              onChange={(event) => {
                setListType(event.target.value === 'tier' ? 'tier' : 'standard');
              }}
              value={listType}
            >
              <option value="standard">Padrão</option>
              <option value="tier">Tier List</option>
            </select>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-bold text-content-primary"
              htmlFor="create-list-description"
            >
              Descrição
            </label>
            <textarea
              aria-describedby={
                descriptionError === null ? undefined : 'create-list-description-error'
              }
              aria-invalid={descriptionError === null ? undefined : true}
              className="min-h-32 w-full resize-y rounded-xl border border-border bg-app px-4 py-3 text-content-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-2 focus:ring-brand-bright/30"
              id="create-list-description"
              maxLength={500}
              disabled={pending}
              onChange={(event) => {
                setDescription(event.target.value);
                if (message?.field === 'description') setMessage(null);
              }}
              ref={descriptionInput}
              value={description}
            />
            {descriptionError === null ? null : (
              <p
                className="mt-2 text-sm text-red-700"
                id="create-list-description-error"
                role="alert"
              >
                {descriptionError.text}
              </p>
            )}
          </div>

          {submissionError === null ? null : (
            <p
              className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-700"
              role="alert"
            >
              {submissionError.text}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-xl border border-border px-5 py-3 text-sm font-bold text-content-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
              onClick={closeModal}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="cut-corner-button bg-brand px-5 py-3 text-sm font-bold text-brand-ink transition-colors duration-150 hover:bg-brand-hover hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Criando lista…' : 'Criar lista'}
            </button>
          </div>
          {pending ? (
            <p aria-live="polite" className="sr-only" role="status">
              Criando lista…
            </p>
          ) : null}
        </form>
      </div>
    </div>,
    document.body,
  );
}
