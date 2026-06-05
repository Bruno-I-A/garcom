import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { adicionarItensPedido, asArray, criarPedido, getCardapio, getCategorias, getGarcom, getGruposAdicionaisCategoria, getPedidosAbertos } from '../services/api.js';

const BUFFET_LIVRE_PRECO = 30;
const BUFFET_KG_PRECO = 64;

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function produtoId(produto) {
  return produto?.id || produto?._id || produto?.produto_id || produto?.nome;
}

function categoriaId(categoria) {
  return categoria?.id || categoria?._id || categoria?.categoria_id || categoria?.nome;
}

function categoriaNome(categoria) {
  return categoria?.nome || categoria?.name || categoria?.categoria_nome || String(categoriaId(categoria));
}

function produtoCategoria(produto) {
  return produto?.categoria_id || produto?.categoriaId || produto?.categoria || produto?.categoria_nome || 'Sem categoria';
}

function grupoId(grupo) {
  return grupo?.id || grupo?._id || grupo?.grupo_id || grupo?.grupoId || grupo?.nome;
}

function grupoNome(grupo) {
  return grupo?.nome || grupo?.name || grupo?.titulo || String(grupoId(grupo));
}

function grupoTipo(grupo) {
  return String(grupo?.tipo || grupo?.type || 'multiplo').toLowerCase() === 'unico' ? 'unico' : 'multiplo';
}

function grupoObrigatorio(grupo) {
  return Boolean(grupo?.obrigatorio ?? grupo?.required ?? grupo?.obrigatory);
}

function grupoItens(grupo) {
  return asArray(grupo?.itens || grupo?.items || grupo?.adicionais || grupo?.opcoes || grupo?.options);
}

function adicionalId(item) {
  return item?.id || item?._id || item?.adicional_id || item?.item_id || item?.nome;
}

function adicionalNome(item) {
  return item?.nome || item?.name || item?.titulo || String(adicionalId(item));
}

function adicionalPreco(item) {
  return Number(item?.preco || item?.price || item?.valor || 0);
}

function precoAdicionaisItem(item) {
  return asArray(item?.adicionais).reduce((acc, grupo) => {
    return acc + asArray(grupo?.itens_selecionados).reduce((sum, adicional) => sum + Number(adicional?.preco || 0), 0);
  }, 0);
}

function itemTotalUnitario(item) {
  return Number(item?.preco || 0) + precoAdicionaisItem(item);
}

function pedidoId(pedido) {
  return pedido?.id || pedido?._id || pedido?.pedido_id;
}

function mesaDoPedido(pedido) {
  return String(pedido?.mesa || pedido?.numero_mesa || pedido?.mesa_numero || '');
}

function pedidoAberto(pedido) {
  const status = String(pedido?.status || '').toLowerCase();
  return status !== 'entregue' && status !== 'cancelado';
}

function categoriaVisual(nome, index) {
  const value = normalizarTexto(nome);
  const fallback = [
    { icon: '🍽️', tone: 'from-purple-500/30 to-fuchsia-400/10' },
    { icon: '🍔', tone: 'from-fuchsia-500/25 to-purple-400/10' },
    { icon: '🍗', tone: 'from-violet-500/25 to-cyan-400/10' },
    { icon: '🍟', tone: 'from-indigo-500/25 to-purple-400/10' }
  ];

  if (value.includes('bebida') || value.includes('suco') || value.includes('drink') || value.includes('refri')) {
    return { icon: '🥤', tone: 'from-cyan-500/25 to-blue-400/10' };
  }
  if (value.includes('buffet')) {
    return { icon: '🍽️', tone: 'from-purple-500/30 to-fuchsia-400/10' };
  }
  if (value.includes('xis') || value.includes('lanche') || value.includes('burger') || value.includes('burguer') || value.includes('hamb')) {
    return { icon: '🍔', tone: 'from-fuchsia-500/25 to-purple-400/10' };
  }
  if (value.includes('combo')) {
    return { icon: '🍱', tone: 'from-emerald-500/25 to-lime-400/10' };
  }
  if (value.includes('frango')) {
    return { icon: '🍗', tone: 'from-violet-500/25 to-cyan-400/10' };
  }
  if (value.includes('porç') || value.includes('porc')) {
    return { icon: '🍟', tone: 'from-indigo-500/25 to-purple-400/10' };
  }
  if (value.includes('sobremesa') || value.includes('doce')) {
    return { icon: '🍮', tone: 'from-pink-500/25 to-rose-400/10' };
  }
  if (value.includes('pizza')) {
    return { icon: '🍕', tone: 'from-red-500/25 to-yellow-400/10' };
  }
  if (value.includes('cafe') || value.includes('caf')) {
    return { icon: '☕', tone: 'from-stone-500/25 to-purple-400/10' };
  }
  if (value.includes('prato') || value.includes('refei')) {
    return { icon: '🍽️', tone: 'from-purple-500/30 to-fuchsia-400/10' };
  }
  return fallback[index % fallback.length];
}

export default function Cardapio() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null);
  const [busca, setBusca] = useState('');
  const [cart, setCart] = useState({});
  const [buffetInputs, setBuffetInputs] = useState({});
  const [itemModal, setItemModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [categoriasData, produtosData] = await Promise.all([getCategorias(), getCardapio()]);
        if (active) {
          setCategorias(asArray(categoriasData));
          setProdutos(asArray(produtosData));
        }
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível carregar o cardápio.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const categoriasOrdenadas = useMemo(() => {
    const byId = new Map(categorias.map((categoria) => [String(categoriaId(categoria)), categoria]));
    const groups = new Map();

    categorias.forEach((categoria, index) => {
      const id = String(categoriaId(categoria));
      const nome = categoriaNome(categoria);
      groups.set(id, { id, nome, visual: categoriaVisual(nome, index), items: [] });
    });

    produtos.forEach((produto) => {
      const key = String(produtoCategoria(produto));
      const categoria = byId.get(key);
      const id = categoria ? String(categoriaId(categoria)) : key;
      const nome = categoria ? categoriaNome(categoria) : produto?.categoria_nome || produto?.categoria?.nome || key;

      if (!groups.has(id)) {
        groups.set(id, { id, nome, visual: categoriaVisual(nome, groups.size), items: [] });
      }
      groups.get(id).items.push(produto);
    });

    return Array.from(groups.values());
  }, [categorias, produtos]);

  const resultadosBusca = useMemo(() => {
    const termo = normalizarTexto(busca);
    if (!termo) return [];
    return produtos.filter((p) => normalizarTexto(p?.nome || p?.name || '').includes(termo));
  }, [busca, produtos]);

  const categoriaAtual = useMemo(() => {
    return categoriasOrdenadas.find((categoria) => categoria.id === categoriaSelecionada) || null;
  }, [categoriaSelecionada, categoriasOrdenadas]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const quantidade = useMemo(() => cartItems.reduce((acc, item) => acc + item.quantidade, 0), [cartItems]);
  const total = useMemo(() => cartItems.reduce((acc, item) => acc + itemTotalUnitario(item) * item.quantidade, 0), [cartItems]);

  const modalPodeAdicionar = useMemo(() => {
    if (!itemModal || itemModal.loading) return false;
    return itemModal.grupos.every((grupo) => {
      if (!grupoObrigatorio(grupo)) return true;
      const selected = itemModal.selecionados[String(grupoId(grupo))];
      return Array.isArray(selected) ? selected.length > 0 : Boolean(selected);
    });
  }, [itemModal]);

  function isProdutoBuffet(produto, nomeCategoria) {
    return normalizarTexto(nomeCategoria) === 'buffet' || normalizarTexto(produto?.nome || produto?.name).includes('buffet');
  }

  function tipoBuffet(produto) {
    const nome = normalizarTexto(produto?.nome || produto?.name);
    if (nome.includes('kg')) return 'kg';
    return 'livre';
  }

  function valorBuffetInput(produto) {
    const id = produtoId(produto);
    const tipo = tipoBuffet(produto);
    return buffetInputs[id] ?? (tipo === 'kg' ? '0.100' : '1');
  }

  function setValorBuffetInput(produto, value) {
    const id = produtoId(produto);
    setBuffetInputs((current) => ({ ...current, [id]: value }));
  }

  function formatarQuantidadeTotal(value) {
    return Number.isInteger(value) ? value : value.toFixed(3);
  }

  function buildCartKey(id, observacao, adicionais) {
    const adicionaisKey = asArray(adicionais)
      .map((grupo) => `${grupo.grupo_id}:${asArray(grupo.itens_selecionados).map((item) => item.id).join(',')}`)
      .join('|');
    return `${id}|${observacao.trim()}|${adicionaisKey}`;
  }

  function quantidadeProduto(produto) {
    const id = String(produtoId(produto));
    return cartItems.filter((item) => String(item.id) === id).reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
  }

  function addProduto(produto, quantidade = 1, preco = Number(produto?.preco || produto?.price || 0), observacao = '', adicionais = []) {
    const id = produtoId(produto);
    const cartKey = buildCartKey(String(id), observacao, adicionais);
    setCart((current) => ({
      ...current,
      [cartKey]: {
        id,
        nome: produto?.nome || produto?.name || 'Produto',
        preco,
        quantidade: Number((Number(current[cartKey]?.quantidade || 0) + Number(quantidade || 0)).toFixed(3)),
        observacao: observacao.trim(),
        adicionais
      }
    }));
  }

  function removeProduto(produto, quantidade = 1) {
    const id = produtoId(produto);
    setCart((current) => {
      const key = Object.keys(current)
        .reverse()
        .find((cartKey) => String(current[cartKey]?.id) === String(id));
      if (!key) return current;

      const item = current[key];
      if (!item) return current;

      const next = { ...current };
      const nextQuantidade = Number((Number(item.quantidade || 0) - Number(quantidade || 0)).toFixed(3));
      if (nextQuantidade <= 0) {
        delete next[key];
      } else {
        next[key] = { ...item, quantidade: nextQuantidade };
      }
      return next;
    });
  }

  async function abrirModalProduto(produto, categoria, quantidadeInicial = 1, preco = Number(produto?.preco || produto?.price || 0)) {
    const categoriaDoProduto = produtoCategoria(produto);
    const categoriaApiId = categoria?.id || categoriaDoProduto;
    setError('');
    setItemModal({
      produto,
      categoriaId: categoriaApiId,
      preco,
      quantidade: Number(quantidadeInicial || 1),
      observacao: '',
      grupos: [],
      selecionados: {},
      loading: true,
      error: ''
    });

    try {
      const grupos = asArray(await getGruposAdicionaisCategoria(categoriaApiId));
      setItemModal((current) => (current?.produto === produto ? { ...current, grupos, loading: false } : current));
    } catch (err) {
      setItemModal((current) =>
        current?.produto === produto
          ? {
              ...current,
              grupos: [],
              loading: false,
              error: err.message || 'Não foi possível carregar os adicionais.'
            }
          : current
      );
    }
  }

  function alterarQuantidadeModal(delta) {
    setItemModal((current) => {
      if (!current) return current;
      const next = Math.max(1, Number(current.quantidade || 1) + delta);
      return { ...current, quantidade: next };
    });
  }

  function selecionarAdicional(grupo, item, checked) {
    const gId = String(grupoId(grupo));
    const aId = String(adicionalId(item));
    setItemModal((current) => {
      if (!current) return current;
      const selecionados = { ...current.selecionados };
      if (grupoTipo(grupo) === 'unico') {
        selecionados[gId] = aId;
      } else {
        const atuais = Array.isArray(selecionados[gId]) ? selecionados[gId] : [];
        selecionados[gId] = checked ? [...atuais, aId] : atuais.filter((id) => id !== aId);
      }
      return { ...current, selecionados };
    });
  }

  function montarAdicionaisSelecionados() {
    if (!itemModal) return [];

    return itemModal.grupos
      .map((grupo) => {
        const gId = String(grupoId(grupo));
        const selected = itemModal.selecionados[gId];
        const selectedIds = Array.isArray(selected) ? selected : selected ? [selected] : [];
        const itensSelecionados = grupoItens(grupo)
          .filter((item) => selectedIds.includes(String(adicionalId(item))))
          .map((item) => ({
            id: adicionalId(item),
            nome: adicionalNome(item),
            preco: adicionalPreco(item)
          }));

        return {
          grupo_id: grupoId(grupo),
          grupo_nome: grupoNome(grupo),
          itens_selecionados: itensSelecionados
        };
      })
      .filter((grupo) => grupo.itens_selecionados.length > 0);
  }

  function precoAdicionaisModal() {
    return montarAdicionaisSelecionados().reduce((acc, grupo) => {
      return acc + grupo.itens_selecionados.reduce((sum, item) => sum + Number(item.preco || 0), 0);
    }, 0);
  }

  function confirmarModalProduto() {
    if (!itemModal || !modalPodeAdicionar) return;
    addProduto(itemModal.produto, itemModal.quantidade, itemModal.preco, itemModal.observacao, montarAdicionaisSelecionados());
    setItemModal(null);
  }

  function abrirModalBuffetProduto(produto) {
    const tipo = tipoBuffet(produto);
    const rawValue = valorBuffetInput(produto);
    const quantidadeBuffet = tipo === 'kg' ? Number(Number(rawValue).toFixed(3)) : Math.floor(Number(rawValue));
    const precoBuffet = tipo === 'kg' ? BUFFET_KG_PRECO : BUFFET_LIVRE_PRECO;

    if (!quantidadeBuffet || quantidadeBuffet <= 0) {
      setError(tipo === 'kg' ? 'Informe o peso do buffet.' : 'Informe o número de pessoas.');
      return;
    }

    setError('');
    abrirModalProduto(produto, categoriaAtual, quantidadeBuffet, precoBuffet);
  }

  const isBalcao = numero === 'balcao';

  async function confirmarPedido() {
    if (!cartItems.length) {
      setError('Adicione pelo menos um item ao pedido.');
      return;
    }

    const garcom = getGarcom() || {};
    const pedido = {
      itens: cartItems,
      total,
      tipo_entrega: isBalcao ? 'balcao' : 'mesa',
      mesa: isBalcao ? null : String(numero),
      origem: 'garcom',
      garcom_id: garcom.id || garcom._id || garcom.garcom_id || null,
      garcom_nome: garcom.nome || garcom.name || garcom.usuario || 'Garçom',
      forma_pagamento: null,
      numero_whatsapp: null,
      status: 'novo'
    };

    setSaving(true);
    setError('');
    try {
      if (isBalcao) {
        await criarPedido(pedido);
        navigate('/mesas', { replace: true });
      } else {
        const pedidos = asArray(await getPedidosAbertos());
        const pedidoExistente = pedidos.find((item) => mesaDoPedido(item) === String(numero) && pedidoAberto(item));
        const pedidoExistenteId = pedidoId(pedidoExistente);

        if (pedidoExistenteId) {
          await adicionarItensPedido(pedidoExistenteId, cartItems);
        } else {
          await criarPedido(pedido);
        }

        navigate(`/mesa/${numero}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Não foi possível confirmar o pedido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="mobile-page">
        {!categoriaAtual ? (
          <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-purple-400/15 bg-black/95 px-4 py-4 shadow-lg shadow-purple-950/20 backdrop-blur">
            <Header title={isBalcao ? 'Cardápio - Balcão' : `Cardápio - Mesa ${numero}`} showBack />
            <div className="mt-3">
              <input
                className="field w-full text-base"
                type="search"
                placeholder="Buscar item..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar item no cardápio"
              />
            </div>
          </header>
        ) : (
          <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-purple-400/15 bg-black/95 px-4 py-4 shadow-lg shadow-purple-950/20 backdrop-blur">
            <div className="flex min-h-12 items-center gap-3">
              <button className="secondary-button min-w-12 px-3" type="button" onClick={() => setCategoriaSelecionada(null)} aria-label="Voltar para categorias">
                ←
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-black text-white">{categoriaAtual.nome}</h1>
                <p className="truncate text-sm text-gray-400">{isBalcao ? 'Balcão' : `Mesa ${numero}`}</p>
              </div>
            </div>
          </header>
        )}

        {loading ? <p className="card border-gray-700 text-center text-gray-200">Carregando cardápio...</p> : null}
        {error ? <p className="mb-4 rounded-xl border border-red-500/60 bg-red-950/40 p-3 text-red-100">{error}</p> : null}

        {!categoriaAtual && busca ? (
          <section className={quantidade ? 'space-y-3 pb-32' : 'space-y-3 pb-6'}>
            {!resultadosBusca.length ? (
              <p className="card border-gray-700 text-gray-300">Nenhum item encontrado para "{busca}".</p>
            ) : (
              resultadosBusca.map((produto) => {
                const id = produtoId(produto);
                const itemQuantidade = quantidadeProduto(produto);
                const preco = Number(produto?.preco || produto?.price || 0);
                const categoriaDoProduto = categoriasOrdenadas.find((c) => c.items.some((p) => produtoId(p) === id));
                const buffet = isProdutoBuffet(produto, categoriaDoProduto?.nome || '');
                const buffetTipo = tipoBuffet(produto);
                const buffetValue = valorBuffetInput(produto);
                const buffetPreco = buffetTipo === 'kg' ? BUFFET_KG_PRECO : BUFFET_LIVRE_PRECO;
                const buffetQuantidade = buffetTipo === 'kg' ? Number(buffetValue || 0) : Math.floor(Number(buffetValue || 0));
                const buffetTotal = Number.isFinite(buffetQuantidade) ? buffetPreco * buffetQuantidade : 0;
                return (
                  <article className="rounded-xl border border-purple-400/15 bg-[#0a0610]/95 p-4 shadow-lg shadow-purple-950/20" key={id}>
                    {categoriaDoProduto ? (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-400">{categoriaDoProduto.nome}</p>
                    ) : null}
                    <div className={buffet ? 'space-y-4' : 'flex items-center justify-between gap-3'}>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-white">{produto?.nome || produto?.name || 'Produto'}</h2>
                        <p className="mt-1 text-base font-semibold text-purple-300">{moeda(buffet ? buffetPreco : preco)}</p>
                      </div>
                      {buffet ? (
                        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                          <label className="block">
                            <span className="mb-2 block text-sm font-bold text-gray-300">{buffetTipo === 'kg' ? 'Peso em kg (ex: 0.850)' : 'Número de pessoas'}</span>
                            <input
                              className="field text-base"
                              type="number"
                              step={buffetTipo === 'kg' ? '0.001' : '1'}
                              min={buffetTipo === 'kg' ? '0.1' : '1'}
                              value={buffetValue}
                              onChange={(event) => setValorBuffetInput(produto, event.target.value)}
                              onBlur={() => {
                                if (buffetTipo === 'kg' && Number(buffetValue) > 0) {
                                  setValorBuffetInput(produto, Number(buffetValue).toFixed(3));
                                }
                              }}
                            />
                            <span className="mt-2 block text-sm font-semibold text-purple-300">Total: {moeda(buffetTotal)}</span>
                          </label>
                          <button className="primary-button h-14 min-h-14 w-14 rounded-xl px-0 text-3xl" type="button" onClick={() => abrirModalBuffetProduto(produto)} aria-label={`Adicionar ${produto?.nome || 'produto'}`}>
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {itemQuantidade ? (
                            <button className="secondary-button h-14 min-h-14 w-14 rounded-xl px-0 text-3xl" type="button" onClick={() => removeProduto(produto)} aria-label={`Remover ${produto?.nome || 'produto'}`}>
                              -
                            </button>
                          ) : null}
                          {itemQuantidade ? <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-purple-500/15 px-2 text-lg font-black text-purple-200">{formatarQuantidadeTotal(itemQuantidade)}</span> : null}
                          <button className="primary-button h-14 min-h-14 w-14 rounded-xl px-0 text-3xl" type="button" onClick={() => abrirModalProduto(produto, categoriaDoProduto || { nome: '', items: [] })} aria-label={`Adicionar ${produto?.nome || 'produto'}`}>
                            +
                          </button>
                        </div>
                      )}
                    </div>
                    {buffet && itemQuantidade ? (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-purple-500/10 px-3 py-2">
                        <span className="text-sm font-bold text-purple-100">No carrinho: {formatarQuantidadeTotal(itemQuantidade)}</span>
                        <button className="secondary-button h-10 min-h-10 w-10 px-0 text-2xl" type="button" onClick={() => removeProduto(produto, buffetTipo === 'kg' ? Number(buffetValue || 0) : 1)} aria-label={`Remover ${produto?.nome || 'produto'}`}>
                          -
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </section>
        ) : !categoriaAtual ? (
          <section className={quantidade ? 'grid grid-cols-2 gap-3 pb-32' : 'grid grid-cols-2 gap-3 pb-6'}>
            {!loading && !categoriasOrdenadas.length ? <p className="card col-span-2 border-gray-700 text-gray-300">Nenhuma categoria encontrada.</p> : null}

            {categoriasOrdenadas.map((categoria) => (
              <button className="group relative min-h-36 overflow-hidden rounded-xl border border-purple-400/15 bg-[#0a0610]/95 p-4 text-left shadow-lg shadow-purple-950/20 transition hover:-translate-y-0.5 hover:border-purple-300/60 active:scale-[0.98]" type="button" key={categoria.id} onClick={() => setCategoriaSelecionada(categoria.id)}>
                <span className={`absolute inset-0 bg-gradient-to-br ${categoria.visual.tone}`} aria-hidden="true" />
                <span className="relative flex h-full min-h-28 flex-col justify-between">
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-3xl shadow-inner shadow-white/5" aria-hidden="true">
                      {categoria.visual.icon}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-purple-400/20 bg-black/30 text-lg font-black text-purple-200">›</span>
                  </span>
                  <span className="text-xl font-black leading-tight text-white drop-shadow">{categoria.nome}</span>
                </span>
              </button>
            ))}
          </section>
        ) : (
          <section className={quantidade ? 'space-y-3 pb-32' : 'space-y-3 pb-6'}>
            {categoriaAtual.items.length ? (
              categoriaAtual.items.map((produto) => {
                const id = produtoId(produto);
                const itemQuantidade = quantidadeProduto(produto);
                const preco = Number(produto?.preco || produto?.price || 0);
                const buffet = isProdutoBuffet(produto, categoriaAtual.nome);
                const buffetTipo = tipoBuffet(produto);
                const buffetValue = valorBuffetInput(produto);
                const buffetPreco = buffetTipo === 'kg' ? BUFFET_KG_PRECO : BUFFET_LIVRE_PRECO;
                const buffetQuantidade = buffetTipo === 'kg' ? Number(buffetValue || 0) : Math.floor(Number(buffetValue || 0));
                const buffetTotal = Number.isFinite(buffetQuantidade) ? buffetPreco * buffetQuantidade : 0;
                return (
                  <article className="rounded-xl border border-purple-400/15 bg-[#0a0610]/95 p-4 shadow-lg shadow-purple-950/20" key={id}>
                    <div className={buffet ? 'space-y-4' : 'flex items-center justify-between gap-3'}>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-white">{produto?.nome || produto?.name || 'Produto'}</h2>
                        <p className="mt-1 text-base font-semibold text-purple-300">{moeda(buffet ? buffetPreco : preco)}</p>
                      </div>
                      {buffet ? (
                        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                          <label className="block">
                            <span className="mb-2 block text-sm font-bold text-gray-300">{buffetTipo === 'kg' ? 'Peso em kg (ex: 0.850)' : 'Número de pessoas'}</span>
                            <input
                              className="field text-base"
                              type="number"
                              step={buffetTipo === 'kg' ? '0.001' : '1'}
                              min={buffetTipo === 'kg' ? '0.1' : '1'}
                              value={buffetValue}
                              onChange={(event) => setValorBuffetInput(produto, event.target.value)}
                              onBlur={() => {
                                if (buffetTipo === 'kg' && Number(buffetValue) > 0) {
                                  setValorBuffetInput(produto, Number(buffetValue).toFixed(3));
                                }
                              }}
                            />
                            <span className="mt-2 block text-sm font-semibold text-purple-300">Total: {moeda(buffetTotal)}</span>
                          </label>
                          <button className="primary-button h-14 min-h-14 w-14 rounded-xl px-0 text-3xl" type="button" onClick={() => abrirModalBuffetProduto(produto)} aria-label={`Adicionar ${produto?.nome || 'produto'}`}>
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {itemQuantidade ? (
                            <button className="secondary-button h-14 min-h-14 w-14 rounded-xl px-0 text-3xl" type="button" onClick={() => removeProduto(produto)} aria-label={`Remover ${produto?.nome || 'produto'}`}>
                              -
                            </button>
                          ) : null}
                          {itemQuantidade ? <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-purple-500/15 px-2 text-lg font-black text-purple-200">{formatarQuantidadeTotal(itemQuantidade)}</span> : null}
                          <button className="primary-button h-14 min-h-14 w-14 rounded-xl px-0 text-3xl" type="button" onClick={() => abrirModalProduto(produto, categoriaAtual)} aria-label={`Adicionar ${produto?.nome || 'produto'}`}>
                            +
                          </button>
                        </div>
                      )}
                    </div>
                    {buffet && itemQuantidade ? (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-purple-500/10 px-3 py-2">
                        <span className="text-sm font-bold text-purple-100">No carrinho: {formatarQuantidadeTotal(itemQuantidade)}</span>
                        <button className="secondary-button h-10 min-h-10 w-10 px-0 text-2xl" type="button" onClick={() => removeProduto(produto, buffetTipo === 'kg' ? Number(buffetValue || 0) : 1)} aria-label={`Remover ${produto?.nome || 'produto'}`}>
                          -
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="card border-gray-700 text-gray-300">Nenhum item nesta categoria.</p>
            )}
          </section>
        )}

        {quantidade ? (
          <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-purple-500/25 bg-black/95 p-4 shadow-2xl shadow-purple-950/30 backdrop-blur">
            <button className="primary-button w-full justify-between rounded-xl px-5" type="button" onClick={confirmarPedido} disabled={saving}>
              <span>{saving ? 'Enviando...' : `Confirmar ${formatarQuantidadeTotal(quantidade)} item${quantidade === 1 ? '' : 's'}`}</span>
              <span>{moeda(total)}</span>
            </button>
          </div>
        ) : null}

        {itemModal ? (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/75 px-4 pb-4 pt-10 backdrop-blur-sm">
            <section className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-xl border border-purple-400/25 bg-[#0a0610] p-4 shadow-2xl shadow-purple-950/50">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-black text-white">{itemModal.produto?.nome || itemModal.produto?.name || 'Produto'}</h2>
                  <p className="mt-1 text-lg font-bold text-purple-300">
                    {moeda((Number(itemModal.preco || 0) + precoAdicionaisModal()) * Number(itemModal.quantidade || 1))}
                  </p>
                </div>
                <button className="secondary-button h-12 min-h-12 w-12 px-0 text-2xl" type="button" onClick={() => setItemModal(null)} aria-label="Fechar">
                  ×
                </button>
              </div>

              <label className="block">
                <span className="mb-2 block text-base font-bold text-gray-300">Observação</span>
                <textarea
                  className="field min-h-24 py-3"
                  value={itemModal.observacao}
                  onChange={(event) => setItemModal((current) => (current ? { ...current, observacao: event.target.value } : current))}
                  placeholder="Ex: sem salada, bem passado"
                />
              </label>

              <div className="my-4 flex items-center justify-between rounded-xl border border-purple-400/15 bg-white/5 p-3">
                <span className="text-base font-bold text-gray-200">Quantidade</span>
                <div className="flex items-center gap-3">
                  <button className="secondary-button h-12 min-h-12 w-12 px-0 text-3xl" type="button" onClick={() => alterarQuantidadeModal(-1)} aria-label="Diminuir quantidade">
                    -
                  </button>
                  <span className="min-w-12 text-center text-2xl font-black text-white">{formatarQuantidadeTotal(itemModal.quantidade)}</span>
                  <button className="primary-button h-12 min-h-12 w-12 px-0 text-3xl" type="button" onClick={() => alterarQuantidadeModal(1)} aria-label="Aumentar quantidade">
                    +
                  </button>
                </div>
              </div>

              {itemModal.loading ? <p className="card border-gray-700 text-center text-gray-200">Carregando adicionais...</p> : null}
              {itemModal.error ? <p className="mb-4 rounded-xl border border-red-500/60 bg-red-950/40 p-3 text-red-100">{itemModal.error}</p> : null}

              {!itemModal.loading && itemModal.grupos.length ? (
                <div className="space-y-4">
                  {itemModal.grupos.map((grupo) => {
                    const gId = String(grupoId(grupo));
                    const tipo = grupoTipo(grupo);
                    const selecionado = itemModal.selecionados[gId];
                    return (
                      <fieldset className="rounded-xl border border-purple-400/15 bg-black/30 p-3" key={gId}>
                        <legend className="px-1 text-base font-black text-white">
                          {grupoNome(grupo)}
                          {grupoObrigatorio(grupo) ? <span className="ml-2 text-sm font-bold text-purple-300">Obrigatório</span> : null}
                        </legend>
                        <div className="mt-2 space-y-2">
                          {grupoItens(grupo).map((adicional) => {
                            const aId = String(adicionalId(adicional));
                            const checked = tipo === 'unico' ? selecionado === aId : Array.isArray(selecionado) && selecionado.includes(aId);
                            return (
                              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-gray-100" key={aId}>
                                <input
                                  className="h-6 w-6 accent-purple-500"
                                  type={tipo === 'unico' ? 'radio' : 'checkbox'}
                                  name={`grupo-${gId}`}
                                  checked={checked}
                                  onChange={(event) => selecionarAdicional(grupo, adicional, event.target.checked)}
                                />
                                <span className="min-w-0 flex-1 text-base font-semibold">{adicionalNome(adicional)}</span>
                                {adicionalPreco(adicional) > 0 ? <span className="text-sm font-bold text-purple-300">+ {moeda(adicionalPreco(adicional))}</span> : null}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              ) : null}

              <button className="primary-button mt-5 w-full text-lg" type="button" onClick={confirmarModalProduto} disabled={!modalPodeAdicionar}>
                Adicionar ao carrinho
              </button>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
