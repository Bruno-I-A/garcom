const API_URL = import.meta.env.VITE_API_URL || 'https://agentes-agente-restaurante.feit1k.easypanel.host';
const TOKEN_KEY = 'shiftsys_garcom_token';
const GARCOM_KEY = 'shiftsys_garcom';
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
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
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

export function getCardapio() {
  if (isDemoSession()) {
    return Promise.resolve([
      { id: 'burger', nome: 'Hambúrguer da casa', preco: 32.9, categoria_id: 'lanches' },
      { id: 'batata', nome: 'Batata rústica', preco: 18.5, categoria_id: 'lanches' },
      { id: 'suco', nome: 'Suco natural', preco: 12, categoria_id: 'bebidas' },
      { id: 'refri', nome: 'Refrigerante lata', preco: 8, categoria_id: 'bebidas' },
      { id: 'pudim', nome: 'Pudim', preco: 14.9, categoria_id: 'sobremesas' }
    ]);
  }

  return request('/cardapio');
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

// O backend valida itens com `id` contra o cardapio (FK). A pizza nao e um
// produto real, entao enviamos o item sem `id`: sabores/adicionais viram texto
// em `observacao` (que a comanda imprime) e o preco ja inclui os adicionais.
export function prepararItensPedido(itens) {
  return asArray(itens).map((item) => {
    if (!String(item?.id || '').startsWith('pizza-')) return item;

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

    return {
      tipo: 'pizza',
      tamanho_id: Number(String(item.id).replace('pizza-', '')) || null,
      nome: item.nome,
      preco: Number(item.preco || 0) + precoAdicionaisItem(item),
      quantidade: item.quantidade,
      observacao: partes.join(' | '),
      sabores: sabores.map((s) => ({ id: s.id, nome: s.nome }))
    };
  });
}

export function criarPedido(pedido) {
  if (isDemoSession()) {
    return Promise.resolve({ id: `demo-pedido-${Date.now()}`, ...pedido });
  }

  return request('/pedidos', {
    method: 'POST',
    body: JSON.stringify(pedido)
  });
}

export function adicionarItensPedido(pedidoId, itens) {
  if (isDemoSession()) {
    return Promise.resolve({ id: pedidoId, itens });
  }

  return request(`/pedidos/${pedidoId}/itens`, {
    method: 'PATCH',
    body: JSON.stringify({ itens })
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
