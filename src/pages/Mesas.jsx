import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { asArray, getPedidosAbertos } from '../services/api.js';

const MESAS = Array.from({ length: 20 }, (_, index) => index + 1);

function mesaDoPedido(pedido) {
  return String(pedido?.mesa || pedido?.numero_mesa || pedido?.mesa_numero || '');
}

function pedidoAberto(pedido) {
  return ['novo', 'preparando'].includes(String(pedido?.status || '').toLowerCase());
}

export default function Mesas() {
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
        if (active) setPedidos(asArray(data));
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
          {MESAS.map((numero) => {
            const ocupada = mesasOcupadas.has(String(numero));
            return (
              <button
                key={numero}
                className={`card min-h-32 text-left transition active:scale-[0.98] ${
                  ocupada ? 'border-shiftsys-orange bg-orange-950/30' : 'border-gray-700 bg-gray-900'
                }`}
                type="button"
                onClick={() => navigate(`/mesa/${numero}`)}
              >
                <span className="block text-lg font-semibold text-gray-300">Mesa</span>
                <span className="mt-1 block text-5xl font-black text-white">{numero}</span>
                <span className={`mt-3 block text-base font-bold ${ocupada ? 'text-orange-300' : 'text-gray-400'}`}>
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
