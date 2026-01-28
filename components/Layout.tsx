
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icons } from './Icons';
import { db } from '../services/mockDb';
import { PermissionSet } from '../types';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const [permissions, setPermissions] = useState<PermissionSet | null>(null);

  useEffect(() => {
      // Simulate fetching current user permissions
      const perms = db.getUserPermissions();
      setPermissions(perms);
  }, [location.pathname]); // Re-check on nav change (simulate dynamic updates)

  if (!permissions) return null; // Or loading spinner

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Icons.Dashboard, hasSubmenu: false, show: true },
    { name: 'Contracts', path: '/contracts', icon: Icons.FileText, hasSubmenu: true, show: permissions.access_contract_generator },
    { name: 'Documents', path: '/documents', icon: Icons.Contracts, hasSubmenu: false, show: permissions.can_view_all_documents }, // New Item
    { name: 'Clients', path: '/clients', icon: Icons.Clients, hasSubmenu: true, show: true },
    { name: 'Tasks', path: '/tasks', icon: Icons.Tasks, hasSubmenu: false, show: true },
    { name: 'Calendar', path: '/calendar', icon: Icons.Calendar, hasSubmenu: false, show: permissions.access_calendar },
    { name: 'Team', path: '/team', icon: Icons.User, hasSubmenu: false, show: permissions.access_team_management },
  ];

  const bottomItems = [
    { name: 'Studio Settings', path: '/settings', icon: Icons.Settings, show: permissions.access_settings },
    { name: 'Support', path: '/support', icon: Icons.Help, show: true },
  ];

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-[260px] bg-[#F9F9F9] border-r border-gray-200 transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="h-14 flex items-center px-4 mt-2">
            <div className="flex items-center gap-3 text-gray-800 font-semibold px-2 py-1 rounded-md hover:bg-gray-200/50 transition-colors w-full cursor-pointer">
                <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center text-white text-xs font-bold">
                L
                </div>
                <span>LegalFlow</span>
                <Icons.More size={16} className="ml-auto text-gray-400" />
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.filter(i => i.show).map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  group flex items-center justify-between px-3 py-1.5 rounded-md text-[14px] transition-colors
                  ${isActive 
                    ? 'bg-[#EFEFEF] text-gray-900 font-medium' 
                    : 'text-[#5F5F5F] hover:bg-[#EFEFEF] hover:text-gray-900'}
                `}
              >
                <div className="flex items-center gap-3">
                    <item.icon size={18} className={isActive ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-700'} strokeWidth={2} />
                    {item.name}
                </div>
                {item.hasSubmenu && (
                    <Icons.ChevronRight size={14} className="text-gray-400" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 mt-auto">
             {/* Divider */}
            <div className="h-px bg-gray-200 mx-1 mb-3"></div>
            
            <div className="space-y-0.5">
                {bottomItems.filter(i => i.show).map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                        flex items-center gap-3 px-3 py-1.5 rounded-md text-[14px] text-[#5F5F5F] hover:bg-[#EFEFEF] hover:text-gray-900 transition-colors
                        ${location.pathname === item.path ? 'bg-[#EFEFEF] text-gray-900 font-medium' : ''}
                        `}
                    >
                        <item.icon size={18} className="text-gray-500" strokeWidth={2} />
                        {item.name}
                    </NavLink>
                ))}
            </div>

            {/* User Profile (Optional, matching style) */}
            <div className="mt-2 flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#EFEFEF] cursor-pointer transition-colors">
                 <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600">
                    JD
                </div>
                <div className="text-[13px] font-medium text-gray-700">John Doe</div>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        {/* Mobile Header */}
        <header className="h-14 md:hidden flex items-center justify-between px-4 bg-white border-b border-gray-200">
            <div className="font-semibold text-gray-800">LegalFlow</div>
            <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600">
                <Icons.Menu size={24} />
            </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-white">
            <div className="h-full w-full">
                <div className="max-w-7xl mx-auto p-6 md:p-10">
                    <Outlet />
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};
