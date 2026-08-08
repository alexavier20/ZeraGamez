# Zera GameZ

O **Zera GameZ** será uma plataforma sobre jogos e lançamentos de games. O projeto ainda está em sua etapa inicial: esta versão contém a fundação técnica, uma página acessível de “Em construção” e a infraestrutura server-side para consultar lançamentos da IGDB. A resposta ainda é exibida somente no console do navegador; não há cards, listas ou dados fictícios na interface.

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
- GitHub Actions para integração contínua

As versões exatas instaladas estão registradas no `package-lock.json`.

## Pré-requisitos

- Node.js 22.13 ou superior. O workflow de integração contínua usa Node.js 24 LTS.
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

Abra o endereço informado pelo Vite no terminal.

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

- npm run dev inicia somente o Vite para trabalho visual.
- npm run dev:vercel inicia o frontend e as Vercel Functions.

GET /api/releases aceita from e to no formato YYYY-MM-DD, limit entre 1 e 100,
platforms e genres como listas de IDs separadas por vírgulas. Sem parâmetros, a
consulta cobre hoje em America/Sao_Paulo até 90 dias depois e retorna até 50
jogos consolidados.

## Comandos disponíveis

| Comando                | Finalidade                                          |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Inicia o servidor de desenvolvimento                |
| `npm run build`        | Verifica o TypeScript e gera a aplicação em `dist/` |
| `npm run preview`      | Serve localmente o build de produção                |
| `npm run lint`         | Verifica o código com ESLint                        |
| `npm run lint:fix`     | Corrige automaticamente problemas seguros de lint   |
| `npm run format`       | Formata os arquivos com Prettier                    |
| `npm run format:check` | Confere a formatação sem alterar arquivos           |
| `npm run typecheck`    | Verifica os tipos sem emitir JavaScript             |
| `npm run test`         | Executa o Vitest em modo de observação              |
| `npm run test:run`     | Executa os testes uma vez, adequado para CI         |

## Estrutura atual

```text
zera-gamez/
├── .github/
│   └── workflows/
│       └── quality.yml
├── api/
│   └── releases.ts
├── public/
├── server/
│   └── releases/
│       ├── application/
│       ├── domain/
│       └── infrastructure/
├── shared/
│   └── contracts/
├── src/
│   ├── app/
│   │   ├── App.test.tsx
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── features/
│   │   └── releases/
│   │       ├── api/
│   │       └── hooks/
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

`public/` fica disponível para arquivos estáticos que não precisem passar pelo pipeline do Vite. Ela permanece vazia nesta etapa para evitar ativos sem uso.

## Decisões arquiteturais

- A aplicação usa uma SPA pequena com `BrowserRouter`, uma rota `/` e redirecionamento simples de endereços desconhecidos para a página inicial.
- O alias `@/` aponta para `src/` no TypeScript, Vite, testes e ESLint, reduzindo imports relativos frágeis.
- O token `brand` centraliza a cor principal `#e70012`; `surface` registra o fundo escuro inicial. Ambos ficam no tema do Tailwind.
- O CSS global contém apenas o carregamento do Tailwind, tokens e bases do documento. O layout continua mobile-first.
- O lint com informação de tipos detecta, entre outros problemas, promises ignoradas e imports inválidos.
- A configuração atual permanece deliberadamente simples: não há estado global ou contextos sem uso. A integração de lançamentos usa portas pequenas, caso de uso, domínio e adaptadores server-side para manter credenciais e regras de consolidação desacopladas do React e da Vercel.

Quando novas funcionalidades surgirem, a organização deve evoluir gradualmente a partir da estrutura orientada a funcionalidades já usada pelos lançamentos, sem criar diretórios vazios antes da necessidade:

```text
src/
├── app/
├── features/
│   ├── games/
│   ├── authentication/
│   └── favorites/
└── shared/
    ├── components/
    ├── hooks/
    ├── lib/
    ├── services/
    └── types/
```

Integrações externas futuras devem ficar atrás de serviços ou adaptadores. Dados recebidos de APIs deverão ser validados antes de chegar aos componentes.

## Variáveis de ambiente e segurança

- Nunca envie arquivos `.env` reais ao Git.
- Variáveis prefixadas com `VITE_` são incorporadas ao bundle e ficam visíveis no navegador. Elas **não podem conter segredos**, tokens, senhas ou credenciais.
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

Não há banco de dados ou domínio configurados nesta etapa. A CLI da Vercel é usada apenas para executar localmente o frontend e a Function com `npm run dev:vercel`.

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

Também não foram instalados Axios, Redux, bibliotecas de gráficos, animação, datas ou ícones, nem SDKs de autenticação ou banco de dados. Essas dependências só devem ser avaliadas diante de uma necessidade concreta.
