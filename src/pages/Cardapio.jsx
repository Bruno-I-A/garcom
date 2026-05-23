import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { asArray, criarPedido, getCardapio, getCategorias, getGarcom } from '../services/api.js';

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function produtoId(produto) {
  return produto?.id || produto?._id || produto?.produto_id || produto?.nome;
}

function categoriaId(categoria) {
  return categoria?.id || categoria?._id || categoria?.categoria_id || categoria?.nome;
}

function produtoCategoria(produto) {
  return produto?.categoria_id || produto?.categoriaId || produto?.categoria || produto?.categoria_nome || 'Sem categoria';
}

export default function Cardapio() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
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

    produtos.forEach((produto) => {
      const key = String(produtoCategoria(produto));
      const categoria = byId.get(key);
      const nomeCategoria = categoria?.nome || produto?.categoria_nome || produto?.categoria?.nome || key;

      if (!groups.has(nomeCategoria)) groups.set(nomeCategoria, []);
      groups.get(nomeCategoria).push(produto);
    });

    return Array.from(groups.entries()).map(([nome, items]) => ({ nome, items }));
  }, [categorias, produtos]);

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

  function removeProduto(id) {
    setCart((current) => {
      const next = { ...current };
      if (!next[id]) return current;
      if (next[id].quantidade <= 1) {
        delete next[id];
      } else {
        next[id] = { ...next[id], quantidade: next[id].quantidade - 1 };
      }
      return next;
    });
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
      await criarPedido(pedido);
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
        <Header title={`Cardápio - Mesa ${numero}`} showBack />

        {loading ? <p className="card border-gray-700 text-center text-gray-200">Carregando cardápio...</p> : null}
        {error ? <p className="mb-4 rounded-xl border border-red-500/60 bg-red-950/40 p-3 text-red-100">{error}</p> : null}

        <section className="space-y-6 pb-32">
          {!loading && !categoriasOrdenadas.length ? <p className="card border-gray-700 text-gray-300">Nenhum produto encontrado.</p> : null}

          {categoriasOrdenadas.map((categoria) => (
            <div key={categoria.nome}>
              <h2 className="mb-3 text-xl font-black text-white">{categoria.nome}</h2>
              <div className="space-y-3">
                {categoria.items.map((produto) => {
                  const id = produtoId(produto);
                  const item = cart[id];
                  const preco = Number(produto?.preco || produto?.price || 0);
                  return (
                    <article className="card border-gray-700" key={id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-bold text-white">{produto?.nome || produto?.name || 'Produto'}</h3>
                          <p className="mt-1 text-base font-semibold text-orange-300">{moeda(preco)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item ? (
                            <button className="secondary-button h-12 min-h-12 w-12 px-0" type="button" onClick={() => removeProduto(id)}>
                              -
                            </button>
                          ) : null}
                          {item ? <span className="w-7 text-center text-lg font-black">{item.quantidade}</span> : null}
                          <button className="primary-button h-12 min-h-12 w-12 px-0 text-2xl" type="button" onClick={() => addProduto(produto)}>
                            +
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-gray-800 bg-gray-950/95 p-4 backdrop-blur">
          <button className="primary-button w-full justify-between" type="button" onClick={confirmarPedido} disabled={saving || !quantidade}>
            <span>{saving ? 'Enviando...' : `Confirmar ${quantidade} item${quantidade === 1 ? '' : 's'}`}</span>
            <span>{moeda(total)}</span>
          </button>
        </div>
      </div>
    </main>
  );
}
