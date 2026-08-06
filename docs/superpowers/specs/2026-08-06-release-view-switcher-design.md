# Alternador de visualização dos lançamentos

## Objetivo

Adicionar à página “Próximos lançamentos” o controle segmentado selecionado no Pen, permitindo alternar entre os modos Lista e Calendário.

## Comportamento

- A página mantém o modo selecionado como estado local controlado, limitado a `list` ou `calendar`.
- Lista é o modo inicial.
- Cada opção é um botão; ao ser acionada, atualiza imediatamente o estado selecionado.
- O estado altera a aparência dos dois botões, mas ainda não troca o conteúdo da página, pois as visualizações de lista e calendário estão fora deste escopo.
- O grupo possui nome acessível e cada botão expõe seu estado por `aria-pressed`.
- Ambos os botões apresentam foco visível para navegação por teclado.

## Composição e responsividade

- O componente fica no cabeçalho da página, alinhado à direita e à base do conjunto de título e subtítulo.
- Ele é exibido apenas no breakpoint desktop (`lg`) e fica oculto em tablet e celular.
- O título e o subtítulo existentes não mudam.

## Fidelidade ao Pen

- Contêiner: 40 px de altura, fundo secundário, raio de 12 px, espaçamento interno de 4 px e intervalo de 4 px.
- Opções: 32 px de altura, raio de 9 px, 11 px de espaçamento horizontal e intervalo interno de 7 px.
- Ícones Lucide `List` e `CalendarDays` com 15 px.
- Rótulos com Chakra Petch, 12 px e peso 600.
- A opção ativa usa fundo `surface-hover` e texto principal; a inativa permanece transparente com texto atenuado.

## Estrutura

- Criar um componente específico da funcionalidade de lançamentos com propriedades `value` e `onChange`.
- `ReleasesPage` é responsável pelo estado e pela composição responsiva do cabeçalho.
- Reutilizar os tokens Tailwind e a dependência `lucide-react` já presentes no projeto.

## Verificação

- Um teste do componente confirma o modo inicial recebido, a semântica acessível e a troca de modo.
- O teste de integração da página confirma título, posicionamento responsivo por classes e alternância funcional.
- Executar testes, lint, verificação de tipos, formatação e build.
