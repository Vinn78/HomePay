import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, List, User, PlusCircle } from 'lucide-react';
import { cn } from '../Common';

export const BottomNav: React.FC = () => {
  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/requests', icon: List, label: 'Requests' },
    { to: '/send', icon: PlusCircle, label: 'Send' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center space-y-1 transition-colors',
                isActive ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'
              )
            }
          >
            <Icon className="h-6 w-6" />
            <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
