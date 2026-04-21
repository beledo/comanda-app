import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login.jsx";
import Waiter from "./pages/waiter/Waiter.jsx";
import Kitchen from "./pages/kitchen/Kitchen.jsx";
import Bar from "./pages/bar/Bar.jsx";
import Admin from "./pages/admin/Admin.jsx";

// Este pequeño componente protege tus rutas: si no hay usuario, manda a Login
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="p-4">Cargando...</div>;
  return user ? children : <Navigate to="/" />;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Ruta Pública */}
        <Route path="/" element={<Login />} />

        {/* Rutas Protegidas */}
        <Route path="/waiter" element={<PrivateRoute><Waiter /></PrivateRoute>} />
        <Route path="/kitchen" element={<PrivateRoute><Kitchen /></PrivateRoute>} />
        <Route path="/bar" element={<PrivateRoute><Bar /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />

        {/* Si escriben cualquier otra cosa, al login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;