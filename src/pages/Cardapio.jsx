import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { adicionarItensPedido, asArray, criarPedido, getCardapio, getCategorias, getGarcom, getPedidosAbertos } from '../services/api.js';

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
  const value = String(nome || '').toLowerCase();
  const fallback = [
    { icon: '🍽️', tone: 'from-orange-500/25 to-amber-400/10' },
    { icon: '🍔', tone: 'from-red-500/25 to-orange-400/10' },
    { icon: '🍗', tone: 'from-amber-500/25 to-orange-400/10' },
    { icon: '🍟', tone: 'from-yellow-500/25 to-orange-400/10' }
  ];

  if (value.includes('bebida') || value.includes('suco') || value.includes('drink') || value.includes('refri')) {
    return { icon: '🥤', tone: 'from-cyan-500/25 to-blue-400/10' };
  }
  if (value.includes('xis') || value.includes('lanche') || value.includes('burger') || value.includes('burguer') || value.includes('hamb')) {
    return { icon: '🍔', tone: 'from-red-500/25 to-orange-400/10' };
  }
  if (value.includes('combo')) {
    return { icon: '🍱', tone: 'from-emerald-500/25 to-lime-400/10' };
  }
  if (value.includes('frango')) {
    return { icon: '🍗', tone: 'from-amber-500/25 to-orange-400/10' };
  }
  if (value.includes('porç') || value.includes('porc')) {
    return { icon: '🍟', tone: 'from-yellow-500/25 to-orange-400/10' };
  }
  if (value.includes('sobremesa') || value.includes('doce')) {
    return { icon: '🍮', tone: 'from-pink-500/25 to-rose-400/10' };
  }
  if (value.includes('pizza')) {
    return { icon: '🍕', tone: 'from-red-500/25 to-yellow-400/10' };
  }
  if (value.includes('cafe') || value.includes('caf')) {
    return { icon: '☕', tone: 'from-stone-500/25 to-orange-400/10' };
  }
  if (value.includes('prato') || value.includes('refei')) {
    return { icon: '🍽️', tone: 'from-orange-500/25 to-amber-400/10' };
  }
  return fallback[index % fallback.length];
}

export default function Cardapio() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null);
  const [cart, setCart] = useState({});
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

  const categoriaAtual = useMemo(() => {
    return categoriasOrdenadas.find((categoria) => categoria.id === categoriaSelecionada) || null;
  }, [categoriaSelecionada, categoriasOrdenadas]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const quantidade = useMemo(() => cartItems.reduce((acc, item) => acc + item.quantidade, 0), [cartItems]);
  const total = useMemo(() => cartItems.reduce((acc, item) => acc + Number(item.preco || 0) * item.quantidade, 0), [cartItems]);

  function addProduto(produto) {
    const id = produtoId(produto);
    setCart((current) => ({
      ...current,
      [id]: {
        id,
        nome: produto?.nome || produto?.name || 'Produto',
        preco: Number(produto?.preco || produto?.price || 0),
        quantidade: (current[id]?.quantidade || 0) + 1
      }
    }));
  }

  async function confirmarPedido() {
    if (!cartItems.length) {
      setError('Adicione pelo menos um item ao pedido.');
      return;
    }

    const garcom = getGarcom() || {};
    const pedido = {
      itens: cartItems,
      total,
      tipo_entrega: 'mesa',
      mesa: String(numero),
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
      const pedidos = asArray(await getPedidosAbertos());
      const pedidoExistente = pedidos.find((item) => mesaDoPedido(item) === String(numero) && pedidoAberto(item));
      const pedidoExistenteId = pedidoId(pedidoExistente);

      if (pedidoExistenteId) {
        await adicionarItensPedido(pedidoExistenteId, cartItems);
      } else {
        await criarPedido(pedido);
      }

      navigate(`/mesa/${numero}`, { replace: true });
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
          <Header title={`Cardápio - Mesa ${numero}`} showBack />
        ) : (
          <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-white/10 bg-[#0f1117]/95 px-4 py-4 shadow-lg shadow-black/10 backdrop-blur">
            <div className="flex min-h-12 items-center gap-3">
              <button className="secondary-button min-w-12 px-3" type="button" onClick={() => setCategoriaSelecionada(null)} aria-label="Voltar para categorias">
                ←
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-black text-white">{categoriaAtual.nome}</h1>
                <p className="truncate text-sm text-gray-400">Mesa {numero}</p>
              </div>
            </div>
          </header>
        )}

        {loading ? <p className="card border-gray-700 text-center text-gray-200">Carregando cardápio...</p> : null}
        {error ? <p className="mb-4 rounded-xl border border-red-500/60 bg-red-950/40 p-3 text-red-100">{error}</p> : null}

        {!categoriaAtual ? (
          <section className={quantidade ? 'grid grid-cols-2 gap-3 pb-32' : 'grid grid-cols-2 gap-3 pb-6'}>
            {!loading && !categoriasOrdenadas.length ? <p className="card col-span-2 border-gray-700 text-gray-300">Nenhuma categoria encontrada.</p> : null}

            {categoriasOrdenadas.map((categoria) => (
              <button className="group relative min-h-36 overflow-hidden rounded-xl border border-white/10 bg-[#171a22]/95 p-4 text-left shadow-lg shadow-black/25 transition hover:-translate-y-0.5 hover:border-orange-400/60 active:scale-[0.98]" type="button" key={categoria.id} onClick={() => setCategoriaSelecionada(categoria.id)}>
                <span className={`absolute inset-0 bg-gradient-to-br ${categoria.visual.tone}`} aria-hidden="true" />
                <span className="relative flex h-full min-h-28 flex-col justify-between">
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-3xl shadow-inner shadow-white/5" aria-hidden="true">
                      {categoria.visual.icon}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-lg font-black text-orange-200">›</span>
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
                const item = cart[id];
                const preco = Number(produto?.preco || produto?.price || 0);
                return (
                  <article className="rounded-xl border border-white/10 bg-[#171a22]/95 p-4 shadow-lg shadow-black/20" key={id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-white">{produto?.nome || produto?.name || 'Produto'}</h2>
                        <p className="mt-1 text-base font-semibold text-orange-300">{moeda(preco)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item ? <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-orange-500/15 px-2 text-lg font-black text-orange-200">{item.quantidade}</span> : null}
                        <button className="primary-button h-14 min-h-14 w-14 rounded-xl px-0 text-3xl" type="button" onClick={() => addProduto(produto)} aria-label={`Adicionar ${produto?.nome || 'produto'}`}>
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="card border-gray-700 text-gray-300">Nenhum item nesta categoria.</p>
            )}
          </section>
        )}

        {quantidade ? (
          <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-orange-500/20 bg-[#0f1117]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur">
            <button className="primary-button w-full justify-between rounded-xl px-5" type="button" onClick={confirmarPedido} disabled={saving}>
              <span>{saving ? 'Enviando...' : `Confirmar ${quantidade} item${quantidade === 1 ? '' : 's'}`}</span>
              <span>{moeda(total)}</span>
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
