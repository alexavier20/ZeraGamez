# Paginação incremental de lançamentos

- **Data:** 2026-08-11
- **Status:** aprovado em conversa; aguardando revisão do documento
- **Escopo:** carregamento incremental da lista existente em `/lancamentos`

## Objetivo

Continuar carregando automaticamente os próximos períodos de lançamentos quando o
usuário se aproximar do fim da lista. Os novos resultados devem ser anexados aos cards
já exibidos, sem refazer requisições concluídas, perder a posição do scroll ou apagar
dados em caso de falha incremental.

## Decisões aprovadas

- Carregamento automático por `IntersectionObserver` ao se aproximar do rodapé.
- Janelas adaptativas de datas, com janela inicial máxima de 90 dias.
- Limite público de 100 jogos por consulta, dentro do contrato existente.
- Busca limitada aos dois anos seguintes à data inicial informada pela API.
- Janelas vazias são puladas automaticamente até o horizonte.
- Falhas incrementais preservam os jogos carregados e expõem retry no rodapé.
- A visualização Calendário pausa o observer e não dispara novas requisições.
- Filtros permanecem exclusivamente visuais nesta etapa.

## Contexto e limites da IGDB

A IGDB usa `limit` e `offset` para paginação e aceita no máximo 500 itens por
requisição. O endpoint local já consulta até 500 registros brutos, consolida jogos por
data e limita a resposta pública a no máximo 100 jogos. Fontes oficiais:

- [IGDB: Pagination](https://api-docs.igdb.com/#pagination)
- [IGDB: Offset](https://api-docs.igdb.com/#offset)

Esta entrega não adiciona offset público nem estado persistente no servidor. Em vez
disso, reduz adaptativamente o intervalo civil quando uma resposta pode estar truncada.
Isso preserva a API atual e evita perda silenciosa nos períodos que podem ser divididos.

## Arquitetura

```text
ReleasesPage
├── useReleases
│   ├── release-window-planner (puro)
│   ├── ReleasesClient (injeção de dependência)
│   ├── fila cronológica de janelas
│   └── acumulador imutável de DTOs
├── ReleaseList
└── ReleaseLoadMore
    ├── IntersectionObserver
    ├── loading incremental
    ├── erro e retry
    └── fallback manual / conclusão
```

### `release-window-planner`

Responsabilidade única: criar, dividir e avançar janelas civis sem conhecer React,
HTTP ou componentes.

Constantes de produto:

- `WINDOW_DAYS = 90`;
- `HORIZON_DAYS = 730`;
- `PAGE_LIMIT = 100`.

O planejador opera exclusivamente com datas civis `YYYY-MM-DD` em UTC. A data inicial
vem de `meta.from` da primeira resposta, que já é calculada pelo servidor em
`America/Sao_Paulo`. Assim, o navegador não recalcula "hoje" em outro fuso.

Operações esperadas:

- criar a primeira janela conhecida a partir de `meta.from` e `meta.to`;
- criar a próxima janela em `meta.to + 1 dia`;
- limitar o fim da janela ao horizonte inclusivo;
- dividir uma janela no ponto médio, retornando metade esquerda e direita em ordem;
- reconhecer uma janela de um único dia;
- reconhecer que o horizonte foi atingido.

### Hook `useReleases`

O hook atual será evoluído, sem criar uma segunda fonte de verdade para os mesmos
dados. A dependência de carregamento passa a receber a consulta da janela e o
`AbortSignal`:

```ts
load(query: ReleasesClientQuery, signal: AbortSignal): Promise<ReleasesResponse>
```

O resultado do hook preservará `state` e `retry` para a primeira carga e acrescentará:

```ts
pagination: 'idle' | 'loading' | 'error' | 'complete'
loadMore(): void
retryMore(): void
```

O callback `loadMore` será estável. Um guard single-flight impede duas chamadas
simultâneas causadas por Strict Mode, eventos repetidos do observer ou cliques rápidos.

### `ReleaseLoadMore`

Componente de rodapé responsável somente por observar o sentinel e apresentar o estado
incremental. Não agrupa jogos e não conhece o cliente HTTP.

O observer usará uma margem antecipada de `600px 0px`, permitindo iniciar a próxima
consulta antes que o último card alcance a borda visível. Ele será recriado quando uma
página terminar, garantindo que listas curtas continuem carregando enquanto o sentinel
permanecer visível.

## Algoritmo de carregamento

1. A primeira chamada usa `limit=100` e deixa o servidor definir `from` e `to` padrão.
2. A resposta define a data inicial, o primeiro intervalo real e o horizonte de 730 dias.
3. Uma resposta é considerada potencialmente incompleta quando
   `meta.count >= meta.limit` ou `meta.sourceTruncated` for verdadeiro.
4. Se uma janela incompleta possuir mais de um dia:
   - os dados dessa resposta não são anexados;
   - a janela é dividida ao meio;
   - as metades entram na fila em ordem cronológica;
   - a metade esquerda é carregada primeiro.
5. Se uma janela completa possuir dados, os itens são anexados e a próxima janela
   cronológica é preparada.
6. Se uma janela completa estiver vazia, o hook continua automaticamente para a
   próxima janela, sem exigir novo scroll.
7. Se uma janela de um dia continuar incompleta, a paginação entra em erro explícito.
   Ela nunca avança silenciosamente sobre resultados possivelmente omitidos.
8. Ao ultrapassar o horizonte, o estado passa para `complete`.

As requisições são sempre sequenciais. A fila nunca inicia mais de uma chamada ao mesmo
tempo.

## Acumulação e metadados

- A coleção agregada é imutável e permanece cronológica.
- A chave defensiva de deduplicação é `game id + releaseDate`.
- O primeiro DTO para uma chave prevalece; janelas planejadas não devem se sobrepor.
- `meta.generatedAt` da primeira resposta completa permanece estável durante a sessão,
  evitando mudança de rótulos relativos durante o scroll.
- `meta.from` permanece a data inicial.
- `meta.to` avança até a última janela concluída.
- `meta.count` representa o total deduplicado exibido.
- Respostas incompletas nunca entram no acumulador.

## Estados e experiência

### Primeira carga

Os estados existentes continuam válidos:

- loading: skeleton atual;
- error: tela atual com retry integral;
- empty: exibido somente se nenhum jogo for encontrado até o horizonte de dois anos;
- success: lista acumulada.

Enquanto o hook atravessa janelas vazias antes do primeiro resultado, a página permanece
em loading.

### Carga incremental

- `idle`: sentinel ativo, sem mensagem visual;
- `loading`: `Carregando mais lançamentos…` com `role="status"` e
  `aria-live="polite"`;
- `error`: mensagem curta e botão `Tentar novamente`, preservando todos os cards;
- `complete`: `Todos os lançamentos disponíveis foram carregados`.

O retry incremental repete exatamente a janela pendente. Ele não limpa a fila, não
refaz páginas anteriores e não perde a posição do scroll.

Se `IntersectionObserver` não existir, o rodapé apresenta o botão acessível `Carregar
mais lançamentos`. O comportamento automático é a experiência principal; o botão é
somente fallback progressivo.

### Lista e Calendário

- O observer funciona somente quando `view === 'list'`.
- Trocar para Calendário não cancela dados concluídos, não reinicia o hook e não dispara
  nova página.
- Voltar para Lista restaura os mesmos itens e reativa o observer.
- Uma requisição já iniciada pode terminar normalmente durante a troca de visualização;
  apenas novos gatilhos ficam pausados.

## Concorrência, cancelamento e logs

- Cada chamada possui um `AbortController` próprio.
- Desmontar o hook aborta a chamada ativa e ignora settlements tardios.
- Retry inicial substitui toda a sessão e aborta a chamada ativa.
- Retry incremental reutiliza a janela que falhou.
- Eventos repetidos são idempotentes enquanto houver uma chamada ativa.
- Erros são normalizados para status e código públicos.
- Logs não incluem resposta bruta da IGDB, tokens, segredos ou mensagens internas.

## Testes

### Unidade

- aritmética de datas civis e horizonte inclusivo;
- avanço entre janelas sem lacunas ou sobreposição;
- divisão cronológica de períodos pares e ímpares;
- detecção de saturação e janela de um dia;
- deduplicação e ordenação imutáveis.

### Hook

- primeira resposta completa;
- divisão de resposta saturada sem anexar o pai;
- travessia automática de janelas vazias;
- append e metadados acumulados;
- conclusão em dois anos;
- erro incremental preservando dados;
- retry da mesma janela;
- single-flight sob eventos repetidos;
- cancelamento e settlements tardios;
- Strict Mode sem duplicar requisições.

### Componentes e integração

- observer dispara `loadMore` apenas na Lista;
- observer é desconectado no Calendário;
- fallback manual sem `IntersectionObserver`;
- loading, erro, retry e conclusão acessíveis;
- cards anteriores permanecem no DOM durante loading/erro incremental;
- Lista → Calendário → Lista preserva dados e contagem de chamadas;
- nenhuma duplicação de cards ao anexar lotes.

### Gates

- testes focados e suíte completa;
- lint e Prettier;
- typecheck cliente e servidor;
- build de produção;
- `git diff --check`;
- QA no Browser em 1440, 1024, 768 e 390px, incluindo scroll, loading incremental,
  retry, conclusão, console e ausência de overflow.

## Fora de escopo

- tornar os filtros funcionais;
- implementar o calendário;
- virtualizar ou remover cards antigos;
- alterar autenticação Twitch/IGDB;
- adicionar banco, cache de aplicação ou cursor persistente;
- habilitar as ações visuais dos cards;
- alterar o layout aprovado dos cards.

## Critérios de aceite

1. Aproximar-se do fim da Lista carrega automaticamente o próximo período.
2. Jogos carregados permanecem visíveis durante chamadas e erros adicionais.
3. Apenas uma requisição incremental ocorre por vez.
4. Nenhuma janela saturada com mais de um dia é avançada sem subdivisão.
5. Janelas vazias são puladas automaticamente até o horizonte de dois anos.
6. Falha incremental oferece retry da mesma janela.
7. Calendário não inicia novas páginas e voltar para Lista preserva os dados.
8. A API pública, os filtros visuais e a geometria dos cards permanecem compatíveis.
