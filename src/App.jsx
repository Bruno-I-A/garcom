import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Mesas from './pages/Mesas.jsx';
import Mesa from './pages/Mesa.jsx';
import Cardapio from './pages/Cardapio.jsx';
import Balcao from './pages/Balcao.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/mesas" replace />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/mesas" element={<Mesas />} />
        <Route path="/balcao" element={<Balcao />} />
        <Route path="/mesa/:numero" element={<Mesa />} />
        <Route path="/mesa/:numero/cardapio" element={<Cardapio />} />
      </Route>
      <Route path="*" element={<Navigate to="/mesas" replace />} />
    </Routes>
  );
}
