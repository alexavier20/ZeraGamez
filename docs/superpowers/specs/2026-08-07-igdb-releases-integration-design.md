# Integração de Lançamentos da IGDB — Design

## Objetivo

Criar a infraestrutura segura e desacoplada para consultar lançamentos de jogos da IGDB, expor um contrato estável por uma Vercel Function e consumir esse contrato na página `/lancamentos`. Nesta etapa, o resultado será exibido somente no console do navegador para validação; cards, agrupamentos visuais e interações dos filtros permanecem fora do escopo.

## Contexto

O projeto atual é uma SPA React/Vite sem backend. A IGDB exige `Client-ID` e token OAuth, não aceita chamadas diretas de JavaScript no navegador por CORS e limita o consumo a quatro requisições por segundo, com no máximo oito requisições abertas. Por isso, a integração precisa de uma camada server-side que proteja credenciais, controle a consulta e reduza chamadas repetidas.

Fontes oficiais consultadas:

- [IGDB API](https://api-docs.igdb.com/)
- [OAuth Client Credentials da Twitch](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth)
- [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Node.js Runtime para Vercel Functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Cache-Control na Vercel](https://vercel.com/docs/caching/cache-control-headers)

## Decisões aprovadas

- Usar uma Vercel Function nativa em TypeScript dentro de `api/`.
- Consultar lançamentos entre hoje e os 90 dias seguintes por padrão.
- Considerar datas do Brasil e datas mundiais, priorizando o Brasil por jogo e plataforma.
- Representar cada jogo uma única vez na sua data futura relevante mais próxima.
- Reunir no mesmo item as plataformas que compartilham essa data.
- Preparar o endpoint para filtros futuros de período, plataforma e gênero.
- Exibir a resposta somente no console do navegador nesta etapa.
- Não expor credenciais, tokens ou consultas Apicalypse arbitrárias ao frontend.

## Arquitetura

A integração será organizada pelos limites da funcionalidade:

```text
api/
└── releases.ts

server/releases/
├── domain/
│   └── release.ts
├── application/
│   └── list-upcoming-releases.ts
└── infrastructure/
    ├── env.ts
    ├── twitch-token-provider.ts
    └── igdb-release-repository.ts

shared/contracts/
└── releases.ts

src/features/releases/
├── api/
│   └── releases-client.ts
└── hooks/
    └── use-releases-console.ts
```

### Função HTTP e composition root

`api/releases.ts` será o ponto de composição. Ele aceitará a requisição HTTP, validará o método e os parâmetros, criará as dependências concretas e chamará o caso de uso. O arquivo não conterá regras de seleção de lançamentos nem conhecimento detalhado da resposta da IGDB.

### Aplicação e domínio

O caso de uso `listUpcomingReleases` dependerá de interfaces pequenas:

- `ReleaseRepository`: obtém candidatos a lançamento dentro de um período e filtros;
- `Clock`: fornece o instante atual para que datas sejam determinísticas em testes.

A regra de seleção e consolidação ficará no domínio e trabalhará com valores já validados. Ela não dependerá de Vercel, OAuth, `fetch`, Zod ou da estrutura bruta da IGDB.

### Infraestrutura

`TwitchTokenProvider` obterá e armazenará temporariamente o app access token. `IgdbReleaseRepository` construirá a consulta fixa, chamará a IGDB, validará a resposta externa e a converterá para os valores aceitos pelo domínio. Ambos receberão `fetch` e demais dependências por injeção, permitindo testes sem rede.

### Contrato compartilhado e frontend

`shared/contracts/releases.ts` definirá e validará o DTO público. O servidor produzirá esse contrato e o cliente React o validará novamente na fronteira HTTP.

`releases-client.ts` conhecerá somente `/api/releases`. `use-releases-console.ts` fará a chamada quando `/lancamentos` estiver montada, propagará um `AbortSignal` e registrará o DTO validado. Os componentes visuais existentes não receberão dados nem serão alterados para renderizar jogos nesta etapa.

### TypeScript e lint

Um `tsconfig.server.json` estrito incluirá `api/`, `server/` e `shared/` e será referenciado pelo `tsconfig.json` raiz. Imports server-side usarão caminhos relativos compatíveis com o empacotamento da Vercel. O ESLint terá contexto Node para esses diretórios sem enfraquecer as regras aplicadas ao frontend.

## Endpoint público

### Requisição

```http
GET /api/releases
```

Parâmetros opcionais:

- `from=YYYY-MM-DD`: início inclusivo; padrão é a data atual em `America/Sao_Paulo`;
- `to=YYYY-MM-DD`: fim inclusivo; padrão é 90 dias após `from`;
- `limit`: quantidade máxima de jogos consolidados; padrão `50`, máximo `100`;
- `platforms`: lista separada por vírgulas de IDs inteiros positivos;
- `genres`: lista separada por vírgulas de IDs inteiros positivos.

O período máximo será de 366 dias, `to` não poderá ser anterior a `from`, listas não aceitarão valores vazios ou repetidos e parâmetros desconhecidos serão rejeitados. Valores inválidos produzirão `400 INVALID_QUERY` antes de qualquer chamada externa.

### Resposta de sucesso

```ts
interface ReleasesResponse {
  data: Array<{
    id: number;
    slug: string;
    name: string;
    coverUrl: string | null;
    releaseDate: string;
    platforms: Array<{
      id: number;
      name: string;
      abbreviation: string | null;
    }>;
    genres: Array<{
      id: number;
      name: string;
    }>;
  }>;
  meta: {
    from: string;
    to: string;
    count: number;
    limit: number;
    generatedAt: string;
    sourceTruncated: boolean;
  };
}
```

`releaseDate`, `from` e `to` usam datas civis ISO `YYYY-MM-DD`. `generatedAt` usa um instante ISO 8601 completo. O DTO não inclui textos de apresentação como “Lança hoje” ou “Em 1 dia”; essa localização pertencerá à camada visual futura.

### Resposta de erro

```ts
interface ApiErrorResponse {
  error: {
    code:
      | 'INVALID_QUERY'
      | 'METHOD_NOT_ALLOWED'
      | 'INVALID_UPSTREAM_RESPONSE'
      | 'SERVICE_UNAVAILABLE'
      | 'UPSTREAM_TIMEOUT'
      | 'INTERNAL_ERROR';
    message: string;
  };
}
```

As mensagens serão estáveis e sanitizadas. Detalhes internos, cabeçalhos, tokens, segredos e corpos das chamadas de autenticação nunca farão parte da resposta.

## Consulta e consolidação da IGDB

O repositório consultará `release_dates` e solicitará somente os campos necessários:

- data e formato da data;
- região do lançamento;
- jogo: ID, nome, slug, capa e gêneros;
- plataforma: ID, nome e abreviação.

A consulta aplicará no servidor:

- intervalo inclusivo solicitado;
- somente datas completas compatíveis com agrupamento diário;
- regiões Brasil (`10`) e mundial (`8`);
- filtros opcionais de plataforma e gênero;
- ordenação crescente por data;
- limite bruto máximo de 500 registros, conforme a IGDB.

A consolidação seguirá esta ordem:

1. Rejeitar registros sem jogo, plataforma ou data completa.
2. Para cada combinação jogo/plataforma, selecionar a primeira data brasileira disponível no intervalo; se não houver, selecionar a primeira data mundial.
3. Para cada jogo, encontrar a menor data entre as plataformas selecionadas.
4. Preservar somente as plataformas cuja data selecionada coincide com a data escolhida para o jogo.
5. Remover duplicações de plataformas e gêneros por ID.
6. Ordenar plataformas e gêneros por nome para uma resposta determinística.
7. Ordenar jogos por data e, em caso de empate, por nome.
8. Aplicar o limite público somente após a consolidação.

Se a IGDB devolver 500 registros brutos, `sourceTruncated` será `true`, pois podem existir mais registros na origem. Caso contrário, será `false`.

A URL de capa será construída no servidor com HTTPS e um tamanho adequado ao card futuro. Quando não houver `image_id`, `coverUrl` será `null`.

## Autenticação e segurança

As variáveis exigidas serão:

```text
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
```

Elas serão documentadas sem valores em `.env.example`, configuradas como variáveis sensíveis na Vercel e armazenadas localmente apenas em um arquivo ignorado pelo Git. Nenhuma variável usará o prefixo `VITE_`.

O token será solicitado a `https://id.twitch.tv/oauth2/token` com corpo `application/x-www-form-urlencoded` e `grant_type=client_credentials`. O provider armazenará token e expiração no escopo do módulo, considerando-o vencido 60 segundos antes do prazo informado. Uma Promise compartilhada evitará renovações simultâneas numa mesma instância aquecida.

As chamadas à IGDB incluirão somente os cabeçalhos server-side `Client-ID`, `Authorization: Bearer ...`, `Accept: application/json` e o corpo Apicalypse controlado. O cliente não poderá fornecer fragmentos desse corpo. Não serão adicionados cabeçalhos CORS porque o consumo é same-origin.

Em uma resposta `401` da IGDB, o token será invalidado e a operação completa poderá ser repetida uma única vez. Não haverá repetição automática para outros erros, evitando ampliar carga e esconder falhas persistentes.

## Timeouts, cache e erros

- OAuth terá timeout de 5 segundos.
- A chamada de dados da IGDB terá timeout de 10 segundos.
- Somente respostas `200` serão armazenadas.
- Respostas de erro terão `Cache-Control: no-store`.

Respostas de sucesso usarão:

```http
Cache-Control: public, max-age=0, must-revalidate
Vercel-CDN-Cache-Control: public, max-age=900, stale-while-revalidate=3600
```

Assim, o navegador revalida, enquanto a CDN da Vercel reutiliza a resposta por 15 minutos e pode servir a versão anterior durante atualização assíncrona por até uma hora. A URL completa, incluindo filtros, participa da chave de cache.

Mapeamento HTTP:

- `400 INVALID_QUERY`: parâmetro público inválido;
- `405 METHOD_NOT_ALLOWED`: método diferente de `GET`, acompanhado de `Allow: GET`;
- `502 INVALID_UPSTREAM_RESPONSE`: payload externo incompatível com o contrato esperado;
- `503 SERVICE_UNAVAILABLE`: credenciais ausentes, autenticação indisponível, limite externo ou falha externa transitória;
- `504 UPSTREAM_TIMEOUT`: OAuth ou IGDB excedeu o timeout;
- `500 INTERNAL_ERROR`: falha inesperada não classificada.

Logs server-side poderão conter código da operação, status externo e duração, mas nunca valores de credenciais, tokens, cabeçalhos de autorização ou corpo OAuth.

## Desenvolvimento local e dependências

`zod` será uma dependência direta para validar variáveis, parâmetros, respostas externas e o DTO público.

A CLI da Vercel será uma dependência de desenvolvimento fixada pelo lockfile. O script `npm run dev:vercel` iniciará a aplicação e a função no mesmo endereço. `npm run dev` continuará iniciando somente o Vite para tarefas visuais que não dependam de funções.

O desenvolvimento local usará `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` em `.env.local` ou nas variáveis de Development baixadas pela CLI da Vercel. O arquivo permanecerá ignorado pelo Git.

## Comportamento temporário no navegador

Ao entrar em `/lancamentos`, o hook solicitará a consulta padrão e, após validar o DTO, registrará:

```text
[releases] Próximos lançamentos
{ data: [...], meta: {...} }
```

Falhas serão registradas com status e código normalizados, sem corpo externo bruto. A chamada será cancelada na desmontagem. O fluxo impedirá que o ciclo adicional de efeitos do React Strict Mode gere uma segunda saída bem-sucedida no console.

## Estratégia de testes

A implementação seguirá ciclos TDD.

### Domínio

- prioridade brasileira por jogo/plataforma;
- fallback mundial;
- consolidação de plataformas na mesma data;
- descarte de lançamentos posteriores do mesmo jogo;
- deduplicação e ordenação determinística;
- aplicação do limite após consolidação;
- imutabilidade da entrada.

### OAuth e IGDB

- formulário OAuth correto e segredo ausente da URL;
- reutilização e renovação antecipada do token;
- compartilhamento de renovação simultânea;
- invalidação e única repetição após `401`;
- consulta Apicalypse fixa e corretamente filtrada;
- validação da resposta externa;
- mapeamento de timeout, `429`, autenticação e payload inválido.

### Função HTTP

- método permitido;
- defaults de período e limite;
- validação de todos os parâmetros;
- resposta de sucesso e contrato de erro;
- cabeçalhos de cache para sucesso e `no-store` para erro;
- ausência de dados sensíveis nas respostas.

### Frontend

- construção da URL;
- validação do DTO;
- propagação de `AbortSignal`;
- normalização de erros;
- um único log bem-sucedido ao entrar em `/lancamentos`;
- cancelamento ao sair da página;
- nenhuma rede real durante testes automatizados.

Chamadas reais não farão parte da suíte automatizada porque dependem de credenciais e dados externos mutáveis. O smoke test manual usará `npm run dev:vercel` e verificará a resposta no console do navegador.

## Verificação

Antes da entrega serão executados:

1. testes focados durante cada ciclo TDD;
2. `npm run lint`;
3. `npm run format:check`;
4. `npm run typecheck`;
5. `npm run test:run`;
6. `npm run build`;
7. teste manual da rota e do console quando credenciais locais estiverem disponíveis.

## Critérios de aceite

- Credenciais e token permanecem exclusivamente no servidor.
- `GET /api/releases` aplica defaults e filtros aprovados.
- A integração usa campos atuais da IGDB e não usa campos documentados como obsoletos.
- A resposta externa é validada antes de alcançar o domínio.
- Jogos são consolidados conforme prioridade Brasil/mundial, data e plataformas aprovadas.
- O frontend depende somente do contrato próprio e registra uma resposta validada no console.
- Nenhum card, lista visual, calendário funcional ou filtro interativo é criado nesta etapa.
- Timeouts, cache, erros e logs seguem as regras desta especificação.
- Testes automatizados não dependem da rede nem de segredos.
- Lint, formatação, TypeScript, testes e build passam.
- A modificação local pré-existente em `package-lock.json` é preservada e não faz parte do commit desta especificação.
