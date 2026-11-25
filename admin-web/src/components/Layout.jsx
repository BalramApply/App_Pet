import { NavLink, Outlet } from 'react-router-dom';
import {
  PawPrint, LayoutDashboard, Siren, Users, BadgeCheck, CalendarCheck, Activity, LifeBuoy,
  Star, Package, Syringe, Settings, ScrollText, LogOut,
} from 'lucide-react';
import { useAuth } from "../context/useAuth.js";

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/ops', label: 'Ops queue', icon: Siren },
  { to: '/users', label: 'Users & staff', icon: Users },
  { to: '/professionals', label: 'Professionals', icon: BadgeCheck },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/sessions', label: 'Sessions', icon: Activity },
  { to: '/support', label: 'Support tickets', icon: LifeBuoy },
  { to: '/reviews', label: 'Reviews', icon: Star },
  { to: '/catalog', label: 'Catalog', icon: Package },
  { to: '/records', label: 'Pets & vaccines', icon: Syringe },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/audit', label: 'Audit log', icon: ScrollText },
];

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-badge"><PawPrint size={18} color="#fff" /></span>
          PetJeeva Admin
        </div>
        <nav className="nav">
          {NAV.map(({ to, label: text, icon: Icon, end, soon }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={16} /> {text}
              {soon ? <span className="soon">soon</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div>{user?.name}</div>
          <div style={{ opacity: 0.65, fontSize: 12 }}>+91 {user?.phone}</div>
          <button type="button" onClick={logout}><LogOut size={14} /> Sign out</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}