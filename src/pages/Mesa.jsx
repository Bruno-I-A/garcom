import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { asArray, atualizarPedidoStatus, getPedidosAbertos, imprimirItensPedido, itemNovoParaImpressao, itensNovosParaImpressao, marcarItensComoImpressos, removerItemPedido } from '../services/api.js';

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
  const [printing, setPrinting] = useState(false);
  const [removendo, setRemovendo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const printSubmitRef = useRef(false);

  useEffect(() => {
    async function loadPedido() {
      setLoading(true);
      setError('');
      setSuccess('');
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
  const pedidoIdAtual = getPedidoId(pedido);
  const itensNovos = useMemo(() => itensNovosParaImpressao(pedidoIdAtual, itens), [pedidoIdAtual, itens]);
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
    setSuccess('');
    try {
      await atualizarPedidoStatus(pedidoId, status);
      navigate('/mesas', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar o pedido.');
    } finally {
      setSaving(false);
    }
  }

  async function imprimirPedido() {
    if (printing || printSubmitRef.current) return;
    const pedidoId = getPedidoId(pedido);
    if (!pedidoId) {
      setError('Erro ao enviar para impressão');
      setSuccess('');
      return;
    }

    const novos = itensNovosParaImpressao(pedidoId, itens);
    if (!novos.length) {
      setError('');
      setSuccess('Nenhum item novo para imprimir.');
      return;
    }

    printSubmitRef.current = true;
    setPrinting(true);
    setError('');
    setSuccess('');
    try {
      await imprimirItensPedido(pedidoId, novos);
      const impressos = marcarItensComoImpressos(pedidoId, novos);
      setPedido((atual) => {
        if (!atual) return atual;
        const itensImpressos = new Set(novos);
        const idsImpressos = new Set(impressos.map((item) => item?.id || item?._id || item?.item_id || item?.client_uid).filter(Boolean));
        const itensAtualizados = itensDoPedido(atual).map((item) => {
          const itemId = item?.id || item?._id || item?.item_id || item?.client_uid;
          return itensImpressos.has(item) || idsImpressos.has(itemId) ? { ...item, status_impressao: 'impresso', impressao_status: 'impresso', novo: false, impresso: true } : item;
        });
        return { ...atual, itens: itensAtualizados };
      });
      setSuccess('Pedido enviado para impressão');
    } catch {
      setError('Erro ao enviar para impressão');
    } finally {
      setPrinting(false);
      window.setTimeout(() => {
        printSubmitRef.current = false;
      }, 1500);
    }
  }

  async function removerItem(item) {
    const pedidoId = getPedidoId(pedido);
    const itemId = item?.id || item?._id || item?.item_id;
    if (!pedidoId || !itemId) {
      setError('Não foi possível identificar o item para remover.');
      return;
    }

    if (!window.confirm(`Remover "${item?.nome || 'item'}" do pedido?`)) return;

    const itensRestantes = itensDoPedido(pedido).filter((i) => (i?.id || i?._id || i?.item_id) !== itemId);

    setRemovendo(itemId);
    setError('');
    setSuccess('');
    try {
      await removerItemPedido(pedidoId, itemId, itensRestantes);
      setPedido((atual) => {
        if (!atual) return atual;
        return { ...atual, itens: itensRestantes };
      });
    } catch (err) {
      setError(err.message || 'Não foi possível remover o item.');
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <main className="app-shell">
      <div className="mobile-page">
        <Header title={`Mesa ${numero}`} showBack />

        {loading ? <p className="card border-gray-700 text-center text-gray-200">Carregando pedido...</p> : null}
        {error ? <p className="mb-4 rounded-xl border border-red-500/60 bg-red-950/40 p-3 text-red-100">{error}</p> : null}
        {success ? <p className="mb-4 rounded-xl border border-emerald-500/60 bg-emerald-950/40 p-3 text-emerald-100">{success}</p> : null}

        {!loading && !pedido ? (
          <section className="pt-10">
            <div className="card text-center">
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
                itens.map((item, index) => {
                  const itemId = item?.id || item?._id || item?.item_id;
                  const estaRemovendo = removendo === itemId;
                  return (
                    <article className="card" key={`${itemId || item?.nome || index}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-bold text-white">{item?.nome || 'Item'}</h2>
                          <p className="mt-1 text-gray-400">Qtd. {item?.quantidade || 0}</p>
                          {itemNovoParaImpressao(pedidoIdAtual, item) ? (
                            <span className="mt-2 inline-flex rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-emerald-200">
                              Novo
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3">
                          <strong className="whitespace-nowrap text-lg text-purple-300">
                            {moeda(Number(item?.preco || 0) * Number(item?.quantidade || 0))}
                          </strong>
                          <button
                            className="danger-button h-10 min-h-10 w-10 shrink-0 px-0 text-xl"
                            type="button"
                            onClick={() => removerItem(item)}
                            disabled={!!removendo || saving}
                            aria-label={`Remover ${item?.nome || 'item'}`}
                          >
                            {estaRemovendo ? '…' : '×'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="card text-gray-300">Pedido sem itens cadastrados.</p>
              )}
            </div>

            <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-purple-500/25 bg-black/95 p-4 shadow-2xl shadow-purple-950/30 backdrop-blur">
              <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xl font-black">
                <span className="text-gray-200">Total</span>
                <span className="text-purple-300">{moeda(total)}</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button className="primary-button" type="button" onClick={() => navigate(`/mesa/${numero}/cardapio`)}>
                  Adicionar Itens
                </button>
                <button className="outline-button gap-2" type="button" onClick={imprimirPedido} disabled={printing || saving}>
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M6 9V2h12v7" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <path d="M6 14h12v8H6z" />
                  </svg>
                  {printing ? 'Enviando...' : `Imprimir Novos (${itensNovos.length})`}
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
