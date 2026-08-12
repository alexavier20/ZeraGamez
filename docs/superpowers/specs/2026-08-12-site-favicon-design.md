# Design: Favicon do Zera GameZ

**Data:** 12 de agosto de 2026

## Objetivo

Exibir o símbolo do Zera GameZ como favicon, mantendo contraste e reconhecimento em abas com temas claros ou escuros.

## Solução aprovada

Criar um arquivo `public/favicon.png` quadrado, com 512 × 512 pixels. O fundo usará o vermelho principal da marca (`#e70012`) e o símbolo branco será derivado do asset existente `public/assets/images/zera-gamez-z-icon-white-header.png`, centralizado sem deformação.

O `index.html` declarará o arquivo com `rel="icon"`, `type="image/png"` e caminho público `/favicon.png`. A implementação não adicionará manifest, ícones para instalação ou dependências, pois esses itens não são necessários para o favicon solicitado.

## Fluxo e compatibilidade

O Vite copiará `public/favicon.png` para a raiz do build. A configuração da Vercel deverá servir `/favicon.png` diretamente como `image/png`; a regra de fallback da aplicação continuará atendendo apenas rotas da interface.

## Validação

- Confirmar que o arquivo gerado é um PNG válido de 512 × 512 pixels.
- Confirmar que o documento HTML referencia `/favicon.png` com o tipo correto.
- Executar os testes, a verificação de tipos e o build do projeto.
- Abrir o app pelo fluxo local da Vercel e verificar que `/favicon.png` responde com `200 image/png`.
- Validar no navegador que a página carrega normalmente, sem overlay nem erros relevantes no console, e que o favicon declarado está disponível.
