import { useRef, useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ZodError } from 'zod';

import { isListsOperationCancelled, useLists } from '@/features/lists/context/ListsProvider';
import { normalizeCreateListInput } from '@/features/lists/model/lists';
import { headerRoutes } from '@/shared/components/header/header.config';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

type FormField = 'description' | 'name';

interface FormMessage {
  readonly field?: FormField;
  readonly text: string;
}

const creationErrorMessage = 'Não foi possível criar a lista. Tente novamente.';

export function CreateListPage() {
  const lists = useLists();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [pending, setPending] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);

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
      await lists.createList(normalized);
      await navigate(headerRoutes.lists, { replace: true });
    } catch (error) {
      if (isListsOperationCancelled(error)) return;
      setMessage({ text: creationErrorMessage });
      queueMicrotask(() => nameInput.current?.focus());
    } finally {
      setPending(false);
    }
  };

  const nameError = message?.field === 'name' ? message : null;
  const descriptionError = message?.field === 'description' ? message : null;
  const submissionError = message !== null && message.field === undefined ? message : null;

  return (
    <main className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-2xl px-4 pt-7 pb-28 sm:px-5 sm:pb-12 lg:pt-9">
      <PageHeading title="Criar lista" subtitle="Dê um nome e uma descrição para sua coleção" />

      <form
        className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-surface p-5 sm:p-7"
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
            className="min-h-12 w-full rounded-xl border border-white/15 bg-app px-4 text-content-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-2 focus:ring-brand/30"
            id="create-list-name"
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value);
              if (message?.field === 'name') setMessage(null);
            }}
            ref={nameInput}
            value={name}
          />
          {nameError === null ? null : (
            <p className="mt-2 text-sm text-red-300" id="create-list-name-error" role="alert">
              {nameError.text}
            </p>
          )}
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
            className="min-h-32 w-full resize-y rounded-xl border border-white/15 bg-app px-4 py-3 text-content-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-2 focus:ring-brand/30"
            id="create-list-description"
            maxLength={500}
            onChange={(event) => {
              setDescription(event.target.value);
              if (message?.field === 'description') setMessage(null);
            }}
            ref={descriptionInput}
            value={description}
          />
          {descriptionError === null ? null : (
            <p
              className="mt-2 text-sm text-red-300"
              id="create-list-description-error"
              role="alert"
            >
              {descriptionError.text}
            </p>
          )}
        </div>

        {submissionError === null ? null : (
          <p
            className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
            role="alert"
          >
            {submissionError.text}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            className="rounded-xl border border-white/15 px-5 py-3 text-center text-sm font-bold text-content-primary"
            to={headerRoutes.lists}
          >
            Cancelar
          </Link>
          <button
            className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
    </main>
  );
}
