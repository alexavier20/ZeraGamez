# Header responsivo do Zera GameZ

## Objetivo

Criar um sistema de Header reutilizável para o Zera GameZ, fiel ao arquivo de design `C:\Projects\Design\zeragamez\ZeraGamez`, com composições específicas para desktop, tablet e mobile. A entrega inclui navegação funcional por rotas, busca configurável, ações de usuário, variações contextuais no mobile e uma navegação inferior móvel.

## Escopo

- Implementar o Header principal para desktop, tablet e mobile.
- Implementar `MobileBottomNav` como componente independente e reutilizável.
- Suportar no mobile as variantes `default`, `detail` e `form` por meio de props.
- Reaproveitar o logotipo existente em `C:\Users\alex.brq\Documents\ZeraGamez\assets\images\zera-gamez-z-icon-white-header.png` como asset público do projeto.
- Usar os ícones especificados no design por meio de imports diretos de `lucide-react`.
- Manter textos, rotas e itens de navegação em uma configuração compartilhada.
- Não criar páginas fictícias para as rotas ainda inexistentes.

## Fora do escopo

- Implementação das páginas de lançamentos, listas, perfil ou detalhes.
- Integração real com autenticação, notificações ou mecanismo de busca.
- Estado global.
- Menu lateral ou dropdown do tablet, além de expor seu callback.
- Header fixo ou sticky no topo da página.

## Arquitetura

O `Header` será a API pública e o orquestrador das composições responsivas. A troca de layout será feita por CSS e breakpoints do Tailwind, sem listeners de largura ou estado derivado do viewport em JavaScript.

Estrutura planejada:

- `Header.tsx`: composição, props públicas e seleção da variante móvel.
- `HeaderBrand.tsx`: logotipo, nome e link para a página inicial.
- `DesktopNavigation.tsx`: navegação principal com `NavLink`.
- `GlobalSearch.tsx`: formulário de busca acessível e controlável.
- `HeaderActions.tsx`: notificações, avatar e ação de criar lista.
- `MobileContextHeader.tsx`: composições `default`, `detail` e `form`.
- `MobileBottomNav.tsx`: navegação móvel fixa na parte inferior.
- `header.config.ts`: textos, rotas e itens de navegação compartilhados.
- `header.types.ts`: tipos comuns de usuário, busca, variantes e callbacks.

As unidades terão responsabilidade única. Nenhum componente declarará outro componente dentro de sua função de renderização, e não serão criadas abstrações para trechos usados apenas uma vez sem benefício de clareza.

## API e fluxo de dados

O Header não dependerá de estado global. Os dados e comportamentos serão recebidos por props:

- `variant`: `default`, `detail` ou `form` para a composição móvel.
- `title`: título das variantes contextuais.
- `user`: nome e iniciais exibidos no avatar.
- `onSearch(query)`: chamado após envio de uma consulta não vazia.
- `onNotificationsClick`: ação do botão de notificações.
- `onProfileClick`: ação do avatar ou item de perfil.
- `onTabletMenuClick`: ação do menu compacto no tablet.
- `onBack`: ação de retorno na variante `detail`.
- `onClose`: ação de fechamento na variante `form`.
- `contextAction`: configuração da ação à direita, com label acessível, texto ou tipo de ícone e callback.

A busca manterá somente o valor local necessário ao formulário. O texto será normalizado com `trim`; consultas vazias não dispararão o callback. Callbacks opcionais não produzirão erros quando ausentes. Todos os botões não relacionados a envio usarão `type="button"`.

## Rotas

As rotas compartilhadas serão:

- Início e marca: `/`
- Lançamentos: `/lancamentos`
- Minhas listas: `/minhas-listas`
- Criar lista: `/minhas-listas/nova`
- Perfil: `/perfil`

O item móvel “Explorar” apontará para `/lancamentos`, compartilhando o destino da navegação desktop. `NavLink` fornecerá o estado ativo e `aria-current` sem estado duplicado. Como as páginas não fazem parte desta entrega, a configuração fica pronta para a evolução do roteador sem criar telas provisórias.

## Responsividade

- Mobile, abaixo de `640px`: marca e notificações na variante padrão; cabeçalho contextual quando solicitado; navegação inferior fixa.
- Tablet, de `640px` a `1023px`: marca compacta, busca e botão de menu.
- Desktop, a partir de `1024px`: marca, navegação, busca, notificações, avatar e CTA “Criar lista”.

O Header superior permanecerá no fluxo normal da página. A navegação móvel considerará a safe area inferior e o conteúdo da aplicação deverá reservar espaço para não ficar encoberto.

## Estilo e tokens

O tema Tailwind existente será ampliado com os tokens do design:

- Cores de fundo, superfícies, texto, texto secundário, bordas e estados da marca.
- Fonte de títulos: `Oxanium`.
- Fonte de corpo: `Chakra Petch`.
- Espaçamentos recorrentes de 8, 16, 24 e 32 px.

As fontes serão empacotadas localmente com `@fontsource/oxanium` e `@fontsource/chakra-petch`, carregando somente os pesos usados pelo Header. Isso evita depender de uma requisição externa em tempo de execução.

Valores visuais recorrentes serão nomeados no tema em vez de espalhados como valores arbitrários nos componentes. O logotipo será servido como asset local. Os ícones serão importados nominalmente do `lucide-react`, limitados aos símbolos realmente usados.

## Acessibilidade

- Usar os elementos semânticos `header`, `nav`, `form`, `input` e `button`.
- Fornecer nomes acessíveis aos controles compostos apenas por ícones.
- Ocultar ícones decorativos de tecnologias assistivas.
- Garantir foco visível e áreas de toque adequadas.
- Associar um label acessível ao campo de busca.
- Permitir envio da busca pelo teclado.
- Usar o estado ativo sem depender somente de cor.
- Manter ordem de foco equivalente à ordem visual.

## Tratamento de estados e erros

Não há operações remotas neste componente. Os estados locais se limitam ao campo de busca. Consultas vazias serão ignoradas; callbacks ausentes serão tratados como opcionais; strings visíveis terão valores seguros definidos pela configuração ou pelas props obrigatórias de cada variante.

## Testes e validação

Os testes com Vitest, Testing Library e `user-event` cobrirão:

- Renderização do Header principal e das variantes contextuais.
- Links e estado ativo das navegações.
- Envio de busca válida e bloqueio de busca vazia.
- Disparo dos callbacks de notificações, perfil, menu, voltar, fechar e ação contextual.
- Conteúdo e semântica da navegação inferior móvel.
- Nomes acessíveis dos controles principais.

Como o jsdom não calcula os breakpoints do CSS, os testes verificarão a presença das composições e suas classes responsivas; a validação visual responsiva será feita separadamente no navegador.

Antes da conclusão serão executados lint, typecheck, testes e build. O servidor local e a auditoria visual no navegador só serão iniciados após autorização explícita do usuário.

## Critérios de aceite

- O Header reproduz as composições desktop, tablet e mobile do arquivo de design.
- As variantes móveis `default`, `detail` e `form` usam uma API comum.
- A navegação inferior móvel é reutilizável e não duplica a configuração de rotas.
- Busca, navegação e ações expõem comportamentos funcionais por rotas ou callbacks.
- O código está dividido por responsabilidade, tipado e sem estado global.
- Controles essenciais são acessíveis por teclado e leitor de tela.
- Lint, typecheck, testes e build passam.
