import { useNavigate } from 'react-router-dom';
import { clearSession, getGarcom } from '../services/api.js';

export default function Header({ title, showBack = false, showLogout = false }) {
  const navigate = useNavigate();
  const garcom = getGarcom();
  const garcomNome = garcom?.nome || garcom?.usuario || garcom?.name || 'Garçom';

  function handleLogout() {
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-gray-800/80 bg-[#0b1220]/95 px-4 py-4 backdrop-blur">
      <div className="flex min-h-12 items-center gap-3">
        {showBack ? (
          <button className="secondary-button min-w-12 px-3" type="button" onClick={() => navigate(-1)} aria-label="Voltar">
            ←
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black text-white">{title}</h1>
          {showLogout ? <p className="truncate text-sm text-gray-400">{garcomNome}</p> : null}
        </div>
        {showLogout ? (
          <button className="secondary-button px-4" type="button" onClick={handleLogout}>
            Sair
          </button>
        ) : null}
      </div>
    </header>
  );
}
