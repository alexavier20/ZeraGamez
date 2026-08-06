# Release View Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à página “Próximos lançamentos” o alternador funcional Lista/Calendário selecionado no Pen.

**Architecture:** Um componente controlado e específico da funcionalidade de lançamentos recebe `value` e `onChange`. `ReleasesPage` mantém o estado local, posiciona o controle ao lado do título no desktop e o oculta abaixo do breakpoint `lg`.

**Tech Stack:** React 19, TypeScript estrito, Tailwind CSS 4, Lucide React, Vitest, React Testing Library e user-event.

## Global Constraints

- Lista é o modo inicial; os valores permitidos são somente `list` e `calendar`.
- A troca altera apenas o estado e a apresentação do controle; conteúdo de lista e calendário está fora do escopo.
- O componente é visível somente em desktop (`lg`) e oculto em tablet e celular.
- Reproduzir as medidas, cores, tipografia e ícones do nó `PZPQC` do Pen.
- Usar os tokens Tailwind e as dependências já instaladas; não adicionar pacotes.
- Manter foco visível, nome acessível do grupo e `aria-pressed` nos botões.
- Esta cópia de trabalho não contém `.git`; não há etapas de commit executáveis.

---

### Task 1: Componente controlado `ReleaseViewSwitcher`

**Files:**

- Create: `src/features/releases/components/ReleaseViewSwitcher.tsx`
- Create: `src/features/releases/components/ReleaseViewSwitcher.test.tsx`

**Interfaces:**

- Consumes: ícones `List` e `CalendarDays` de `lucide-react`; tokens `bg-secondary`, `surface-hover`, `content-primary` e `text-muted`.
- Produces: `export type ReleaseView = 'list' | 'calendar'` e `ReleaseViewSwitcher({ value, onChange })`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  ReleaseViewSwitcher,
  type ReleaseView,
} from '@/features/releases/components/ReleaseViewSwitcher';

function ControlledSwitcher() {
  const [value, setValue] = useState<ReleaseView>('list');

  return <ReleaseViewSwitcher onChange={setValue} value={value} />;
}

describe('ReleaseViewSwitcher', () => {
  it('alterna o modo selecionado com semântica acessível', async () => {
    const user = userEvent.setup();
    render(<ControlledSwitcher />);

    const group = screen.getByRole('group', { name: 'Alternar visualização' });
    const listButton = screen.getByRole('button', { name: 'Lista' });
    const calendarButton = screen.getByRole('button', { name: 'Calendário' });

    expect(group).toBeInTheDocument();
    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(calendarButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(calendarButton);

    expect(listButton).toHaveAttribute('aria-pressed', 'false');
    expect(calendarButton).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `npm.cmd run test:run -- src/features/releases/components/ReleaseViewSwitcher.test.tsx`

Expected: FAIL porque `ReleaseViewSwitcher.tsx` ainda não existe.

- [ ] **Step 3: Implementar o componente mínimo fiel ao Pen**

```tsx
import { CalendarDays, List } from 'lucide-react';

export type ReleaseView = 'list' | 'calendar';

type ReleaseViewSwitcherProps = Readonly<{
  onChange: (value: ReleaseView) => void;
  value: ReleaseView;
}>;

const optionClassName =
  'flex h-8 items-center gap-[7px] rounded-[9px] px-[11px] text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export function ReleaseViewSwitcher({ onChange, value }: ReleaseViewSwitcherProps) {
  return (
    <div
      aria-label="Alternar visualização"
      className="hidden h-10 w-[189px] items-center gap-1 rounded-xl bg-bg-secondary p-1 lg:flex"
      role="group"
    >
      <button
        aria-pressed={value === 'list'}
        className={`${optionClassName} ${
          value === 'list'
            ? 'bg-surface-hover text-content-primary'
            : 'bg-transparent text-text-muted hover:text-content-primary'
        }`}
        onClick={() => onChange('list')}
        type="button"
      >
        <List aria-hidden="true" size={15} />
        Lista
      </button>
      <button
        aria-pressed={value === 'calendar'}
        className={`${optionClassName} ${
          value === 'calendar'
            ? 'bg-surface-hover text-content-primary'
            : 'bg-transparent text-text-muted hover:text-content-primary'
        }`}
        onClick={() => onChange('calendar')}
        type="button"
      >
        <CalendarDays aria-hidden="true" size={15} />
        Calendário
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Executar o teste e confirmar GREEN**

Run: `npm.cmd run test:run -- src/features/releases/components/ReleaseViewSwitcher.test.tsx`

Expected: PASS com 1 teste; nenhuma mensagem de erro ou aviso.

- [ ] **Step 5: Formatar e repetir o teste**

Run: `npm.cmd exec prettier -- --write src/features/releases/components/ReleaseViewSwitcher.tsx src/features/releases/components/ReleaseViewSwitcher.test.tsx`

Run: `npm.cmd run test:run -- src/features/releases/components/ReleaseViewSwitcher.test.tsx`

Expected: PASS com a saída limpa.

---

### Task 2: Integração no cabeçalho da página de lançamentos

**Files:**

- Modify: `src/pages/ReleasesPage.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**

- Consumes: `ReleaseView`, `ReleaseViewSwitcher`, `PageHeading` e o breakpoint Tailwind `lg`.
- Produces: página com estado local iniciado em `list`, controle alinhado ao fim do cabeçalho e classe `hidden lg:flex`.

- [ ] **Step 1: Acrescentar asserções de integração que falham**

Dentro do teste existente que abre a página de lançamentos, depois das asserções de título, adicionar:

```tsx
const viewSwitcher = screen.getByRole('group', { name: 'Alternar visualização' });
const listButton = screen.getByRole('button', { name: 'Lista' });
const calendarButton = screen.getByRole('button', { name: 'Calendário' });

expect(viewSwitcher).toHaveClass('hidden', 'lg:flex');
expect(listButton).toHaveAttribute('aria-pressed', 'true');
expect(calendarButton).toHaveAttribute('aria-pressed', 'false');

await user.click(calendarButton);

expect(listButton).toHaveAttribute('aria-pressed', 'false');
expect(calendarButton).toHaveAttribute('aria-pressed', 'true');
```

- [ ] **Step 2: Executar a integração e confirmar RED**

Run: `npm.cmd run test:run -- src/app/App.test.tsx`

Expected: FAIL porque o grupo “Alternar visualização” ainda não está na página.

- [ ] **Step 3: Integrar o componente e o estado na página**

Substituir `ReleasesPage.tsx` por:

```tsx
import { useState } from 'react';

import {
  ReleaseViewSwitcher,
  type ReleaseView,
} from '@/features/releases/components/ReleaseViewSwitcher';
import { PageHeading } from '@/shared/components/page-heading/PageHeading';

export function ReleasesPage() {
  const [view, setView] = useState<ReleaseView>('list');

  return (
    <main
      aria-label="Lançamentos"
      className="mx-auto min-h-[calc(100dvh-4.5rem)] max-w-[1440px] px-4 pt-[22px] pb-28 sm:px-5 sm:pt-7 sm:pb-12 lg:px-8 lg:pt-9"
    >
      <div className="lg:flex lg:items-end lg:justify-between">
        <PageHeading title="Próximos lançamentos" subtitle="Descubra os games que estão chegando" />
        <ReleaseViewSwitcher onChange={setView} value={view} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Executar os testes focados e confirmar GREEN**

Run: `npm.cmd run test:run -- src/app/App.test.tsx src/features/releases/components/ReleaseViewSwitcher.test.tsx src/shared/components/page-heading/PageHeading.test.tsx`

Expected: todos os testes selecionados passam sem erros ou avisos.

- [ ] **Step 5: Formatar os arquivos alterados e repetir os testes focados**

Run: `npm.cmd exec prettier -- --write src/pages/ReleasesPage.tsx src/app/App.test.tsx`

Run: `npm.cmd run test:run -- src/app/App.test.tsx src/features/releases/components/ReleaseViewSwitcher.test.tsx src/shared/components/page-heading/PageHeading.test.tsx`

Expected: PASS com a saída limpa.

---

### Task 3: Verificação funcional e visual final

**Files:**

- Verify: `src/features/releases/components/ReleaseViewSwitcher.tsx`
- Verify: `src/pages/ReleasesPage.tsx`

**Interfaces:**

- Consumes: aplicação completa construída nas tarefas anteriores.
- Produces: evidência de qualidade automatizada e fidelidade visual ao componente do Pen.

- [ ] **Step 1: Executar a porta completa de qualidade**

Run, nesta ordem:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: todos os comandos encerram com código 0.

- [ ] **Step 2: Executar a aplicação no servidor local**

Run: `npm.cmd run dev -- --host 127.0.0.1`

Expected: Vite informa uma URL local acessível.

- [ ] **Step 3: Verificar no navegador em desktop**

Abrir `/lancamentos` em 1440 px de largura, confirmar o controle à direita e alinhado à base do título, clicar em Calendário e confirmar a inversão das cores e de `aria-pressed` sem erros no console.

- [ ] **Step 4: Verificar tablet e celular**

Em larguras de 768 px e 390 px, confirmar que o controle não aparece, o título mantém o layout existente e não há rolagem horizontal.

- [ ] **Step 5: Comparar com o Pen**

Comparar a captura desktop com o nó `PZPQC`: contêiner 189 × 40 px, opções de 32 px, raios de 12/9 px, intervalos 4/7 px, ícones de 15 px, rótulos de 12 px e estados de cor correspondentes.
