import { useId, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

import { headerCopy } from './header.config';

interface GlobalSearchProps {
  readonly className?: string;
  readonly onSearch?: (query: string) => void;
}

export function GlobalSearch({ className = '', onSearch }: Readonly<GlobalSearchProps>) {
  const inputId = useId();
  const [query, setQuery] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();

    if (normalizedQuery.length === 0) {
      return;
    }

    onSearch?.(normalizedQuery);
  }

  return (
    <form
      className={`flex h-10 items-center gap-2 rounded-xl border border-header-field-border bg-header-field px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-text-primary ${className}`}
      onSubmit={handleSubmit}
      role="search"
    >
      <label className="sr-only" htmlFor={inputId}>
        {headerCopy.searchLabel}
      </label>
      <button
        aria-label={headerCopy.searchButtonLabel}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-header-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        type="submit"
      >
        <Search aria-hidden="true" size={18} />
      </button>
      <input
        className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-header-text"
        id={inputId}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={headerCopy.searchPlaceholder}
        type="search"
        value={query}
      />
    </form>
  );
}
