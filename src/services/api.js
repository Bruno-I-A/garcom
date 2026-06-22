const API_URL = import.meta.env.VITE_API_URL || 'https://agentes-agente-restaurante.feit1k.easypanel.host';
const TOKEN_KEY = 'shiftsys_garcom_token';
const GARCOM_KEY = 'shiftsys_garcom';
const PRINTED_ITEMS_KEY = 'shiftsys_garcom_itens_impressos';
const DEMO_TOKEN = 'demo-token';

function friendlyError(error) {
  if (error?.message) return error.message;
  return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
}

function getStoredJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getGarcom() {
  return getStoredJson(GARCOM_KEY);
}

export function getGarcomNome(garcom = getGarcom()) {
  if (typeof garcom === 'string') return garcom;
  return (
    garcom?.nome ||
    garcom?.name ||
    garcom?.nome_completo ||
    garcom?.nomeCompleto ||
    garcom?.nome_garcom ||
    garcom?.garcom_nome ||
    garcom?.usuario ||
    garcom?.username ||
    garcom?.login ||
    'Garçom'
  );
}

export function isDemoSession() {
  return getToken() === DEMO_TOKEN;
}

export function saveSession(token, garcom) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(GARCOM_KEY, JSON.stringify(garcom));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(GARCOM_KEY);
}

function normalizeLoginResponse(data) {
  const token = data?.token || data?.jwt || data?.access_token;
  const garcomData = data?.garcom || data?.usuario || data?.user || data;
  const garcom = typeof garcomData === 'string' ? { usuario: garcomData } : garcomData;
  return { token, garcom };
}

async function request(path, options = {}) {
  const token = getToken();
  const method = String(options.method || 'GET').toUpperCase();
  const requestPath = method === 'GET' ? `${path}${path.includes('?') ? '&' : '?'}_=${Date.now()}` : path;
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_URL}${requestPath}`, {
      ...options,
      cache: method === 'GET' ? 'no-store' : 'default',
      headers
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const message = payload?.message || payload?.erro || payload?.error || 'O servidor recusou a solicitação.';
      throw new Error(message);
    }

    return payload;
  } catch (error) {
    throw new Error(friendlyError(error));
  }
}

export async function login(usuario, senha) {
  if (usuario === 'demo' && senha === 'demo') {
    const session = {
      token: DEMO_TOKEN,
      garcom: {
        id: 'demo',
        nome: 'Garçom Demo',
        usuario: 'demo'
      }
    };
    saveSession(session.token, session.garcom);
    return session;
  }

  const data = await request('/garcom/login', {
    method: 'POST',
    body: JSON.stringify({ usuario, senha })
  });
  const session = normalizeLoginResponse(data);

  if (!session.token) {
    throw new Error('Login realizado, mas o token não foi retornado pela API.');
  }

  if (session.garcom && typeof session.garcom === 'object' && !session.garcom.usuario) {
    session.garcom.usuario = usuario;
  }

  saveSession(session.token, session.garcom);
  return session;
}

function mergePedidos(pedidos) {
  const seen = new Set();
  return pedidos.flatMap(asArray).filter((pedido) => {
    const id = pedido?.id || pedido?._id || pedido?.pedido_id || JSON.stringify(pedido);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function getPedidosAbertos() {
  if (isDemoSession()) {
    return [
      {
        id: 'demo-pedido-1',
        mesa: '3',
        status: 'novo',
        itens: [
          { id: 'demo-1', nome: 'Hambúrguer da casa', preco: 32.9, quantidade: 2 },
          { id: 'demo-2', nome: 'Suco natural', preco: 12, quantidade: 2 }
        ],
        total: 89.8
      }
    ];
  }

  const [novos, preparando] = await Promise.all([
    request('/pedidos?origem=garcom&status=novo'),
    request('/pedidos?origem=garcom&status=preparando')
  ]);
  return mergePedidos([novos, preparando]);
}

export function getMesas() {
  if (isDemoSession()) {
    return Promise.resolve(Array.from({ length: 20 }, (_, index) => ({ id: index + 1, numero: index + 1, ativo: true })));
  }

  return request('/mesas');
}

export function getCategorias() {
  if (isDemoSession()) {
    return Promise.resolve([
      { id: 'lanches', nome: 'Lanches' },
      { id: 'bebidas', nome: 'Bebidas' },
      { id: 'sobremesas', nome: 'Sobremesas' }
    ]);
  }

  return request('/categorias');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function productCategoryId(produto) {
  const categoria = produto?.categoria;
  if (produto?.categoria_id != null) return produto.categoria_id;
  if (produto?.categoriaId != null) return produto.categoriaId;
  if (categoria && typeof categoria === 'object') return categoria.id || categoria._id || categoria.categoria_id || categoria.nome;
  return categoria || produto?.categoria_nome || 'Sem categoria';
}

// App do garcom mostra tudo que esta ativo/disponivel, SEM filtro de horario.
// O backend manda `disponivel_agora: false` fora da janela (ex.: vianda fora do
// almoco); aqui ignoramos essa flag de propósito para nunca esconder por horario.
function isAvailableProduct(produto) {
  return produto?.disponivel !== false && produto?.ativo !== false;
}

// Mostra exatamente os itens cadastrados no admin (sem dedup). So filtra
// indisponiveis e normaliza categoria_id para leitura consistente no app
// (e para o item carregar a categoria, usada no filtro de bebida da impressao).
function normalizeCardapio(data) {
  return asArray(data)
    .filter(isAvailableProduct)
    .map((produto) => ({ ...produto, categoria_id: productCategoryId(produto) }));
}

export async function getCardapio() {
  if (isDemoSession()) {
    return Promise.resolve([
      { id: 'burger', nome: 'Hambúrguer da casa', preco: 32.9, categoria_id: 'lanches' },
      { id: 'batata', nome: 'Batata rústica', preco: 18.5, categoria_id: 'lanches' },
      { id: 'suco', nome: 'Suco natural', preco: 12, categoria_id: 'bebidas' },
      { id: 'refri', nome: 'Refrigerante lata', preco: 8, categoria_id: 'bebidas' },
      { id: 'pudim', nome: 'Pudim', preco: 14.9, categoria_id: 'sobremesas' }
    ]);
  }

  return normalizeCardapio(await request('/cardapio'));
}

export function getGruposAdicionaisCategoria(categoriaId) {
  if (isDemoSession()) {
    if (String(categoriaId) !== 'lanches') return Promise.resolve([]);

    return Promise.resolve([
      {
        id: 'ponto',
        nome: 'Ponto da carne',
        tipo: 'unico',
        obrigatorio: true,
        itens: [
          { id: 'mal', nome: 'Mal passado', preco: 0 },
          { id: 'ponto-casa', nome: 'Ao ponto', preco: 0 },
          { id: 'bem', nome: 'Bem passado', preco: 0 }
        ]
      },
      {
        id: 'extras',
        nome: 'Extras',
        tipo: 'multiplo',
        obrigatorio: false,
        itens: [
          { id: 'bacon', nome: 'Bacon', preco: 6 },
          { id: 'queijo', nome: 'Queijo extra', preco: 4 }
        ]
      }
    ]);
  }

  return request(`/grupos-adicionais/categoria/${categoriaId}`);
}

export function getPizzaTamanhos() {
  if (isDemoSession()) {
    return Promise.resolve([
      { id: 1, nome: 'Pequena', pedacos: 12, preco: '60.00', ativo: true },
      { id: 2, nome: 'Grande', pedacos: 16, preco: '75.00', ativo: true }
    ]);
  }

  return request('/pizza/tamanhos');
}

export function getPizzaSabores() {
  if (isDemoSession()) {
    return Promise.resolve([
      { id: 1, nome: 'Calabresa', categoria: 'salgada', descricao: 'Molho, mussarela, calabresa e orégano.', ativo: true, ordem: 1 },
      { id: 2, nome: 'Mussarela', categoria: 'salgada', descricao: 'Molho, mussarela e orégano.', ativo: true, ordem: 2 },
      { id: 3, nome: 'Portuguesa', categoria: 'salgada', descricao: 'Molho, mussarela, presunto, tomate, cebola, ovo e pimentão.', ativo: true, ordem: 3 },
      { id: 4, nome: 'Sonho de Valsa', categoria: 'doce', descricao: 'Chocolate e Sonho de Valsa.', ativo: true, ordem: 4 }
    ]);
  }

  return request('/pizza/sabores');
}

function precoAdicionaisItem(item) {
  return asArray(item?.adicionais).reduce(
    (acc, grupo) => acc + asArray(grupo?.itens_selecionados).reduce((sum, ad) => sum + Number(ad?.preco || 0), 0),
    0
  );
}

function itemCategoriaId(item) {
  const categoria = item?.categoria;
  if (item?.categoria_id != null) return item.categoria_id;
  if (item?.categoriaId != null) return item.categoriaId;
  if (categoria && typeof categoria === 'object') return categoria.id || categoria._id || categoria.categoria_id || categoria.nome;
  return categoria || item?.categoria_nome || null;
}

function isBebidaItem(item) {
  return String(itemCategoriaId(item)) === '70' || normalizeText(item?.categoria_nome || item?.categoria?.nome).includes('bebida');
}

function itemPrintKey(item) {
  return String(
    item?.client_uid ||
      item?.uid_cliente ||
      item?.item_uid ||
      item?.id ||
      item?._id ||
      item?.item_id ||
      `${item?.nome || item?.name || 'item'}|${item?.preco || 0}|${item?.quantidade || 0}|${item?.observacao || ''}`
  );
}

function getPrintedItems() {
  try {
    return JSON.parse(localStorage.getItem(PRINTED_ITEMS_KEY) || '{}');
  } catch {
    return {};
  }
}

function setPrintedItems(value) {
  localStorage.setItem(PRINTED_ITEMS_KEY, JSON.stringify(value));
}

function withNewPrintStatus(item, imprimir) {
  return {
    ...item,
    imprimir,
    imprimir_cozinha: imprimir,
    client_uid: item?.client_uid || item?.uid_cliente || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    status_impressao: 'novo',
    impressao_status: 'novo',
    novo: true,
    impresso: false
  };
}

export function itemJaImpresso(pedidoId, item) {
  const status = normalizeText(item?.status_impressao || item?.impressao_status || item?.status_cozinha || item?.status);
  const explicitamenteImpresso = item?.impresso === true || item?.novo === false || ['impresso', 'printed', 'enviado'].includes(status);
  if (explicitamenteImpresso) return true;

  const printedItems = getPrintedItems();
  const pedidoKey = String(pedidoId || '');
  return asArray(printedItems[pedidoKey]).includes(itemPrintKey(item));
}

let bebidaIdsCache = null;

// Conjunto de ids de produtos que sao bebida (categoria 70), puxado do admin.
// Reforca o filtro de impressao mesmo em pedido antigo cujo item nao carrega
// categoria_id (a bebida e detectada pelo id do produto).
export async function getBebidaIds() {
  if (bebidaIdsCache) return bebidaIdsCache;
  try {
    const cardapio = await getCardapio();
    bebidaIdsCache = new Set(
      asArray(cardapio)
        .filter(isBebidaItem)
        .map((produto) => String(produto?.id))
    );
  } catch {
    bebidaIdsCache = new Set();
  }
  return bebidaIdsCache;
}

function itemEhBebida(item, bebidaIds) {
  return isBebidaItem(item) || Boolean(bebidaIds && bebidaIds.has(String(item?.id)));
}

export function itemNovoParaImpressao(pedidoId, item, bebidaIds) {
  return !itemEhBebida(item, bebidaIds) && !itemJaImpresso(pedidoId, item);
}

export function itensNovosParaImpressao(pedidoId, itens, bebidaIds) {
  return asArray(itens).filter((item) => itemNovoParaImpressao(pedidoId, item, bebidaIds));
}

export function marcarItensComoImpressos(pedidoId, itens) {
  const pedidoKey = String(pedidoId || '');
  const printedItems = getPrintedItems();
  const current = new Set(asArray(printedItems[pedidoKey]));

  asArray(itens).forEach((item) => current.add(itemPrintKey(item)));
  printedItems[pedidoKey] = Array.from(current);
  setPrintedItems(printedItems);

  return asArray(itens).map((item) => ({
    ...item,
    status_impressao: 'impresso',
    impressao_status: 'impresso',
    novo: false,
    impresso: true
  }));
}

function itensSemDisparoImpressao(itens) {
  return asArray(itens).map((item) => {
    const rest = { ...(item || {}) };
    delete rest.status_impressao;
    delete rest.impressao_status;
    delete rest.status_cozinha;
    delete rest.novo;
    delete rest.impresso;

    return {
      ...rest,
      imprimir: false,
      imprimir_cozinha: false
    };
  });
}

function itensParaCliqueImpressao(itens) {
  return asArray(itens).map((item) => ({
    ...item,
    imprimir: true,
    imprimir_cozinha: true
  }));
}

// O backend valida itens com `id` contra o cardapio (FK). A pizza nao e um
// produto real, entao enviamos o item sem `id`: sabores/adicionais viram texto
// em `observacao` (que a comanda imprime) e o preco ja inclui os adicionais.
export function prepararItensPedido(itens) {
  return asArray(itens).map((item) => {
    const imprimir = !isBebidaItem(item);

    if (!String(item?.id || '').startsWith('pizza-')) {
      return withNewPrintStatus(item, imprimir);
    }

    const adicionais = asArray(item.adicionais);
    const grupoSabores = adicionais.find((grupo) => grupo?.grupo_id === 'sabores');
    const sabores = asArray(grupoSabores?.itens_selecionados);
    const outros = adicionais
      .filter((grupo) => grupo?.grupo_id !== 'sabores')
      .flatMap((grupo) => asArray(grupo.itens_selecionados));

    const partes = [];
    if (sabores.length) partes.push(`Sabores: ${sabores.map((s) => s.nome).join(', ')}`);
    if (outros.length) partes.push(outros.map((a) => a.nome).join(', '));
    if (item.observacao) partes.push(item.observacao);

    return withNewPrintStatus({
      tipo: 'pizza',
      tamanho_id: Number(String(item.id).replace('pizza-', '')) || null,
      nome: item.nome,
      preco: Number(item.preco || 0) + precoAdicionaisItem(item),
      quantidade: item.quantidade,
      observacao: partes.join(' | '),
      sabores: sabores.map((s) => ({ id: s.id, nome: s.nome }))
    }, imprimir);
  });
}

export function criarPedido(pedido) {
  if (isDemoSession()) {
    return Promise.resolve({ id: `demo-pedido-${Date.now()}`, ...pedido });
  }

  return request('/pedidos', {
    method: 'POST',
    body: JSON.stringify({
      ...pedido,
      itens: itensSemDisparoImpressao(pedido?.itens),
      imprimir: false,
      imprimir_cozinha: false,
      imprimir_bebidas: false
    })
  });
}

export function adicionarItensPedido(pedidoId, itens) {
  if (isDemoSession()) {
    return Promise.resolve({ id: pedidoId, itens });
  }

  return request(`/pedidos/${pedidoId}/itens`, {
    method: 'PATCH',
    body: JSON.stringify({
      itens: itensSemDisparoImpressao(itens),
      imprimir: false,
      imprimir_cozinha: false,
      imprimir_bebidas: false,
      impressao_parcial: false,
      imprimir_apenas_itens_novos: false
    })
  });
}

export function atualizarPedidoStatus(pedidoId, status) {
  if (isDemoSession()) {
    return Promise.resolve({ id: pedidoId, status });
  }

  return request(`/pedidos/${pedidoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export function reimprimirPedido(pedidoId) {
  if (isDemoSession()) {
    return Promise.resolve({ id: pedidoId, impresso: true });
  }

  return request(`/pedidos/${pedidoId}/reimprimir`, {
    method: 'POST'
  });
}

export function imprimirItensPedido(pedidoId, itens) {
  if (isDemoSession()) {
    return Promise.resolve({ id: pedidoId, itens, impresso: true });
  }

  return request(`/pedidos/${pedidoId}/reimprimir`, {
    method: 'POST',
    body: JSON.stringify({
      itens: itensParaCliqueImpressao(itens),
      impressao_parcial: true,
      imprimir_apenas_itens_novos: true
    })
  });
}

export function removerItemPedido(pedidoId, itemId, itensRestantes) {
  if (isDemoSession()) {
    return Promise.resolve({ id: pedidoId, itemId });
  }

  return request(`/pedidos/${pedidoId}/itens/${itemId}`, {
    method: 'DELETE'
  }).catch(() =>
    request(`/pedidos/${pedidoId}/itens`, {
      method: 'PATCH',
      body: JSON.stringify({ itens: itensRestantes })
    })
  );
}

export function asArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.pedidos)) return data.pedidos;
  if (Array.isArray(data?.produtos)) return data.produtos;
  if (Array.isArray(data?.categorias)) return data.categorias;
  return [];
}
