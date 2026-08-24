# Autenticação Supabase e Listas Customizadas — Design

## Objetivo

Adicionar contas persistentes ao Zera GameZ com autenticação sem senha por código de seis dígitos enviado por e-mail e login social pelo Google. Usuários autenticados poderão criar várias listas customizadas, adicionar o mesmo jogo a listas diferentes e usar a ação especial “Quero jogar!”.

Início e Lançamentos continuam públicos. Recursos pessoais exigem autenticação e retomam a navegação ou ação que levou o usuário à tela de login.

## Decisões aprovadas

- Supabase Auth e PostgreSQL serão usados para autenticação e persistência.
- O frontend acessará Auth e os dados pessoais diretamente por `@supabase/supabase-js`, protegido por grants mínimos e Row Level Security (RLS).
- A API Vercel atual continuará responsável pela integração com a IGDB.
- A autenticação terá uma página dedicada em `/entrar`.
- Os métodos de acesso serão código por e-mail e Google; não haverá senha local.
- Início e Lançamentos serão públicos.
- Minhas listas, Criar lista e Perfil serão rotas protegidas.
- Ações pessoais iniciadas em páginas públicas levarão ao login e serão retomadas após a autenticação.
- Usuários poderão criar várias listas customizadas.
- “Quero jogar!” será uma lista especial criada sob demanda e única por usuário.
- Exclusão de lista e edição avançada de perfil não fazem parte deste incremento.

## Estado atual

O frontend usa React, React Router, TypeScript, Vite e Tailwind. O backend atual possui funções Vercel para consulta de lançamentos na IGDB.

Ainda não existem cliente Supabase, contexto de sessão, páginas de autenticação/listas/perfil ou persistência. `AppLayout` exibe um usuário demonstrativo fixo, `ReleaseCard` mantém “Quero jogar” apenas em estado local e `AddToListsModal` recebe opções demonstrativas de `features/lists/model/add-to-lists.ts`.

## Arquitetura

O fluxo aprovado separa autenticação, casos de uso de listas e apresentação:

```text
AppRouter
└── AuthProvider
    ├── páginas públicas
    │   ├── HomePage
    │   ├── ReleasesPage
    │   └── LoginPage
    ├── ProtectedRoute
    │   ├── MyListsPage
    │   ├── CreateListPage
    │   └── ProfilePage
    └── Supabase
        ├── Auth
        ├── profiles
        ├── lists
        ├── list_items
        ├── games
        └── funções SQL atômicas
```

O cliente Supabase será um singleton criado fora da árvore React. Os componentes não acessarão o SDK diretamente: autenticação e listas usarão módulos com interfaces pequenas, o que mantém regras de transformação e falha testáveis sem acoplar a apresentação ao transporte.

Variáveis públicas:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

A chave pública pode ser entregue ao navegador porque toda autorização será aplicada no PostgreSQL. Nenhuma `service_role` ou outra credencial administrativa será incluída em variável `VITE_*`.

Na ausência da configuração pública, as páginas públicas continuarão funcionais. A área de conta exibirá um erro de configuração sanitizado, sem derrubar a listagem de lançamentos.

## Autenticação

### Estado de sessão

`AuthProvider` inicializará a sessão existente, assinará mudanças de autenticação e exporá uma união discriminada:

```ts
type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'unavailable'; message: string };
```

O cabeçalho será derivado desse estado. O usuário demonstrativo será removido. Enquanto a sessão inicial estiver carregando, a aplicação não exibirá dados de outro usuário nem redirecionará prematuramente.

### Código por e-mail

1. O usuário informa e confirma o e-mail em `/entrar`.
2. O frontend solicita o OTP com `signInWithOtp`.
3. A página passa para uma etapa de seis dígitos, preservando apenas o e-mail necessário.
4. O código é validado com `verifyOtp`.
5. A sessão autenticada é observada pelo `AuthProvider` e o retorno pendente é executado.

As mensagens de solicitação serão genéricas para evitar enumeração de contas. A configuração do projeto Supabase deverá usar `{{ .Token }}` no template de e-mail para entregar o código em vez de depender de Magic Link.

### Google

`signInWithOAuth({ provider: 'google' })` iniciará o fluxo OAuth. A URL de retorno apontará para `/entrar`, que aguardará a sessão restaurada antes de executar o retorno pendente. URL local e URL de produção deverão constar na allowlist do Supabase e no cliente OAuth do Google.

Quando Google e OTP usam o mesmo e-mail verificado, a vinculação automática do Supabase mantém um único `auth.users.id`.

### Intenção pendente

Rotas protegidas registrarão apenas o caminho interno validado. Ações em cards registrarão uma intenção versionada e mínima em `sessionStorage` para sobreviver ao redirecionamento OAuth:

```ts
type PendingAuthIntent =
  | { version: 1; type: 'navigate'; returnTo: string }
  | { version: 1; type: 'open-add-to-lists'; returnTo: '/lancamentos'; igdbId: number }
  | { version: 1; type: 'toggle-want-to-play'; returnTo: '/lancamentos'; igdbId: number };
```

Somente caminhos internos conhecidos serão aceitos, evitando redirecionamento aberto. A intenção será consumida uma vez depois da sessão autenticada. Dados visuais do jogo serão recuperados da listagem carregada, em vez de armazenar objetos grandes ou confiáveis no navegador.

## Rotas e experiência

### `/entrar`

A página segue a identidade visual atual e possui:

- campo de e-mail com validação;
- botão para solicitar o código;
- etapa para informar seis dígitos;
- ação de reenviar código;
- botão “Continuar com Google”;
- estados de envio, validação, OAuth e erro em região anunciável;
- retorno manual para corrigir o e-mail.

Se já houver sessão, a rota executa a intenção pendente ou retorna para a origem pública apropriada.

### Proteção de rotas e ações

`ProtectedRoute` diferencia carregamento, ausência de sessão e sessão válida. Usuários anônimos são enviados a `/entrar`; usuários autenticados veem o conteúdo protegido.

Nas páginas públicas, clicar em “Quero jogar!” ou “Adicionar à lista” sem sessão registra a intenção e abre `/entrar`. Após o login:

- `open-add-to-lists` reabre o modal do jogo correspondente;
- `toggle-want-to-play` executa a inclusão do jogo na lista especial;
- navegação protegida abre a rota solicitada.

Se o jogo não estiver mais disponível na resposta corrente, a aplicação retorna a Lançamentos e informa que a ação precisa ser repetida.

### `/minhas-listas`

Exibe as listas do usuário com nome, descrição opcional, quantidade de jogos e até três capas recentes. Possui estados de carregamento, vazio, falha e nova tentativa. O estado vazio direciona para `/minhas-listas/nova`.

### `/minhas-listas/nova`

Formulário com nome obrigatório e descrição opcional. Espaços externos serão removidos; nomes vazios ou acima do limite serão rejeitados antes da chamada. Em sucesso, a página retorna para Minhas listas.

### `/perfil`

Exibe nome, e-mail, avatar ou iniciais, métodos de acesso disponíveis e ação de sair. Edição avançada fica fora do escopo.

## Modelo relacional

Todos os identificadores usam `snake_case`, textos usam `text` com constraints quando necessário e timestamps usam `timestamptz`.

### `profiles`

```text
id uuid primary key references auth.users(id) on delete cascade
display_name text
avatar_url text
created_at timestamptz not null
updated_at timestamptz not null
```

Um trigger `after insert` em `auth.users` cria o perfil usando metadata do provedor quando disponível. A migração também preenche perfis ausentes para usuários preexistentes.

### `games`

```text
id bigint generated always as identity primary key
igdb_id bigint not null unique
name text not null
cover_url text
release_date date
created_at timestamptz not null
```

Esta tabela guarda somente o snapshot necessário às listas. O catálogo e os filtros continuam vindo da IGDB. Usuários autenticados podem ler snapshots, mas não recebem grants diretos de escrita.

### `lists`

```text
id bigint generated always as identity primary key
user_id uuid not null references auth.users(id) on delete cascade
name text not null
description text
system_key text
created_at timestamptz not null
updated_at timestamptz not null
```

Regras:

- nome entre 1 e 80 caracteres após trim;
- descrição com limite definido no banco e na interface;
- `system_key` nulo para listas customizadas;
- o único valor de sistema deste incremento é `want_to_play`;
- índice único parcial em `(user_id, system_key)` quando `system_key is not null`;
- índice em `(user_id, created_at desc)` para listagem por proprietário.

### `list_items`

```text
list_id bigint references lists(id) on delete cascade
game_id bigint references games(id) on delete cascade
added_at timestamptz not null
primary key (list_id, game_id)
```

A chave composta impede duplicação na mesma lista. O jogo pode aparecer em listas diferentes. `game_id` terá um índice separado para joins e cascades, pois a chave primária composta começa por `list_id`.

## Operações atômicas

### Adicionar a várias listas

Uma função `security definer`, com `search_path` vazio e execução concedida apenas a `authenticated`, receberá o snapshot mínimo do jogo e os IDs das listas. Ela:

1. exige `auth.uid()` válido;
2. normaliza e valida os IDs recebidos;
3. confirma que todas as listas pertencem ao usuário;
4. insere o snapshot do jogo com `on conflict` atômico;
5. insere cada associação com `on conflict do nothing`;
6. retorna os IDs efetivamente associados.

Nenhuma associação parcial será confirmada se a validação falhar.

### Alternar “Quero jogar”

Outra função atômica localizará ou criará a lista com `system_key = 'want_to_play'`, salvará o snapshot do jogo e alternará a associação. A restrição única elimina corrida na criação da lista especial.

## RLS e privilégios

RLS será habilitado em todas as tabelas expostas.

- `profiles`: o usuário pode selecionar e atualizar apenas `id = (select auth.uid())`.
- `lists`: o usuário pode selecionar suas linhas; inserts customizados exigem `user_id = (select auth.uid())` e `system_key is null`; updates ficam limitados às colunas editáveis.
- `list_items`: acesso exige uma lista relacionada cujo `user_id = (select auth.uid())`.
- `games`: leitura para `authenticated`; escrita somente pelas funções aprovadas.

Colunas usadas em filtros, joins, chaves estrangeiras e políticas serão indexadas. Grants serão explícitos e mínimos. Funções `security definer` revogarão execução de `public` e `anon`, validarão propriedade antes de gravar e qualificarão todos os objetos com o schema.

RLS é a fronteira de segurança mesmo se o cliente for manipulado. Filtros no React melhoram a experiência, mas não substituem as políticas.

## Integração das listas

O modelo demonstrativo será substituído por um repositório assíncrono. O modal receberá estados explícitos de carregamento, sucesso, vazio, envio e erro.

Ao abrir:

1. a sessão é verificada;
2. as listas e associações atuais do jogo são carregadas em paralelo quando possível;
3. o usuário altera a seleção local;
4. confirmar chama a operação atômica;
5. o modal fecha somente após sucesso;
6. falha preserva a seleção e permite nova tentativa.

Capas do card de lista virão dos três itens mais recentes. Ausência de capa não criará URL fictícia.

“Quero jogar!” será derivado da associação persistida. O botão ficará desabilitado durante a mutação e mudará de aparência somente depois da confirmação. Uma falha mantém o estado anterior e exibe mensagem sanitizada.

## Erros e concorrência

- Erros do SDK e do PostgreSQL serão mapeados para uma taxonomia pequena: configuração, não autenticado, permissão, conflito, rede e inesperado.
- Mensagens internas, queries, tokens e respostas externas não serão exibidos nem registrados no navegador.
- Submissões duplicadas serão bloqueadas enquanto houver requisição em andamento.
- Constraints e `on conflict` tornam criação da lista especial e inclusão de itens idempotentes.
- Mudança ou encerramento de sessão limpará dados pessoais mantidos em memória.
- Efeitos assíncronos ignorarão respostas depois do unmount ou da troca de usuário.
- Logout removerá a intenção pendente e redirecionará para a página pública inicial.

## Acessibilidade

- Formulários terão labels visíveis, associação entre campo e mensagem e foco no primeiro erro.
- Estados assíncronos usarão `aria-live="polite"`; erros bloqueantes usarão `role="alert"`.
- O código OTP aceitará colagem e teclado numérico sem dividir o valor em controles inacessíveis.
- Controles em envio usarão `disabled` e rótulos claros.
- A proteção de rota manterá um estado de carregamento nomeado.
- O modal de listas conservará foco, Escape e retorno de foco já testados.

## Testes

A implementação seguirá ciclos RED/GREEN separados.

### Autenticação

- validação e normalização do e-mail;
- solicitação e confirmação do OTP;
- erro genérico e reenvio;
- início do OAuth Google com redirect permitido;
- restauração e mudança de sessão;
- proteção de rota nos estados loading, anonymous e authenticated;
- persistência, validação e consumo único da intenção pendente;
- prevenção de redirecionamento externo;
- logout e limpeza dos dados pessoais.

### Listas

- mapeamento das respostas do Supabase para modelos da interface;
- carregamento, vazio, falha e retry;
- criação com nome válido e rejeição de entrada inválida;
- seleção preservada durante paginação do modal;
- confirmação em várias listas;
- falha preserva seleção e mantém modal aberto;
- estado persistido de “Quero jogar” e falha sem atualização falsa;
- retomada das duas ações depois do login.

### Banco

- revisão da migração para constraints, índices, grants e RLS;
- funções rejeitam sessão ausente e IDs de listas de outro usuário;
- adição múltipla é atômica e idempotente;
- lista `want_to_play` é única por usuário;
- exclusão do usuário remove perfil, listas e associações por cascade.

Os testes SQL executáveis dependerão de uma instância Supabase local ou remota configurada; sem ela, a entrega incluirá a migração revisada e instruções explícitas para aplicá-la.

### Verificação do aplicativo

- suíte Vitest completa;
- TypeScript;
- ESLint e Prettier;
- build Vite;
- navegação pública sem variáveis Supabase;
- fluxo autenticado em ambiente configurado;
- inspeção visual e responsiva no Browser integrado quando o servidor local estiver disponível.

## Configuração operacional

A documentação do projeto explicará:

1. criar o projeto Supabase;
2. aplicar a migração;
3. configurar o template OTP com token de seis dígitos;
4. configurar SMTP apropriado para produção;
5. habilitar Google e registrar origens/redirects local e de produção;
6. definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` na máquina e na Vercel;
7. nunca expor `service_role`.

## Critérios de aceite

- Visitantes acessam Início e Lançamentos sem conta.
- Ações pessoais e rotas protegidas levam à página dedicada de login.
- OTP por e-mail e Google produzem uma sessão reconhecida pelo aplicativo.
- O retorno pós-login restaura a rota ou ação compatível.
- Cabeçalho e Perfil mostram a conta real; o usuário demonstrativo foi removido.
- Usuários criam várias listas customizadas e veem apenas seus próprios dados.
- Um jogo pode pertencer a várias listas, sem duplicação dentro da mesma lista.
- “Quero jogar!” persiste na lista especial única do usuário.
- Falhas preservam contexto suficiente para nova tentativa e não simulam sucesso.
- Policies RLS e privilégios impedem acesso entre usuários.
- Nenhum segredo administrativo chega ao bundle do frontend.
- Testes, typecheck, lint, formatação e build passam.

## Fora do escopo

- Senhas locais.
- Magic Link como interface principal.
- Exclusão e renomeação de listas.
- Listas públicas ou compartilhadas.
- Ordenação manual de jogos.
- Avaliações, notas e status adicionais por item.
- Edição avançada de perfil.
- Sincronização completa do catálogo IGDB para PostgreSQL.
- Painel administrativo.
