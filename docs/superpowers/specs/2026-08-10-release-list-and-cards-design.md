# Listagem e Cards de Lançamentos — Design

## Objetivo

Transformar os dados validados de `GET /api/releases` em uma listagem visual na rota `/lancamentos`, seguindo as referências desktop, tablet e mobile do Pen. A página deve exibir todos os itens retornados, agrupados por data, sem duplicar a chamada HTTP e sem ampliar o escopo para filtros ou listas persistentes.

## Referências aprovadas

- `FlHYJ`: Tela 1 / Lançamentos / Desktop.
- `LSXHf`: Responsivo / Lançamentos / Tablet 768.
- `XXde3`: Responsivo / Lançamentos / Mobile 390.
- `htPgz`: Component / Game Card.
- `a1hYC`: grade de estados de carregamento, vazio e erro.

O desktop e o tablet usam cards verticais em grade. O mobile usa cards compactos horizontais. Cores, tipografia, bordas e espaçamentos reutilizam os tokens que já existem em `src/styles/global.css`.

## Relação com decisões anteriores

Esta especificação sucede a etapa “somente console” definida em `2026-08-07-igdb-releases-integration-design.md`. Ela substitui exclusivamente aquela limitação de apresentação: endpoint, autenticação, consolidação, cache, erros e contrato público permanecem inalterados.

## Escopo

### Incluído

- Consumir a consulta padrão já implementada em `fetchReleases`.
- Expor estado tipado de carregamento no frontend.
- Exibir todos os resultados retornados, até o limite do endpoint.
- Agrupar os jogos por `releaseDate` em ordem cronológica.
- Renderizar cards responsivos com capa, nome, data, plataformas e gênero.
- Exibir estados de carregamento, vazio, erro e calendário indisponível.
- Manter os logs seguros de sucesso e falha para inspeção.
- Permitir nova tentativa depois de uma falha.

### Fora do escopo

- Persistência ou abertura de listas.
- Favoritar jogos e abrir o menu de mais opções.
- Filtros, busca ou paginação funcionais.
- Visualização de calendário real.
- Navegação para detalhes do jogo.
- Alterações no endpoint ou no contrato público.

## Arquitetura

O fluxo aprovado mantém a fronteira HTTP separada da apresentação:

```text
ReleasesPage
├── ReleaseViewSwitcher
├── ReleaseFilters
└── useReleases
    └── fetchReleases
        └── GET /api/releases
```

`useReleases` substituirá o hook que somente registra a resposta no console. Ele dependerá de uma função `load` e de um `logger` injetáveis em testes e retornará uma união discriminada:

```ts
type ReleasesState =
  | { status: 'loading' }
  | { status: 'success'; response: ReleasesResponse }
  | { status: 'empty'; response: ReleasesResponse }
  | { status: 'error'; error: { status: number; code: ApiErrorCode } };
```

O hook também fornecerá uma função estável `retry`. Cada tentativa criará seu próprio `AbortController`; desmontagem ou nova tentativa cancelará a operação anterior. Sucesso e falha continuarão sendo registrados uma vez, sem criar uma segunda chamada exclusiva para logging.

## Componentes

### `ReleaseList`

Recebe `ReleasesResponse`, agrupa todos os itens por data e cria um `ReleaseDateGroup` para cada grupo. Não conhece `fetch`, estados assíncronos nem a página.

### `ReleaseDateGroup`

Recebe uma data civil, o dia de referência e os jogos daquele dia. Produz o cabeçalho responsivo e a grade:

- desktop: quatro colunas;
- tablet: duas colunas;
- mobile: uma coluna de linhas compactas.

### `ReleaseCard`

Funciona como fachada sobre duas apresentações puras do mesmo DTO:

- `ReleaseCardDesktop`: capa com altura fixa de 244px e largura fluida (a referência Pencil parte de 220 × 244 e produz cards de aproximadamente 407px), status sobre a imagem, favorito visual, título, data, chips de plataforma, primeiro gênero, botão de lista e menu visual;
- `ReleaseCardMobile`: capa estreita à esquerda, informações à direita, status e plataformas na mesma linha e botão compacto.

A duplicação limitada de marcação é intencional porque os dois layouts têm hierarquias visuais diferentes no Pen. Formatação e dados permanecem compartilhados.

Os controles sem comportamento serão semanticamente desabilitados e manterão a aparência da referência. Nenhum `onClick` vazio será criado.

### Estados da listagem

- `ReleasesLoading`: skeletons sem conteúdo fictício.
- `ReleasesEmpty`: “Nenhum jogo encontrado”.
- `ReleasesError`: mensagem sanitizada e botão funcional “Tentar novamente”.
- `ReleaseCalendarPlaceholder`: “Visualização em breve”, sem nova chamada HTTP.

## Datas e agrupamento

`releaseDate` é uma data civil `YYYY-MM-DD` e não deve ser interpretada no fuso local do navegador. A camada visual formatará a data em português usando UTC para preservar o dia civil.

O dia de referência será derivado de `meta.generatedAt` no fuso `America/Sao_Paulo`. Com isso:

- mesma data: “Hoje”;
- dia seguinte: “Amanhã”;
- demais datas: dia e mês completos.

O rótulo desktop separa o destaque relativo da data. No mobile, o texto é compacto e em caixa alta, conforme o Pen. Os grupos e jogos preservam a ordenação determinística fornecida pelo contrato; o agrupador não modifica a entrada.

## Regras de apresentação

- `coverUrl` usa imagem responsiva, `loading="lazy"` e texto alternativo com o nome do jogo.
- `coverUrl: null` usa um placeholder visual com ícone, sem imagem fictícia.
- Chips usam `abbreviation` quando presente e `name` como fallback.
- Desktop mostra no máximo duas plataformas e resume o excedente como `+N`.
- Mobile resume as plataformas em uma linha textual curta.
- O primeiro gênero é exibido; ausência de gênero não cria rótulo vazio.
- Títulos e metadados longos usam truncamento sem alterar o valor acessível.
- Cards fora da primeira região visível usam `content-visibility` quando isso não prejudicar a medição responsiva.

## Fluxo da página

1. A rota monta com estado `loading`.
2. O hook executa uma única chamada para `/api/releases`.
3. Resposta com itens produz a listagem agrupada.
4. Resposta sem itens produz o estado vazio.
5. Falha produz o estado de erro; `retry` inicia uma nova tentativa e retorna ao loading.
6. Selecionar Calendário troca apenas a região de conteúdo pelo placeholder.
7. Retornar para Lista reutiliza os dados já carregados, sem nova chamada.

Filtros permanecem visuais e não alteram a consulta nesta etapa.

## Acessibilidade

- Cada grupo é uma `section` nomeada por seu cabeçalho.
- A coleção usa semântica de lista e cada card usa semântica de artigo/list item.
- Imagens possuem `alt` descritivo; ícones decorativos ficam ocultos da árvore acessível.
- Estados de carregamento e erro usam região com `aria-live="polite"` sem anunciar skeletons individualmente.
- Controles visuais indisponíveis usam `disabled` e rótulo acessível.
- O botão de retry possui foco visível e nome claro.
- A alternância Lista/Calendário mantém `aria-pressed` e associa a região exibida ao modo ativo.

## Testes

A implementação seguirá ciclos RED/GREEN separados.

### Utilitários

- agrupamento por data sem mutar a entrada;
- ordenação cronológica;
- rótulos Hoje, Amanhã e data comum;
- abreviação, fallback e resumo de plataformas.

### Hook

- estado inicial loading;
- sucesso e vazio;
- erro normalizado;
- retry e cancelamento da tentativa anterior;
- cancelamento no unmount;
- um único log por resultado;
- nenhuma chamada duplicada em Strict Mode.

### Componentes e página

- dados do contrato aparecem nos cards;
- fallback de capa e ausência de gênero;
- todos os itens aparecem no grupo correto;
- controles visuais estão desabilitados;
- loading, vazio, erro e retry;
- Calendário mostra o placeholder e Lista restaura os mesmos dados sem nova chamada.

### Verificação visual

Usar o Browser integrado contra o servidor Vercel local e comparar com os frames do Pen em desktop, tablet e mobile. Verificar identidade da página, DOM não vazio, ausência de overlay, console sem erros, screenshot, overflow e as interações Lista/Calendário e retry.

## Critérios de aceite

- A rota exibe dados reais em cards coerentes com o Pen.
- Todos os resultados retornados aparecem uma vez e no grupo correto.
- Desktop, tablet e mobile seguem suas respectivas composições.
- Loading, vazio, erro e calendário indisponível possuem estados visuais claros.
- A chamada HTTP ocorre uma única vez por tentativa.
- Retornar do Calendário para Lista não refaz a consulta.
- Ações de card, filtros e busca não executam comportamento ainda não aprovado.
- Nenhum token, segredo ou corpo externo bruto alcança o cliente ou o console.
- Testes, lint, formatação, TypeScript, build e QA visual passam.
