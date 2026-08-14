# Calendário de busca de lançamentos por data

**Data:** 2026-08-14

## Contexto

A página de lançamentos já possui um alternador desktop entre `Lista` e
`Calendário`, mas o segundo modo exibe apenas um placeholder. A API já aceita
`from` e `to` como datas civis no formato `YYYY-MM-DD`, e os filtros de
plataforma e gênero já são enviados ao servidor.

As referências visuais aprovadas são os frames selecionados no Pen:

- `cO7zp` — `Protótipo / Calendário Aberto / Desktop`;
- `d0K2j` — `Protótipo / Filtrado por 29 jul 2026 / Desktop`;
- `Gc9Cn` — `Protótipo / Sem lançamentos em 31 jul 2026 / Desktop`;
- componente reutilizável `UV3Qw` — `Component / Date Picker / Desktop`.

## Objetivo

Transformar o modo Calendário em uma busca funcional por uma data exata,
preservando o layout, os textos, a densidade e os estados selecionados no Pen.
A data deve combinar com os filtros atuais de plataforma e gênero e consultar o
servidor, evitando resultados incompletos limitados ao que já foi carregado no
navegador.

## Escopo

- O calendário e o alternador continuam exclusivos do breakpoint desktop
  (`lg`), conforme os frames aprovados e o comportamento atual.
- Tablet e celular permanecem na visualização de lista atual.
- A busca usa uma única data civil, não um intervalo escolhido pelo usuário.
- A API e o repositório server-side não mudam; o contrato existente de `from` e
  `to` já cobre a consulta exata.
- Não será adicionada uma biblioteca de calendário ou datas.
- A seleção não será persistida na URL nem no armazenamento do navegador.

## Abordagem escolhida

Ao selecionar um dia, o cliente envia `from` e `to` com o mesmo valor
`YYYY-MM-DD`, junto aos IDs ativos de plataforma e gênero. Essa abordagem foi
escolhida porque retorna o conjunto completo fornecido pela origem para aquela
data.

O filtro apenas no cliente foi rejeitado porque a paginação progressiva pode
ainda não ter carregado jogos da data escolhida. Uma solução híbrida, com
resultado local imediato seguido de consulta remota, foi rejeitada por criar
dois estados transitórios, risco de contagens divergentes e complexidade sem
benefício necessário para este fluxo.

## Fluxo de interação

### Abrir e fechar

- A página inicia em `Lista`, sem data selecionada.
- Clicar em `Calendário` abre o popover ancorado abaixo do alternador e mantém a
  lista atual visível ao fundo.
- Enquanto o popover estiver aberto, Calendário aparece como a opção ativa.
- Clicar novamente em Calendário, pressionar `Escape` ou clicar fora fecha o
  popover sem alterar os resultados.
- Quando não há data selecionada, o calendário abre no mês atual em
  `America/Sao_Paulo`.
- Quando já há data selecionada, ele reabre no mês dessa data.

### Navegar e selecionar

- Os botões de seta mudam um mês por vez.
- A grade começa na segunda-feira, tem sete colunas e sempre mostra seis
  semanas, incluindo dias adjacentes com aparência atenuada.
- Selecionar um dia fecha o popover, marca o modo Calendário como ativo e inicia
  uma nova sessão de consulta para a data exata.
- O rótulo `Calendário` muda para a data curta, por exemplo
  `29 jul. 2026`.
- Abrir o calendário novamente permite substituir a data sem antes limpar o
  filtro atual.
- Clicar em `Lista` remove apenas a data, fecha o popover e restaura a consulta
  ampla, mantendo plataforma e gênero.

### Limpar

- `Limpar data`, no estado vazio, remove somente a data escolhida e preserva
  plataforma e gênero.
- `Limpar filtros`, na barra de filtros, remove plataforma, gênero e data em uma
  única ação e retorna ao modo Lista.
- A ação `Limpar filtros` considera a data um filtro ativo, portanto permanece
  habilitada quando apenas a data estiver selecionada.

## Fidelidade visual

### Alternador

- O contêiner preserva 40 px de altura, fundo secundário, raio de 12 px,
  padding de 4 px e gap de 4 px.
- Cada opção preserva 32 px de altura, raio de 9 px, padding horizontal de
  11 px, gap interno de 7 px, ícone Lucide de 15 px e texto Chakra Petch de
  12 px com peso 600.
- Calendário aberto ou com data selecionada usa `surface-hover`, texto principal
  e anel vermelho. Lista fica transparente e atenuada.
- A largura do contêiner acompanha o texto da data, como nos frames aprovados.

### Popover

- O popover mede 320 × 344 px e fica 4 px abaixo do alternador, alinhado à
  direita.
- Usa fundo `surface`, borda `border`, raio de 14 px, padding de 16 px, gap de
  12 px e sombra preta com deslocamento vertical de 8 px e blur de 20 px.
- O cabeçalho usa Oxanium de 16 px e peso 650 para o mês e ano.
- Os botões de mês medem 32 × 32 px, têm raio de 8 px, fundo `surface-hover` e
  ícones Lucide `ChevronLeft` e `ChevronRight` de 16 px.
- Os cabeçalhos `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sáb` e `Dom` medem
  36 × 20 px, com fundo secundário, raio de 4 px e texto de 11 px com peso 600.
- Cada dia mede 36 × 36 px, tem raio de 8 px e texto Chakra Petch de 13 px.
- Dias de outros meses usam texto atenuado com 58% de opacidade.
- A data atual usa contorno da cor principal. Datas conhecidas com lançamentos
  recebem o ponto vermelho de 4 px do Pen. A data selecionada usa fundo vermelho
  sólido e texto branco em peso 700.
- Hover e foco usam `surface-hover` e não substituem a indicação da data
  selecionada.

Os indicadores de lançamento são derivados das datas já conhecidas na resposta
ampla da página e mantidos durante a seleção. Eles são informativos e não causam
pré-buscas extras ao navegar por meses; a ausência de um ponto não impede a
seleção nem afirma que a data não possui lançamentos.

## Resultados por data

### Sucesso

- Durante a consulta, o estado de loading existente substitui os resultados
  anteriores; o cabeçalho mantém o texto de apoio padrão até a resposta chegar.
- Com resultados, o texto de apoio passa a usar singular ou plural:
  `1 lançamento encontrado em 29 de julho` ou
  `4 lançamentos encontrados em 29 de julho`.
- A seção exibe a data completa, por exemplo `29 de julho de 2026`, sem badge
  relativo de Hoje ou Amanhã.
- Os cards e a grade reutilizam os componentes atuais.
- Não existe infinite scroll nem botão de carregar mais durante uma consulta de
  data exata.

### Vazio

- O texto de apoio usa
  `Nenhum lançamento encontrado em 31 de julho`.
- O estado vazio é aberto, sem card externo, e ocupa 360 px de altura conforme o
  Pen.
- O ícone `CalendarX` de 24 px fica em um contêiner de 56 × 56 px, com raio de
  16 px, fundo secundário e borda da marca.
- O título é `Nenhum lançamento nesta data`.
- A descrição é
  `Não encontramos jogos com lançamento em 31 de julho de 2026. Escolha outro dia ou limpe o filtro.`
- O botão secundário usa o ícone `X` e o texto `Limpar data`.

### Erro

- A data continua selecionada.
- O painel de erro e o botão `Tentar novamente` atuais são reutilizados.
- O retry repete exatamente a mesma data, plataforma e gênero.

## Componentes e responsabilidades

### Utilitários de calendário

Um módulo puro será responsável por:

- criar a matriz fixa de 42 dias para um mês, começando na segunda-feira;
- adicionar dias e meses sem depender do fuso horário local;
- identificar mês atual, data atual e data selecionada;
- formatar mês, rótulo curto, rótulo longo e nomes acessíveis em `pt-BR`;
- validar datas civis pelo contrato Zod existente.

### `ReleaseDatePicker`

Componente controlado que recebe mês visível, data selecionada, conjunto de
datas conhecidas com lançamentos e callbacks de navegação, seleção e fechamento.
Ele não busca dados e não conhece filtros de plataforma ou gênero.

### `ReleaseViewSwitcher`

Continua controlado pela página e passa a aceitar o rótulo dinâmico do botão de
calendário. A página diferencia abrir/fechar o popover, limpar a data pela opção
Lista e manter o modo ativo após a seleção.

### `useReleases`

Os filtros do hook passam a aceitar uma data civil opcional. Quando ela existe,
a primeira consulta inclui `from` e `to` iguais, e a sessão termina nessa janela
sem criar o horizonte de dois anos nem enfileirar páginas adicionais. Todas as
regras atuais de cancelamento, proteção contra respostas antigas e retry são
preservadas.

### `ReleasesPage`

A página possui a seleção de data, o estado aberto/fechado do popover e o mês
visível. Ela combina a data com os filtros atuais, escolhe o texto de apoio,
registra as datas conhecidas da resposta ampla e compõe sucesso, vazio, loading e
erro.

### Estado vazio por data

Um componente específico representa o estado `Sem lançamentos` do Pen e recebe
a data e o callback `onClearDate`. O estado vazio genérico continua sendo usado
para consultas sem data.

## Acessibilidade

- O alternador mantém `role="group"`, nome acessível, `aria-controls` e
  `aria-pressed`.
- O popover é um diálogo nomeado pelo mês visível e ligado ao botão por
  `aria-expanded` e `aria-haspopup="dialog"`.
- Cada dia é um botão com nome completo, como `29 de julho de 2026`, e a data
  escolhida expõe `aria-pressed`.
- Ao abrir, o foco vai para a data selecionada, para hoje quando visível ou para
  o primeiro dia do mês.
- As setas direcionais movem o foco entre dias, com deslocamento de sete dias
  nas setas verticalmente; `PageUp` e `PageDown` mudam o mês.
- `Escape` fecha o popover e devolve o foco ao botão Calendário.
- Todos os botões preservam foco visível, navegação por teclado e alvos de clique
  compatíveis com as dimensões do Pen.
- Mudanças de loading, sucesso, vazio e erro mantêm as regiões vivas já usadas
  pela página.

## Fluxo de dados

1. O usuário abre o calendário sem alterar a consulta atual.
2. O usuário escolhe uma data civil.
3. `ReleasesPage` fecha o popover e adiciona a data aos filtros do hook.
4. `useReleases` aborta a sessão anterior, descarta paginação e resultados
   antigos e envia `{ from: data, to: data, platformIds, genreIds, limit: 100 }`.
5. A resposta exibe loading, sucesso, vazio ou erro correspondente à seleção.
6. Limpar ou substituir a data inicia uma nova sessão e ignora respostas tardias
   da sessão anterior.

## Estratégia de testes

Os testes serão escritos antes da implementação e observarão comportamento real:

- utilitários: grade de 42 dias, início na segunda-feira, virada de mês e ano,
  fevereiro bissexto e formatação `pt-BR`;
- date picker: anatomia, rótulos, mês anterior/próximo, seleção, dias adjacentes,
  indicadores, foco, teclado, `Escape` e clique fora;
- alternador: rótulo dinâmico, estados pressionados, expansão e callbacks;
- hook: consulta exata, combinação com plataforma/gênero, ausência de paginação,
  retry, troca de data, aborto e proteção contra resposta tardia;
- página: abrir sem esconder a lista, selecionar uma data, loading, contagem no
  singular e plural, cards filtrados, estado vazio, limpar apenas a data, limpar
  todos os filtros e manter a interface desktop-only;
- regressão: lista ampla, infinite scroll, filtros existentes e estados genéricos
  permanecem funcionais.

## Verificação visual

- Comparar o calendário aberto com `cO7zp` em 1440 × 1560.
- Comparar o resultado preenchido com `d0K2j` em 1440 × 1560.
- Comparar o estado vazio com `Gc9Cn` em 1440 × 1560.
- Verificar também 390 px e 768 px para confirmar que a lista atual permanece
  íntegra e sem overflow.
- Conferir copy, alinhamento, tipografia, cores, raios, bordas, sombra, dimensões,
  ícones, foco e o fluxo completo com o Browser integrado.

## Critérios de aceitação

- O placeholder de calendário deixa de existir.
- Abrir Calendário mantém os resultados atuais visíveis e exibe o popover do Pen.
- Selecionar uma data consulta o servidor com `from === to` e preserva os demais
  filtros.
- A data curta, o texto de apoio, o cabeçalho da seção e os estados preenchido e
  vazio correspondem aos frames aprovados.
- Lista, Limpar data e Limpar filtros restauram exatamente os estados definidos.
- Consultas exatas não iniciam infinite scroll.
- Navegação, foco e fechamento funcionam por mouse e teclado.
- A interface de calendário não aparece abaixo de `lg`.
- Testes focados, suíte completa, lint, formatação, tipos, build e QA visual passam.
