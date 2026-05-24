import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { asArray, atualizarPedidoStatus, getPedidosAbertos } from '../services/api.js';

function getPedidoId(pedido) {
  return pedido?.id || pedido?._id || pedido?.pedido_id;
}

function itensDoPedido(pedido) {
  return asArray(pedido?.itens || pedido?.items);
}

function pedidoAberto(pedido) {
  const status = String(pedido?.status || '').toLowerCase();
  return status !== 'entregue' && status !== 'cancelado';
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Mesa() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPedido() {
      setLoading(true);
      setError('');
      try {
        const data = await getPedidosAbertos();
        const pedidos = asArray(data);
        const atual = pedidos.find((item) => {
          const mesa = String(item?.mesa || item?.numero_mesa || item?.mesa_numero || '');
          return mesa === String(numero) && pedidoAberto(item);
        });
        setPedido(atual || null);
      } catch (err) {
        setError(err.message || 'Não foi possível carregar a mesa.');
      } finally {
        setLoading(false);
      }
    }

    loadPedido();
  }, [numero]);

  const itens = useMemo(() => itensDoPedido(pedido), [pedido]);
  const total = useMemo(() => {
    return Number(pedido?.total ?? itens.reduce((acc, item) => acc + Number(item?.preco || 0) * Number(item?.quantidade || 0), 0));
  }, [itens, pedido]);

  async function updateStatus(status) {
    const pedidoId = getPedidoId(pedido);
    if (!pedidoId) {
      setError('Não foi possível identificar o pedido para atualizar.');
      return;
    }

    const label = status === 'entregue' ? 'fechar' : 'cancelar';
    if (!window.confirm(`Confirmar ${label} pedido da mesa ${numero}?`)) return;

    setSaving(true);
    setError('');
    try {
      await atualizarPedidoStatus(pedidoId, status);
      navigate('/mesas', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar o pedido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="mobile-page">
        <Header title={`Mesa ${numero}`} showBack />

        {loading ? <p className="card border-gray-700 text-center text-gray-200">Carregando pedido...</p> : null}
        {error ? <p className="mb-4 rounded-xl border border-red-500/60 bg-red-950/40 p-3 text-red-100">{error}</p> : null}

        {!loading && !pedido ? (
          <section className="pt-10">
            <div className="card border-gray-700 text-center">
              <p className="text-xl font-bold text-white">Mesa livre</p>
              <p className="mt-2 text-gray-400">Abra um novo pedido para começar.</p>
            </div>
            <button className="primary-button mt-5 w-full text-xl" type="button" onClick={() => navigate(`/mesa/${numero}/cardapio`)}>
              Novo Pedido
            </button>
          </section>
        ) : null}

        {!loading && pedido ? (
          <section className="space-y-4 pb-40">
            <div className="space-y-3">
              {itens.length ? (
                itens.map((item, index) => (
                  <article className="card border-gray-700" key={`${item?.id || item?.nome || index}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-white">{item?.nome || 'Item'}</h2>
                        <p className="mt-1 text-gray-400">Qtd. {item?.quantidade || 0}</p>
                      </div>
                      <strong className="whitespace-nowrap text-lg text-orange-300">
                        {moeda(Number(item?.preco || 0) * Number(item?.quantidade || 0))}
                      </strong>
                    </div>
                  </article>
                ))
              ) : (
                <p className="card border-gray-700 text-gray-300">Pedido sem itens cadastrados.</p>
              )}
            </div>

            <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-gray-800 bg-gray-950/95 p-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between text-xl font-black">
                <span>Total</span>
                <span className="text-orange-300">{moeda(total)}</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button className="primary-button" type="button" onClick={() => navigate(`/mesa/${numero}/cardapio`)}>
                  Adicionar Itens
                </button>
                <button className="secondary-button" type="button" onClick={() => updateStatus('entregue')} disabled={saving}>
                  {saving ? 'Atualizando...' : 'Fechar Pedido'}
                </button>
                <button className="danger-button" type="button" onClick={() => updateStatus('cancelado')} disabled={saving}>
                  Cancelar Pedido
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
