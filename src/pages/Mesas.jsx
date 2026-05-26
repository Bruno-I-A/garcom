import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { asArray, getMesas, getPedidosAbertos } from '../services/api.js';

function mesaDoPedido(pedido) {
  return String(pedido?.mesa || pedido?.numero_mesa || pedido?.mesa_numero || '');
}

function pedidoAberto(pedido) {
  return ['novo', 'preparando'].includes(String(pedido?.status || '').toLowerCase());
}

export default function Mesas() {
  const navigate = useNavigate();
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [mesasData, pedidosData] = await Promise.all([getMesas(), getPedidosAbertos()]);
        if (active) {
          setMesas(
            asArray(mesasData)
              .filter((mesa) => mesa?.ativo === true)
              .sort((a, b) => Number(a?.numero || 0) - Number(b?.numero || 0))
          );
          setPedidos(asArray(pedidosData));
        }
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível carregar as mesas.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const mesasOcupadas = useMemo(() => {
    return new Set(pedidos.filter(pedidoAberto).map(mesaDoPedido).filter(Boolean));
  }, [pedidos]);

  return (
    <main className="app-shell">
      <div className="mobile-page">
        <Header title="Mesas" showLogout />

        {loading ? <p className="card border-gray-700 text-center text-gray-200">Carregando mesas...</p> : null}
        {error ? <p className="card border-red-500/60 bg-red-950/40 text-red-100">{error}</p> : null}

        <section className="grid grid-cols-2 gap-3 pb-4">
          {!loading && !mesas.length ? <p className="card col-span-2 text-gray-300">Nenhuma mesa ativa encontrada.</p> : null}

          {mesas.map((mesa) => {
            const numero = mesa?.numero;
            const ocupada = mesasOcupadas.has(String(numero));
            return (
              <button
                key={mesa?.id || numero}
                className={`relative min-h-32 overflow-hidden rounded-xl border p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 active:scale-[0.98] ${
                  ocupada ? 'border-purple-400/70 bg-purple-950/25' : 'border-purple-400/15 bg-[#0a0610]/95 hover:border-purple-300/30'
                }`}
                type="button"
                onClick={() => navigate(`/mesa/${numero}`)}
              >
                {ocupada ? <span className="absolute inset-x-0 top-0 h-1 bg-shiftsys-orange shadow-[0_0_18px_rgba(168,85,247,0.9)]" /> : null}
                <span className="block text-sm font-bold uppercase tracking-wide text-gray-400">Mesa</span>
                <span className="mt-2 block text-5xl font-black text-white">{numero}</span>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-bold ${ocupada ? 'bg-purple-500/15 text-purple-200' : 'bg-white/5 text-gray-300'}`}>
                  {ocupada ? 'Ocupada' : 'Livre'}
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </main>
  );
}
