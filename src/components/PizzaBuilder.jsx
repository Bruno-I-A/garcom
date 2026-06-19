import { useEffect, useMemo, useState } from 'react';
import { asArray, getGruposAdicionaisCategoria, getPizzaSabores, getPizzaTamanhos } from '../services/api.js';

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function saborId(sabor) {
  return sabor?.id ?? sabor?._id ?? sabor?.nome;
}

function grupoId(grupo) {
  return grupo?.id ?? grupo?.grupo_id ?? grupo?.nome;
}

function grupoNome(grupo) {
  return grupo?.nome || grupo?.titulo || String(grupoId(grupo));
}

function grupoTipo(grupo) {
  return String(grupo?.tipo || 'multiplo').toLowerCase() === 'unico' ? 'unico' : 'multiplo';
}

function grupoItens(grupo) {
  return asArray(grupo?.itens || grupo?.items || grupo?.adicionais || grupo?.opcoes || grupo?.options);
}

function adicionalId(item) {
  return item?.id ?? item?._id ?? item?.adicional_id ?? item?.nome;
}

function adicionalNome(item) {
  return item?.nome || item?.name || String(adicionalId(item));
}

function adicionalPreco(item) {
  return Number(item?.preco || item?.price || item?.valor || 0);
}

function maxSabores(tamanho) {
  const pedacos = Number(tamanho?.pedacos);
  return pedacos > 0 ? Math.max(1, Math.floor(pedacos / 4)) : 2;
}

function precoAdicionaisEntrada(item) {
  return asArray(item?.adicionais).reduce(
    (acc, grupo) => acc + asArray(grupo?.itens_selecionados).reduce((sum, ad) => sum + Number(ad?.preco || 0), 0),
    0
  );
}

function totalEntrada(item) {
  return Number(item?.preco || 0) + precoAdicionaisEntrada(item);
}

function saboresDaEntrada(item) {
  const grupo = asArray(item?.adicionais).find((g) => g?.grupo_id === 'sabores');
  return asArray(grupo?.itens_selecionados)
    .map((ad) => ad?.nome)
    .filter(Boolean)
    .join(', ');
}

export default function PizzaBuilder({ categoriaId, pizzasNoCarrinho = [], onAdicionar, onRemover }) {
  const [dados, setDados] = useState({ tamanhos: [], sabores: [], grupos: [], loading: true, error: '' });
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setDados((current) => ({ ...current, loading: true, error: '' }));
      try {
        const [tamanhos, sabores, grupos] = await Promise.all([
          getPizzaTamanhos(),
          getPizzaSabores(),
          categoriaId ? getGruposAdicionaisCategoria(categoriaId) : Promise.resolve([])
        ]);
        if (!active) return;
        setDados({
          tamanhos: asArray(tamanhos).filter((t) => t?.ativo !== false),
          sabores: asArray(sabores)
            .filter((s) => s?.ativo !== false)
            .sort((a, b) => Number(a?.ordem || 0) - Number(b?.ordem || 0)),
          grupos: asArray(grupos),
          loading: false,
          error: ''
        });
      } catch (err) {
        if (active) {
          setDados((current) => ({ ...current, loading: false, error: err.message || 'Não foi possível carregar as pizzas.' }));
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [categoriaId]);

  const secoesSabores = useMemo(() => {
    const salgadas = dados.sabores.filter((s) => normalizarTexto(s?.categoria) !== 'doce');
    const doces = dados.sabores.filter((s) => normalizarTexto(s?.categoria) === 'doce');
    return [
      { chave: 'salgada', titulo: 'Salgadas', itens: salgadas },
      { chave: 'doce', titulo: 'Doces', itens: doces }
    ].filter((secao) => secao.itens.length);
  }, [dados.sabores]);

  function abrirModal(tamanho) {
    setModal({ tamanho, sabores: [], selecionados: {}, observacao: '' });
  }

  const limite = modal ? maxSabores(modal.tamanho) : 0;
  const totalSabores = modal ? modal.sabores.length : 0;

  function alternarSabor(sabor) {
    const id = String(saborId(sabor));
    setModal((current) => {
      if (!current) return current;
      const jaSelecionado = current.sabores.includes(id);
      if (jaSelecionado) {
        return { ...current, sabores: current.sabores.filter((s) => s !== id) };
      }
      if (current.sabores.length >= maxSabores(current.tamanho)) return current;
      return { ...current, sabores: [...current.sabores, id] };
    });
  }

  function alternarAdicional(grupo, item, checked) {
    const gId = String(grupoId(grupo));
    const aId = String(adicionalId(item));
    setModal((current) => {
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

  function adicionaisModal() {
    if (!modal) return [];
    return dados.grupos
      .map((grupo) => {
        const gId = String(grupoId(grupo));
        const selecionado = modal.selecionados[gId];
        const ids = Array.isArray(selecionado) ? selecionado : selecionado ? [selecionado] : [];
        const itensSelecionados = grupoItens(grupo)
          .filter((item) => ids.includes(String(adicionalId(item))))
          .map((item) => ({ id: adicionalId(item), nome: adicionalNome(item), preco: adicionalPreco(item) }));
        return { grupo_id: grupoId(grupo), grupo_nome: grupoNome(grupo), itens_selecionados: itensSelecionados };
      })
      .filter((grupo) => grupo.itens_selecionados.length > 0);
  }

  const precoAdicionaisModal = modal
    ? adicionaisModal().reduce((acc, g) => acc + g.itens_selecionados.reduce((sum, i) => sum + Number(i.preco || 0), 0), 0)
    : 0;
  const totalModal = modal ? Number(modal.tamanho?.preco || 0) + precoAdicionaisModal : 0;

  function confirmar() {
    if (!modal || !modal.sabores.length) return;
    const sabores = dados.sabores.filter((s) => modal.sabores.includes(String(saborId(s))));
    const grupoSabores = {
      grupo_id: 'sabores',
      grupo_nome: 'Sabores',
      itens_selecionados: sabores.map((s) => ({ id: saborId(s), nome: s.nome, preco: 0 }))
    };
    const adicionais = [grupoSabores, ...adicionaisModal()];
    const produto = { id: `pizza-${modal.tamanho.id}`, nome: `Pizza ${modal.tamanho.nome}` };
    onAdicionar?.(produto, Number(modal.tamanho?.preco || 0), modal.observacao, adicionais);
    setModal(null);
  }

  if (dados.loading) {
    return <p className="card border-gray-700 text-center text-gray-200">Carregando pizzas...</p>;
  }

  if (dados.error) {
    return <p className="rounded-xl border border-red-500/60 bg-red-950/40 p-3 text-red-100">{dados.error}</p>;
  }

  if (!dados.tamanhos.length) {
    return <p className="card border-gray-700 text-gray-300">Pizzas indisponíveis no momento.</p>;
  }

  return (
    <div className="space-y-3">
      {dados.tamanhos.map((tamanho) => (
        <article className="rounded-xl border border-purple-400/15 bg-[#0a0610]/95 p-4 shadow-lg shadow-purple-950/20" key={tamanho.id}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">🍕 Pizza {tamanho.nome}</h2>
              <p className="mt-1 text-sm text-gray-400">
                {tamanho.pedacos ? `${tamanho.pedacos} fatias · ` : ''}até {maxSabores(tamanho)} sabores
              </p>
              <p className="mt-1 text-base font-semibold text-purple-300">{moeda(tamanho.preco)}</p>
            </div>
            <button
              className="primary-button h-14 min-h-14 rounded-xl px-5 text-base font-bold"
              type="button"
              onClick={() => abrirModal(tamanho)}
              aria-label={`Montar pizza ${tamanho.nome}`}
            >
              Montar
            </button>
          </div>
        </article>
      ))}

      {pizzasNoCarrinho.length ? (
        <div className="space-y-2">
          <p className="px-1 text-sm font-bold uppercase tracking-wide text-purple-400">Pizzas no carrinho</p>
          {pizzasNoCarrinho.map(({ key, item }) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-purple-400/15 bg-purple-500/10 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-purple-100">{item.nome}</p>
                {saboresDaEntrada(item) ? <p className="truncate text-xs text-purple-200/80">{saboresDaEntrada(item)}</p> : null}
                <p className="text-xs font-semibold text-purple-300">{moeda(totalEntrada(item) * Number(item.quantidade || 1))}</p>
              </div>
              <button
                className="secondary-button h-10 min-h-10 w-10 px-0 text-2xl"
                type="button"
                onClick={() => onRemover?.(key)}
                aria-label="Remover pizza"
              >
                -
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/75 px-4 pb-4 pt-10 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-xl border border-purple-400/25 bg-[#0a0610] p-4 shadow-2xl shadow-purple-950/50">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-white">Pizza {modal.tamanho.nome}</h2>
                <p className="mt-1 text-sm font-semibold text-purple-300">
                  {totalSabores}/{limite} sabores · {moeda(totalModal)}
                </p>
              </div>
              <button className="secondary-button h-12 min-h-12 w-12 px-0 text-2xl" type="button" onClick={() => setModal(null)} aria-label="Fechar">
                ×
              </button>
            </div>

            <div className="space-y-4">
              {secoesSabores.map((secao) => (
                <fieldset className="rounded-xl border border-purple-400/15 bg-black/30 p-3" key={secao.chave}>
                  <legend className="px-1 text-base font-black text-white">{secao.titulo}</legend>
                  <div className="mt-2 space-y-2">
                    {secao.itens.map((sabor) => {
                      const id = String(saborId(sabor));
                      const checked = modal.sabores.includes(id);
                      const bloqueado = !checked && totalSabores >= limite;
                      return (
                        <label
                          className={`flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-gray-100 ${bloqueado ? 'opacity-40' : ''}`}
                          key={id}
                        >
                          <input
                            className="h-6 w-6 accent-purple-500"
                            type="checkbox"
                            checked={checked}
                            disabled={bloqueado}
                            onChange={() => alternarSabor(sabor)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold">{sabor.nome}</span>
                            {sabor.descricao ? <span className="block text-xs text-gray-400">{sabor.descricao}</span> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              {dados.grupos.map((grupo) => {
                const gId = String(grupoId(grupo));
                const tipo = grupoTipo(grupo);
                const selecionado = modal.selecionados[gId];
                return (
                  <fieldset className="rounded-xl border border-purple-400/15 bg-black/30 p-3" key={gId}>
                    <legend className="px-1 text-base font-black text-white">{grupoNome(grupo)}</legend>
                    <div className="mt-2 space-y-2">
                      {grupoItens(grupo).map((item) => {
                        const aId = String(adicionalId(item));
                        const checked = tipo === 'unico' ? selecionado === aId : Array.isArray(selecionado) && selecionado.includes(aId);
                        return (
                          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-gray-100" key={aId}>
                            <input
                              className="h-6 w-6 accent-purple-500"
                              type={tipo === 'unico' ? 'radio' : 'checkbox'}
                              name={`pizza-grupo-${gId}`}
                              checked={checked}
                              onChange={(event) => alternarAdicional(grupo, item, event.target.checked)}
                            />
                            <span className="min-w-0 flex-1 text-base font-semibold">{adicionalNome(item)}</span>
                            {adicionalPreco(item) > 0 ? <span className="text-sm font-bold text-purple-300">+ {moeda(adicionalPreco(item))}</span> : null}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}

              <label className="block">
                <span className="mb-2 block text-base font-bold text-gray-300">Observação</span>
                <textarea
                  className="field min-h-20 py-3"
                  value={modal.observacao}
                  onChange={(event) => setModal((current) => (current ? { ...current, observacao: event.target.value } : current))}
                  placeholder="Ex: sem cebola, bem assada"
                />
              </label>
            </div>

            <button className="primary-button mt-5 w-full text-lg" type="button" onClick={confirmar} disabled={!totalSabores}>
              Adicionar ao carrinho · {moeda(totalModal)}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
