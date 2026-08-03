import { Header } from '@/shared/components/header/Header';

import type { HeaderUser } from '@/shared/components/header/header.types';

const appUser = {
  name: 'Alex',
  initials: 'AB',
} as const satisfies HeaderUser;

export function App() {
  return (
    <div className="min-h-dvh bg-app text-text-primary">
      <Header user={appUser} />
      <main className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center px-6 py-12 pb-28 text-center sm:pb-12">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">Zera GameZ</h1>
          <div className="mx-auto my-5 h-1 w-12 rounded-full bg-brand" aria-hidden="true" />
          <p className="text-base text-text-muted sm:text-lg">Em construção</p>
        </div>
      </main>
    </div>
  );
}
