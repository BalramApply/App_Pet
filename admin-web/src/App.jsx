import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import OpsQueue from './pages/OpsQueue.jsx';
import Users from './pages/Users.jsx';
import Professionals from './pages/Professionals.jsx';
import Bookings from './pages/Bookings.jsx';
import Sessions from './pages/Sessions.jsx';
import Support from './pages/Support.jsx';
import Reviews from './pages/Reviews.jsx';
import Catalog from './pages/Catalog.jsx';
import Records from './pages/Records.jsx';
import Settings from './pages/Settings.jsx';
import Audit from './pages/Audit.jsx';
import { Spinner } from './components/ui.jsx';

function Protected({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="ops" element={<OpsQueue />} />
        <Route path="users" element={<Users />} />
        <Route path="professionals" element={<Professionals />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="support" element={<Support />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="records" element={<Records />} />
        <Route path="settings" element={<Settings />} />
        <Route path="audit" element={<Audit />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}