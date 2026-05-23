const API_URL = import.meta.env.VITE_API_URL || 'https://agentes-agente-restaurante.feit1k.easypanel.host';
const TOKEN_KEY = 'shiftsys_garcom_token';
const GARCOM_KEY = 'shiftsys_garcom';

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
  const garcom = data?.garcom || data?.usuario || data?.user || data;
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
  const data = await request('/garcom/login', {
    method: 'POST',
    body: JSON.stringify({ usuario, senha })
  });
  const session = normalizeLoginResponse(data);

  if (!session.token) {
    throw new Error('Login realizado, mas o token não foi retornado pela API.');
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
  const [novos, preparando] = await Promise.all([
    request('/pedidos?origem=garcom&status=novo'),
    request('/pedidos?origem=garcom&status=preparando')
  ]);
  return mergePedidos([novos, preparando]);
}

export function getCategorias() {
  return request('/categorias');
}

export function getCardapio() {
  return request('/cardapio');
}

export function criarPedido(pedido) {
  return request('/pedidos', {
    method: 'POST',
    body: JSON.stringify(pedido)
  });
}

export function atualizarPedidoStatus(pedidoId, status) {
  return request(`/pedidos/${pedidoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
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
