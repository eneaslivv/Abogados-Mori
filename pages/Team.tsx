
import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { db } from '../services/mockDb';
import { User, UserRole } from '../types';

export const Team: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setUsers(db.getAll('users'));
  }, []);

  const handleAddUser = (e: React.FormEvent) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const newUser = {
          name: fd.get('name') as string,
          email: fd.get('email') as string,
          role: fd.get('role') as UserRole,
          tenant_id: 'demo',
          created_at: new Date().toISOString()
      };
      db.create('users', newUser as any);
      setUsers(db.getAll('users'));
      setIsModalOpen(false);
  };

  const getRoleBadgeColor = (role: UserRole) => {
      switch(role) {
          case UserRole.SUPER_ADMIN: return 'bg-purple-100 text-purple-700';
          case UserRole.LAWYER: return 'bg-blue-100 text-blue-700';
          case UserRole.PARALEGAL: return 'bg-green-100 text-green-700';
          default: return 'bg-gray-100 text-gray-600';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage access and roles for your firm members.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 shadow-sm"
        >
          <Icons.Plus size={16} />
          Add Member
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                    <th className="px-6 py-3 font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Role</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Joined</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                {user.name.substring(0,2).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900">{user.name}</span>
                        </td>
                        <td className="px-6 py-4">{user.email}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                {user.role.replace('_', ' ').toUpperCase()}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <button className="text-gray-400 hover:text-gray-600"><Icons.More size={16} /></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-5">
                      <h2 className="text-lg font-bold text-gray-900">Invite New Member</h2>
                      <button onClick={() => setIsModalOpen(false)}><Icons.Close size={20} className="text-gray-400" /></button>
                  </div>
                  <form onSubmit={handleAddUser} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                          <input name="name" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                          <input name="email" type="email" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                          <select name="role" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                              {Object.values(UserRole).map(role => (
                                  <option key={role} value={role}>{role.replace('_', ' ').toUpperCase()}</option>
                              ))}
                          </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                          <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg">Invite User</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
