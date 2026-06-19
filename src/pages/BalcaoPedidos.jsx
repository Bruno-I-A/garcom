import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { asArray, getPedidosAbertos } from '../services/api.js';

function getPedidoId(pedido) {
  return pedido?.id || pedido?._id || pedido?.pedido_id;
}

function semMesa(pedido) {
  return !String(pedido?.mesa || pedido?.numero_mesa || pedido?.mesa_numero || '').trim();
}

function pedidoAberto(pedido) {
  return ['novo', 'preparando'].includes(String(pedido?.status || '').toLowerCase());
}

function itensDoPedido(pedido) {
  return asArray(pedido?.itens || pedido?.items);
}

function clienteDoPedido(pedido) {
  return pedido?.nome_cliente || pedido?.cliente_nome || pedido?.cliente || '';
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BalcaoPedidos() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getPedidosAbertos();
        if (active) setPedidos(asArray(data).filter((pedido) => semMesa(pedido) && pedidoAberto(pedido)));
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível carregar os pedidos.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="app-shell">
      <div className="mobile-page">
        <Header title="Pedidos Balcão" showBack />

        {loading ? <p className="card border-gray-700 text-center text-gray-200">Carregando pedidos...</p> : null}
        {error ? <p className="mb-4 rounded-xl border border-red-500/60 bg-red-950/40 p-3 text-red-100">{error}</p> : null}

        <section className="pb-4">
          <button
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-400/40 bg-emerald-950/25 px-5 py-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 active:scale-[0.98]"
            type="button"
            onClick={() => navigate('/balcao')}
          >
            <span className="text-lg font-black text-emerald-200">+ Novo pedido balcão</span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-300">→</span>
          </button>
        </section>

        <section className="space-y-3 pb-6">
          {!loading && !pedidos.length ? (
            <p className="card border-gray-700 text-gray-300">Nenhum pedido de balcão em aberto.</p>
          ) : null}

          {pedidos.map((pedido) => {
            const id = getPedidoId(pedido);
            const cliente = clienteDoPedido(pedido).trim();
            const tipo = String(pedido?.tipo_entrega || '').toLowerCase() === 'delivery' ? 'Delivery' : 'Balcão';
            const qtdItens = itensDoPedido(pedido).reduce((acc, item) => acc + Number(item?.quantidade || 0), 0);
            const total = Number(
              pedido?.total ?? itensDoPedido(pedido).reduce((acc, item) => acc + Number(item?.preco || 0) * Number(item?.quantidade || 0), 0)
            );
            return (
              <button
                key={id}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-purple-400/15 bg-[#0a0610]/95 p-4 text-left shadow-lg shadow-purple-950/20 transition hover:-translate-y-0.5 hover:border-purple-300/30 active:scale-[0.98]"
                type="button"
                onClick={() => navigate(`/balcao/pedido/${id}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-bold text-white">Pedido #{id}</h2>
                    <span className="shrink-0 rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-bold text-purple-200">{tipo}</span>
                  </div>
                  {cliente ? <p className="mt-1 truncate text-sm text-gray-400">{cliente}</p> : null}
                  <p className="mt-1 text-sm text-gray-400">
                    {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} · <span className="font-semibold text-purple-300">{moeda(total)}</span>
                  </p>
                </div>
                <span className="shrink-0 text-2xl font-black text-purple-300">›</span>
              </button>
            );
          })}
        </section>
      </div>
    </main>
  );
}
