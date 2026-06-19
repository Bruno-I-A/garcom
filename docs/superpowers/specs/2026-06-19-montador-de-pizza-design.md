# Montador de Pizza — Design

**Data:** 2026-06-19
**Contexto:** App do Garçom (React + Vite). Hoje categorias e produtos vêm da API. Foi criada a categoria **Pizza** (id 72), que precisa ser exibida de forma diferente dos produtos comuns.

## Problema

A categoria Pizza **não tem produtos** em `/cardapio`. Ela é um módulo próprio na API:

- `GET /pizza/tamanhos` → `[{ id, nome, pedacos, preco, ativo }]`
  - Pequena (12 pedaços, R$60,00), Grande (16 pedaços, R$75,00)
- `GET /pizza/sabores` → `[{ id, nome, categoria: "salgada"|"doce", descricao, ativo, ordem }]`
  - 13 salgadas + 6 doces (19 no total)
- `GET /grupos-adicionais/categoria/72` → grupos de adicionais; hoje só **Maionese Caseira** (+R$3,00, opcional)

O preço da pizza vem **exclusivamente do tamanho** — sabores não têm preço individual. Não há endpoint de bordas.

Portanto, ao abrir a categoria Pizza, o app não pode listar produtos: precisa exibir um **montador de pizza** (tamanho → sabores → adicional → adicionar ao carrinho).

## Regras de negócio (definidas com o usuário)

1. **Máximo de sabores derivado do tamanho:** `máx = floor(pedaços ÷ 4)`.
   - Pequena (12) → até 3 sabores; Grande (16) → até 4 sabores.
   - Mínimo 1 sabor. Fórmula auto-ajusta se o admin criar novos tamanhos.
2. **Mistura permitida:** o cliente pode combinar sabores salgados + doces na mesma pizza.
3. **Preço:** sempre o preço do tamanho, independente da quantidade/combinação de sabores. Adicionais (Maionese) somam por cima.
4. **Adicionais:** a Maionese Caseira aparece como opcional, puxada dinamicamente de `grupos-adicionais/72` (nada chumbado — se o admin adicionar mais, aparecem).

## Layout escolhido: cards de tamanho + modal

- Na categoria Pizza, renderizar **um card por tamanho** (Pequena / Grande) com nome, fatias, preço e botão **"Montar"**.
- Tocar em "Montar" abre um **modal** com:
  - Cabeçalho: "Pizza {Tamanho}" e contador "X/{máx} sabores".
  - Seção **Salgadas** e seção **Doces** (checkboxes). Ao atingir o máximo, as demais opções ficam desabilitadas.
  - Seção **Adicional**: Maionese Caseira (+R$3) — vinda dos grupos de adicionais da categoria.
  - Campo **Observação** (texto livre).
  - **Total** e botão **"Adicionar ao carrinho"** (habilitado só com ≥1 sabor).
- Abaixo dos cards, listar as **pizzas já no carrinho** (cada uma removível), no mesmo padrão visual usado hoje para o buffet.

## Fluxo de dados

1. Ao entrar na categoria Pizza, buscar `getPizzaTamanhos()` e `getPizzaSabores()` (lazy) + `getGruposAdicionaisCategoria(72)` para a Maionese. Estados de loading/erro.
2. Montar a seleção no modal (tamanho fixo do card, sabores, adicionais, observação).
3. Ao confirmar, construir o item de carrinho e chamar `addProduto(..., unico = true)` — cada pizza é uma **entrada única** (não soma com outra pizza), reaproveitando a flag `unico` já existente (mesma usada pelo buffet).

### Formato do item de carrinho

Reaproveita a estrutura atual `{ id, nome, preco, quantidade, observacao, adicionais }`, em que
`itemTotalUnitario = preco + Σ adicionais[].itens_selecionados[].preco`:

```js
{
  id: `pizza-${tamanho.id}`,
  tipo: 'pizza',                 // flag para identificar/filtrar pizzas no carrinho
  nome: `Pizza ${tamanho.nome}`, // ex: "Pizza Grande"
  preco: Number(tamanho.preco),  // ex: 75
  quantidade: 1,
  observacao: '<texto livre>',
  adicionais: [
    { grupo_id: 'sabores', grupo_nome: 'Sabores',
      itens_selecionados: [ { id, nome: 'Calabresa', preco: 0 }, { id, nome: 'Portuguesa', preco: 0 } ] },
    // se Maionese marcada:
    { grupo_id: 2192, grupo_nome: 'Maionese Caseira',
      itens_selecionados: [ { id: 154, nome: 'Maionese Caseira', preco: 3 } ] }
  ]
}
```

A cozinha/comanda já imprime `adicionais`, então os sabores aparecem no ticket **sem mudança no backend**.

## Componentes e escopo

A lógica de categorias/carrinho existe **duplicada** em duas telas, e ambas precisam do montador:

- `src/pages/Cardapio.jsx` (pedido na mesa, via garçom)
- `src/pages/Balcao.jsx` (balcão)

Novas funções em `src/services/api.js`:

- `getPizzaTamanhos()` — `GET /pizza/tamanhos` (fallback demo: Pequena/Grande).
- `getPizzaSabores()` — `GET /pizza/sabores` (fallback demo: alguns salgados/doces).

Helpers de UI (em cada página, junto dos helpers de buffet):

- `isCategoriaPizza(categoria)` — `nome` normalizado contém "pizza" (ou id 72).
- `maxSaboresPizza(tamanho)` — `Math.max(1, Math.floor(Number(pedacos) / 4))`, com fallback se `pedacos` ausente.
- Estado `pizzaModal` (análogo ao `itemModal`): `{ tamanho, sabores: [], grupos, selecionados, observacao, loading, error }`.
- Reutiliza `addProduto(..., unico=true)`, `entradasProduto`/filtragem por `tipo:'pizza'` e `removerEntradaCarrinho`.

## Tratamento de erros / casos de borda

- Falha ao buscar tamanhos/sabores: mostrar mensagem de erro no lugar do montador, sem quebrar o resto do app.
- Apenas itens com `ativo: true` são exibidos (tamanhos e sabores).
- Botão "Adicionar" desabilitado com 0 sabores; bloquear seleção acima do máximo.
- Sabores ordenados por `ordem`; agrupados por `categoria`.
- Sessão demo: dados de exemplo para tamanhos/sabores (a categoria Pizza não existe no demo atual — o montador só aparece se houver categoria Pizza).

## Testes (verificação manual)

1. Abrir categoria Pizza → ver 2 cards de tamanho com preço correto.
2. Montar Grande, escolher 4 sabores (salgado + doce) → 5º fica bloqueado; total = R$75.
3. Marcar Maionese → total = R$78; item no carrinho mostra "Pizza Grande" + sabores + Maionese.
4. Adicionar 2 pizzas diferentes → 2 entradas separadas (não somam); cada uma removível.
5. Confirmar pedido → cozinha recebe item com sabores nos adicionais.

## Fora de escopo

- Bordas (não existem no admin).
- Cadastro/edição de pizza (é função do painel admin).
- Preço por sabor / cobrança do sabor mais caro (sabores não têm preço).
