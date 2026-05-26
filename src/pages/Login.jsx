import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login } from '../services/api.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(usuario.trim(), senha);
      navigate(location.state?.from?.pathname || '/mesas', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível entrar. Confira usuário e senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell flex items-center justify-center px-4 py-8">
      <section className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <img
            className="mx-auto mb-5 h-24 w-24 rounded-[28px] border border-purple-400/25 object-cover shadow-2xl shadow-purple-600/40"
            src="/icons/logo.png"
            alt="Comanda Digital"
          />
          <h1 className="text-4xl font-black tracking-normal text-white">Comanda Digital</h1>
          <p className="mt-2 text-xl font-semibold text-purple-300">Garçom</p>
        </div>

        <form className="card space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-base font-semibold text-gray-300">Usuário</span>
            <input
              className="field"
              type="text"
              autoComplete="username"
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
              placeholder="Digite seu usuário"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-base font-semibold text-gray-300">Senha</span>
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder="Digite sua senha"
              required
            />
          </label>

          {error ? <p className="rounded-xl border border-red-500/50 bg-red-950/50 p-3 text-sm text-red-100">{error}</p> : null}

          <button className="primary-button w-full text-lg" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-center text-sm text-gray-500">Teste com usuário demo e senha demo.</p>
        </form>
      </section>
    </main>
  );
}
