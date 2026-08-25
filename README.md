# Zera GameZ

O **Zera GameZ** é uma plataforma para acompanhar lançamentos de games e organizar jogos em listas pessoais. A versão atual exibe os próximos lançamentos da IGDB em cards, oferece autenticação sem senha por código de e-mail ou Google e permite manter várias listas customizadas, incluindo “Quero jogar”.

## Tecnologias

- React e React DOM
- React Router em modo declarativo
- Vite
- TypeScript em modo estrito
- Tailwind CSS com o plugin oficial para Vite
- ESLint em flat config, com regras para TypeScript, Hooks, Fast Refresh, acessibilidade e imports
- Prettier
- Vitest, React Testing Library, `user-event`, `jest-dom` e jsdom
- Zod para validação de contratos públicos e dados externos
- Vercel Functions e CLI da Vercel para a API server-side e o desenvolvimento local integrado
- Supabase Auth, Postgres, Row Level Security e SDK JavaScript para autenticação e listas
- GitHub Actions para integração contínua

As versões exatas instaladas estão registradas no `package-lock.json`.

## Pré-requisitos

- Node.js 22.22.0 ou superior. O workflow de integração contínua usa Node.js 24 LTS.
- npm 10 ou superior.

## Instalação

```bash
npm install
```

O repositório não deve conter um arquivo `.env` real. O arquivo `.env.example` documenta apenas o contrato esperado.

## Desenvolvimento

Inicie o servidor local:

```bash
npm run dev
```

Esse comando inicia o frontend e as Vercel Functions em modo local, carrega o
`.env.local` quando ele existe e não cria nem vincula um projeto remoto. Abra o
endereço informado pela CLI no terminal. Para trabalhar somente na interface,
sem `/api`, use `npm run dev:vite`.

## Integração de lançamentos da IGDB

O navegador consome GET /api/releases na mesma origem. A Vercel Function mantém
as credenciais e o token OAuth no servidor, porque a IGDB não aceita chamadas
diretas do navegador e o client secret nunca pode entrar no bundle Vite.

Crie uma aplicação Confidential no Twitch Developer Portal e configure
IGDB_CLIENT_ID e IGDB_CLIENT_SECRET como **Sensitive Environment Variables**
nos ambientes Development, Preview e Production do projeto na Vercel. Nunca
use o prefixo VITE_ e nunca registre os valores ou o token no console.

Para desenvolvimento local, coloque os valores em .env.local, que é ignorado
pelo Git, ou baixe as variáveis Development com a CLI da Vercel.

- npm run dev (ou npm run dev:vercel) inicia o frontend e as Vercel Functions.
- npm run dev:vite inicia somente o Vite para trabalho visual, sem `/api`.

GET /api/releases aceita from e to no formato YYYY-MM-DD, limit entre 1 e 100,
platforms e genres como listas de IDs separadas por vírgulas. Sem parâmetros, a
consulta cobre hoje em America/Sao_Paulo até 90 dias depois e retorna até 50
jogos consolidados.

## Configuração do Supabase

1. Crie um projeto no Supabase e aplique a migration
   `supabase/migrations/20260824000000_auth_and_lists.sql` com a CLI do Supabase
   ou pelo SQL Editor do painel. A migration cria os perfis, jogos, listas,
   associações, funções e políticas de Row Level Security necessárias.
2. Em **Authentication > Email Templates**, configure o e-mail de acesso para
   renderizar o código de seis dígitos com `{{ .Token }}`.
3. Configure um provedor SMTP de produção antes do lançamento público. O serviço
   de e-mail padrão do Supabase é adequado apenas para testes iniciais e possui
   limitações de entrega.
4. Habilite o provedor Google e informe o Client ID e o Client Secret no
   Supabase. No console do Google, use a URL de callback exibida pelo Supabase;
   em **Authentication > URL Configuration**, permita
   `http://localhost:3000/entrar` e a URL `/entrar` do domínio de produção.
5. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no `.env.local`
   e também nos ambientes Development, Preview e Production da Vercel. Esses
   valores são públicos e a autorização dos dados continua protegida por RLS.
6. A chave `service_role` é secreta: ela nunca deve usar o prefixo `VITE_`, ser
   colocada no `.env.local` do frontend ou entrar no bundle enviado ao navegador.

## Comandos disponíveis

| Comando                | Finalidade                                           |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Inicia frontend e Functions no ambiente Vercel local |
| `npm run dev:vite`     | Inicia somente o frontend, sem `/api`                |
| `npm run dev:vercel`   | Alias para o ambiente Vercel local                   |
| `npm run build`        | Verifica o TypeScript e gera a aplicação em `dist/`  |
| `npm run preview`      | Serve localmente o build de produção                 |
| `npm run lint`         | Verifica o código com ESLint                         |
| `npm run lint:fix`     | Corrige automaticamente problemas seguros de lint    |
| `npm run format`       | Formata os arquivos com Prettier                     |
| `npm run format:check` | Confere a formatação sem alterar arquivos            |
| `npm run typecheck`    | Verifica os tipos sem emitir JavaScript              |
| `npm run test`         | Executa o Vitest em modo de observação               |
| `npm run test:run`     | Executa os testes uma vez, adequado para CI          |

## Estrutura atual

```text
zera-gamez/
├── .github/
│   └── workflows/
│       └── quality.yml
├── api/
│   └── releases.ts
├── public/
│   └── assets/
├── server/
│   └── releases/
│       ├── application/
│       ├── domain/
│       └── infrastructure/
├── shared/
│   └── contracts/
├── supabase/
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── App.test.tsx
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── features/
│   │   ├── auth/
│   │   ├── lists/
│   │   └── releases/
│   ├── pages/
│   ├── styles/
│   │   └── global.css
│   ├── test/
│   │   └── setup.ts
│   ├── main.tsx
│   └── vite-env.d.ts
├── .editorconfig
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── prettier.config.js
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
└── vite.config.ts
```

## Decisões arquiteturais

- A aplicação usa uma SPA com `BrowserRouter`, rotas públicas para início, lançamentos e login, além de rotas protegidas para listas, criação de lista e perfil. Endereços desconhecidos redirecionam para a página inicial.
- O alias `@/` aponta para `src/` no TypeScript, Vite, testes e ESLint, reduzindo imports relativos frágeis.
- O token `brand` centraliza a cor principal `#e70012`; `surface` registra o fundo escuro inicial. Ambos ficam no tema do Tailwind.
- O CSS global contém apenas o carregamento do Tailwind, tokens e bases do documento. O layout continua mobile-first.
- O lint com informação de tipos detecta, entre outros problemas, promises ignoradas e imports inválidos.
- Autenticação e listas ficam atrás de contextos e portas injetáveis. Sem as variáveis públicas do Supabase, as páginas públicas continuam funcionando e as ações protegidas direcionam para uma tela de login com orientação de configuração.
- A integração de lançamentos usa portas pequenas, caso de uso, domínio e adaptadores server-side para manter credenciais e regras de consolidação desacopladas do React e da Vercel.

Novas funcionalidades devem evoluir gradualmente a organização por domínio já
usada em `src/features`, sem criar diretórios vazios antes da necessidade.

Integrações externas futuras devem ficar atrás de serviços ou adaptadores. Dados recebidos de APIs deverão ser validados antes de chegar aos componentes.

## Variáveis de ambiente e segurança

- Nunca envie arquivos `.env` reais ao Git.
- Variáveis prefixadas com `VITE_` são incorporadas ao bundle e ficam visíveis no navegador. Elas **não podem conter segredos**, tokens, senhas ou credenciais.
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são configurações públicas; a proteção dos dados depende das políticas de Row Level Security.
- Nunca exponha a chave `service_role` no frontend nem use o prefixo `VITE_` nela.
- Não registre informações sensíveis no console.
- Dados externos da IGDB são validados antes de alcançar o domínio ou os componentes.
- Use `unknown`, e não `any`, antes da validação de dados de origem externa.

## Publicação na Vercel

O projeto está preparado, mas não foi publicado. Ao importar o repositório na Vercel, use:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

O `vercel.json` reescreve rotas da SPA para `index.html`, permitindo atualizar e acessar URLs internas diretamente. A Vercel continua servindo arquivos estáticos existentes antes de aplicar o fallback da aplicação, enquanto `api/releases.ts` é publicada como Vercel Function.

O banco e a autenticação são fornecidos pelo projeto Supabase configurado pelos
passos acima. A CLI da Vercel executa localmente o frontend e a Function com
`npm run dev` (ou `npm run dev:vercel`).

## Integração contínua

O workflow `.github/workflows/quality.yml` usa cache do npm e executa, em pushes para `main` e pull requests:

1. `npm ci`
2. `npm run lint`
3. `npm run format:check`
4. `npm run typecheck`
5. `npm run test:run`
6. `npm run build`

O deploy não faz parte do workflow. A publicação futura deverá usar a integração Git da Vercel.

## Tecnologias planejadas, mas ainda não instaladas

- TanStack Query para estado do servidor e cache
- React Hook Form para formulários
- Playwright para testes ponta a ponta quando existirem fluxos críticos, como busca, login, favoritos e navegação por jogos
- MSW para simulação de APIs em testes
- Zustand somente se surgir uma necessidade real de estado global no cliente
- shadcn/ui ou Radix UI somente após a definição do design system

Também não foram instalados Axios, Redux, bibliotecas de gráficos, animação ou
datas. Essas dependências só devem ser avaliadas diante de uma necessidade
concreta.
