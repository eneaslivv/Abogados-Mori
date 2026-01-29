
import React, { useEffect, useState } from 'react';
import { Icons } from '../components/Icons';
import { db } from '../services/mockDb';
import { Client, Contract, Task, TaskStatus, ContractStatus, CalendarEvent } from '../types';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ clients: 0, activeContracts: 0, pendingTasks: 0 });
    const [recentTasks, setRecentTasks] = useState<Task[]>([]);
    const [recentContracts, setRecentContracts] = useState<Contract[]>([]);
    const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
    const [hasStyleProfile, setHasStyleProfile] = useState(false);

    useEffect(() => {
        const clients = db.getAll<Client>('clients');
        const contracts = db.getAll<Contract>('contracts');
        const tasks = db.getAll<Task>('tasks');
        const events = db.getAll<CalendarEvent>('events');
        const styleProfile = db.getContractStyleProfile();

        setStats({
            clients: clients.length,
            activeContracts: contracts.filter(c => c.status !== ContractStatus.SIGNED).length,
            pendingTasks: tasks.filter(t => t.status !== TaskStatus.COMPLETED).length,
        });

        setRecentTasks(tasks.filter(t => t.status !== TaskStatus.COMPLETED).slice(0, 4));
        setRecentContracts(contracts.slice(0, 4));

        // Simple mock for "Today's" events
        const todayStr = new Date().toISOString().split('T')[0];
        setTodayEvents(events.filter(e => e.date === todayStr).slice(0, 3));

        setHasStyleProfile(!!styleProfile && styleProfile.style_text.length > 0);
    }, []);

    const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
                {trend && <p className={`text-xs mt-2 font-medium ${trend.includes('+') ? 'text-green-600' : 'text-gray-400'}`}>{trend}</p>}
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon size={24} className="text-gray-700" />
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto pb-12 space-y-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-gray-900">Panel de Control</h1>
                    <p className="text-gray-500 mt-1">Bienvenido, Juan. Esto es lo que sucede hoy.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <button onClick={() => navigate('/contracts')} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 shadow-md transition-all">
                        + Crear Contrato
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Clientes Activos"
                    value={stats.clients}
                    icon={Icons.Clients}
                    trend="+12% desde el mes pasado"
                    color="bg-blue-50"
                />
                <StatCard
                    title="Contratos en Progreso"
                    value={stats.activeContracts}
                    icon={Icons.Contracts}
                    trend="3 esperando revisión"
                    color="bg-purple-50"
                />
                <StatCard
                    title="Tareas Pendientes"
                    value={stats.pendingTasks}
                    icon={Icons.Tasks}
                    trend="5 de alta prioridad"
                    color="bg-orange-50"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN (2/3) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Recent Activity / Contracts Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900">Contratos Recientes</h3>
                            <button onClick={() => navigate('/contracts')} className="text-xs font-medium text-gray-500 hover:text-gray-900">Ver Todos</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium">
                                    <tr>
                                        <th className="px-6 py-3">Título</th>
                                        <th className="px-6 py-3">Cliente</th>
                                        <th className="px-6 py-3">Estado</th>
                                        <th className="px-6 py-3 text-right">Última Actualización</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {recentContracts.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">No se encontraron contratos.</td></tr>
                                    ) : (
                                        recentContracts.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => navigate('/contracts')}>
                                                <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                                                    <Icons.Contracts size={16} className="text-gray-400 group-hover:text-purple-600 transition-colors" />
                                                    {c.title}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    Cliente: {c.client_id}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium 
                                                ${c.status === ContractStatus.SIGNED ? 'bg-green-100 text-green-700' :
                                                            c.status === ContractStatus.IN_REVIEW ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        {c.status === ContractStatus.SIGNED ? 'Firmado' :
                                                            c.status === ContractStatus.IN_REVIEW ? 'En Revisión' : 'Borrador'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-500">
                                                    {new Date(c.updated_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Urgent Tasks */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900">Tareas Prioritarias</h3>
                            <button onClick={() => navigate('/tasks')} className="text-xs font-medium text-gray-500 hover:text-gray-900">Ver Tablero</button>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {recentTasks.length === 0 ? (
                                <div className="px-6 py-8 text-center text-gray-400 italic">¡Todo al día! Sin tareas pendientes.</div>
                            ) : (
                                recentTasks.map(task => (
                                    <div key={task.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <button
                                                className="mt-0.5 text-gray-300 hover:text-green-600 transition-colors"
                                                onClick={() => {
                                                    db.update<Task>('tasks', task.id, { status: TaskStatus.COMPLETED });
                                                    window.location.reload();
                                                }}
                                            >
                                                <div className="w-5 h-5 rounded border-2 border-current"></div>
                                            </button>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${task.priority === 'High' || task.priority === 'Urgent'
                                                ? 'bg-red-50 text-red-700 border-red-100'
                                                : 'bg-gray-50 text-gray-600 border-gray-100'
                                                }`}>
                                                {task.priority === 'High' ? 'Alta' : task.priority === 'Urgent' ? 'Urgente' : task.priority === 'Low' ? 'Baja' : 'Media'}
                                            </span>
                                            <p className="text-xs text-gray-400 w-20 text-right">{new Date(task.due_date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN (1/3) */}
                <div className="space-y-6">

                    {/* Firm Identity Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Icons.Brain size={100} />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <Icons.Sparkles className="text-purple-400" size={20} />
                                <h3 className="font-semibold text-lg">IA de Identidad Jurídica</h3>
                            </div>
                            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                                {hasStyleProfile
                                    ? "El estilo de redacción de su bufete está activo. Todos los nuevos contratos se generarán utilizando su tono y estructura únicos."
                                    : "Falta el perfil de estilo de su bufete. Suba documentos anteriores para entrenar a la IA sobre su identidad de redacción."}
                            </p>

                            <button
                                onClick={() => navigate('/settings')}
                                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${hasStyleProfile
                                    ? 'bg-white/10 text-white hover:bg-white/20'
                                    : 'bg-white text-gray-900 hover:bg-gray-100'
                                    }`}
                            >
                                {hasStyleProfile ? 'Gestionar Perfil de Estilo' : 'Entrenar IA Ahora'}
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Acciones Rápidas</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => navigate('/clients')} className="p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
                                <Icons.Clients className="text-gray-400 group-hover:text-blue-600 mb-2" size={20} />
                                <span className="block text-sm font-medium text-gray-700 group-hover:text-blue-700">Añadir Cliente</span>
                            </button>
                            <button onClick={() => navigate('/contracts')} className="p-3 rounded-lg border border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all text-left group">
                                <Icons.Contracts className="text-gray-400 group-hover:text-purple-600 mb-2" size={20} />
                                <span className="block text-sm font-medium text-gray-700 group-hover:text-purple-700">Redactar Contrato</span>
                            </button>
                            <button onClick={() => navigate('/tasks')} className="p-3 rounded-lg border border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-all text-left group">
                                <Icons.Tasks className="text-gray-400 group-hover:text-orange-600 mb-2" size={20} />
                                <span className="block text-sm font-medium text-gray-700 group-hover:text-orange-700">Nueva Tarea</span>
                            </button>
                            <button onClick={() => navigate('/calendar')} className="p-3 rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all text-left group">
                                <Icons.Calendar className="text-gray-400 group-hover:text-green-600 mb-2" size={20} />
                                <span className="block text-sm font-medium text-gray-700 group-hover:text-green-700">Agenda</span>
                            </button>
                        </div>
                    </div>

                    {/* Agenda / Upcoming */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Agenda de Hoy</h3>
                            <button onClick={() => navigate('/calendar')} className="text-gray-400 hover:text-gray-900"><Icons.ChevronRight size={16} /></button>
                        </div>
                        <div className="space-y-3">
                            {todayEvents.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No hay eventos programados para hoy.</p>
                            ) : (
                                todayEvents.map(evt => (
                                    <div key={evt.id} className="flex gap-3 items-start">
                                        <div className="flex flex-col items-center min-w-[3rem]">
                                            <span className="text-xs font-bold text-gray-900">{evt.start_time}</span>
                                            <div className="h-full w-px bg-gray-200 my-1"></div>
                                        </div>
                                        <div className="pb-3">
                                            <p className="text-sm font-medium text-gray-900 leading-none">{evt.title}</p>
                                            <p className="text-xs text-gray-500 mt-1">{evt.location || 'Remoto'}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
