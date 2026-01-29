import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { db } from '../services/mockDb';
import { Client, ClientType, Contract, Task, CalendarEvent, TaskStatus, ClientDocument, ContractCategory, Document, ContractStatus } from '../types';
import { analyzeClientStrategy, generateClientContractSuggestions } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';

type TimelineItem = {
    id: string;
    type: 'contract' | 'task' | 'event' | 'creation';
    date: string;
    title: string;
    description: string;
    status?: string;
    icon: any;
    color: string;
};

export const Clients: React.FC = () => {
    const navigate = useNavigate();
    const [clients, setClients] = useState<Client[]>([]);
    const [categories, setCategories] = useState<ContractCategory[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false); // New State
    const [viewingClient, setViewingClient] = useState<Client | null>(null);

    // Client Detail State
    const [activeTab, setActiveTab] = useState<'timeline' | 'documents' | 'tasks'>('timeline');
    const [clientTimeline, setClientTimeline] = useState<TimelineItem[]>([]);
    const [clientContracts, setClientContracts] = useState<Contract[]>([]);
    const [clientFiles, setClientFiles] = useState<ClientDocument[]>([]);
    const [managedDocs, setManagedDocs] = useState<Document[]>([]);
    const [clientTasks, setClientTasks] = useState<Task[]>([]);
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

    // Document Assignment State
    const [isAssignDocModalOpen, setIsAssignDocModalOpen] = useState(false);
    const [unassignedDocs, setUnassignedDocs] = useState<Document[]>([]);

    // Creation State
    const [createClientType, setCreateClientType] = useState<ClientType>(ClientType.INDIVIDUAL);

    // Import State
    const [importText, setImportText] = useState('');
    const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success'>('idle');

    // AI Features State
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [contractSuggestions, setContractSuggestions] = useState<string[]>([]);
    const [isSuggesting, setIsSuggesting] = useState(false);

    const [noteInput, setNoteInput] = useState('');
    const [newTaskTitle, setNewTaskTitle] = useState('');

    useEffect(() => {
        setClients(db.getAll('clients'));
        setCategories(db.getAll('contract_categories'));
    }, [isModalOpen, viewingClient, isEditProfileOpen, isImportModalOpen]);

    // Load Client Data when viewing
    useEffect(() => {
        if (viewingClient) {
            const contracts = db.getAll<Contract>('contracts').filter(c => c.client_id === viewingClient.id);
            const tasks = db.getAll<Task>('tasks').filter(t => t.related_client_id === viewingClient.id);
            const events = db.getAll<CalendarEvent>('events').filter(e => e.client_id === viewingClient.id);

            // Legacy simple files
            const files = db.getAll<ClientDocument>('client_documents').filter(f => f.client_id === viewingClient.id);

            // New: Robust managed documents
            const allDocs = db.getAll<Document>('documents');
            const linkedDocs = allDocs.filter(d => d.linked_client_id === viewingClient.id);

            setClientContracts(contracts);
            setClientTasks(tasks);
            setClientFiles(files);
            setManagedDocs(linkedDocs);

            setContractSuggestions([]); // Reset suggestions
            setAiAnalysis('');

            // Build Timeline
            const timeline: TimelineItem[] = [];

            // 1. Creation
            timeline.push({
                id: 'creation',
                type: 'creation',
                date: viewingClient.created_at,
                title: 'Cliente Creado',
                description: 'Perfil del cliente añadido a LegalFlow.',
                icon: Icons.User,
                color: 'bg-gray-200 text-gray-600'
            });

            // 2. Contracts
            contracts.forEach(c => {
                timeline.push({
                    id: c.id,
                    type: 'contract',
                    date: c.updated_at,
                    title: `Contrato: ${c.title}`,
                    description: `${c.contract_type} - ${c.status === 'Signed' ? 'Firmado' : c.status === 'In Review' ? 'En Revisión' : 'Borrador'}`,
                    status: c.status === 'Signed' ? 'Firmado' : c.status === 'In Review' ? 'En Revisión' : 'Borrador',
                    icon: Icons.Contracts,
                    color: 'bg-purple-100 text-purple-600'
                });
            });

            // 3. Tasks
            tasks.forEach(t => {
                timeline.push({
                    id: t.id,
                    type: 'task',
                    date: t.updated_at, // or created_at
                    title: `Tarea: ${t.title}`,
                    description: `${t.status === 'Completed' ? 'Completada' : 'Pendiente'} - Prioridad ${getPriorityLabel(t.priority)}`,
                    status: t.status === 'Completed' ? 'Completada' : 'Pendiente',
                    icon: Icons.Tasks,
                    color: t.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                });
            });

            // 4. Events
            events.forEach(e => {
                timeline.push({
                    id: e.id,
                    type: 'event',
                    date: `${e.date}T${e.start_time}:00`,
                    title: `Evento: ${e.title}`,
                    description: `${e.event_type} en ${e.location || 'Remoto'}`,
                    icon: Icons.Calendar,
                    color: 'bg-blue-100 text-blue-600'
                });
            });

            // Sort descending
            timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setClientTimeline(timeline);
        }
    }, [viewingClient]);

    const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);

        const newClient = {
            full_name: fd.get('full_name') as string,
            email: fd.get('email') as string,
            phone: fd.get('phone') as string,
            document_type: fd.get('document_type') as string,
            document_number: fd.get('document_number') as string,
            client_type: createClientType,

            // Expanded fields
            address: fd.get('address') as string,
            city: fd.get('city') as string,
            zip_code: fd.get('zip_code') as string,
            legal_representative: fd.get('legal_representative') as string,
            representative_dni: fd.get('representative_dni') as string,
            default_contract_type: fd.get('default_contract_type') as string,
            default_context: fd.get('default_context') as string,

            notes: '',
            status: 'active',
            created_by: 'user-1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        db.create('clients', newClient as any);
        setIsModalOpen(false);
        setClients(db.getAll('clients'));
    };

    const handleProcessImport = () => {
        setImportStatus('processing');
        // Simple CSV Parse: Name, Email, Phone, ID
        const lines = importText.split('\n');
        let count = 0;

        lines.forEach(line => {
            if (!line.trim()) return;
            const [name, email, phone, docNum] = line.split(',').map(s => s.trim());
            if (name && email) {
                db.create('clients', {
                    full_name: name,
                    email: email,
                    phone: phone || '',
                    document_number: docNum || '',
                    document_type: 'DNI',
                    client_type: ClientType.INDIVIDUAL,
                    status: 'active',
                    created_by: 'user-1',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                } as any);
                count++;
            }
        });

        setTimeout(() => {
            setImportStatus('success');
            setImportText('');
            setTimeout(() => {
                setIsImportModalOpen(false);
                setImportStatus('idle');
                setClients(db.getAll('clients'));
            }, 1000);
        }, 800);
    };

    const handleUpdateClient = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!viewingClient) return;

        const fd = new FormData(e.currentTarget);
        const updates: Partial<Client> = {
            full_name: fd.get('full_name') as string,
            email: fd.get('email') as string,
            phone: fd.get('phone') as string,
            document_number: fd.get('document_number') as string,
            address: fd.get('address') as string,
            city: fd.get('city') as string,
            zip_code: fd.get('zip_code') as string,
            legal_representative: fd.get('legal_representative') as string,
            representative_dni: fd.get('representative_dni') as string,
            default_contract_type: fd.get('default_contract_type') as string,
            default_context: fd.get('default_context') as string,
        };

        const updated = db.update<Client>('clients', viewingClient.id, updates);
        setViewingClient(updated);
        setIsEditProfileOpen(false);
    };

    const handleAddNote = () => {
        if (!viewingClient || !noteInput.trim()) return;
        const timestamp = new Date().toLocaleString();
        const newNoteEntry = `\n[${timestamp}] ${noteInput}`;
        const updatedNotes = (viewingClient.notes || '') + newNoteEntry;

        db.update<Client>('clients', viewingClient.id, { notes: updatedNotes });

        // Update local state
        setViewingClient({ ...viewingClient, notes: updatedNotes });
        setNoteInput('');
    };

    const handleAddClientTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!viewingClient || !newTaskTitle.trim()) return;

        const newTask = {
            title: newTaskTitle,
            description: '',
            priority: 'Medium',
            status: 'To Do',
            due_date: new Date().toISOString().split('T')[0],
            assigned_to: 'user-1',
            related_client_id: viewingClient.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        db.create('tasks', newTask as any);
        setClientTasks(db.getAll<Task>('tasks').filter(t => t.related_client_id === viewingClient.id));
        setNewTaskTitle('');
    };

    const handleClientFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!viewingClient || !e.target.files?.[0]) return;

        const file = e.target.files[0];

        // Mock File Upload
        db.create('client_documents', {
            client_id: viewingClient.id,
            title: file.name,
            file_type: file.type || 'unknown',
            file_url: '#', // Mock URL
            uploaded_at: new Date().toISOString()
        } as any);

        // Refresh files
        const updatedFiles = db.getAll<ClientDocument>('client_documents').filter(f => f.client_id === viewingClient.id);
        setClientFiles(updatedFiles);
    };

    const handleDeleteFile = (fileId: string) => {
        if (!confirm("¿Está seguro de que desea eliminar este archivo?")) return;
        db.delete('client_documents', fileId);
        if (viewingClient) {
            const updatedFiles = db.getAll<ClientDocument>('client_documents').filter(f => f.client_id === viewingClient.id);
            setClientFiles(updatedFiles);
        }
    };

    // --- Document Assignment ---
    const handleOpenAssignModal = () => {
        const allDocs = db.getAll<Document>('documents');
        // Filter for docs NOT assigned to anyone
        const available = allDocs.filter(d => !d.linked_client_id);
        setUnassignedDocs(available);
        setIsAssignDocModalOpen(true);
    };

    const handleAssignDoc = (docId: string) => {
        if (!viewingClient) return;
        db.update<Document>('documents', docId, { linked_client_id: viewingClient.id });

        // Refresh list
        const allDocs = db.getAll<Document>('documents');
        setManagedDocs(allDocs.filter(d => d.linked_client_id === viewingClient.id));

        // Update modal list
        setUnassignedDocs(prev => prev.filter(d => d.id !== docId));
    };

    const handleUnlinkDoc = (docId: string) => {
        if (!confirm("¿Desvincular este documento del cliente?")) return;
        db.update<Document>('documents', docId, { linked_client_id: undefined });
        if (viewingClient) {
            const allDocs = db.getAll<Document>('documents');
            setManagedDocs(allDocs.filter(d => d.linked_client_id === viewingClient.id));
        }
    };

    const handleRunAnalysis = async () => {
        if (!viewingClient) return;
        setIsAnalyzing(true);

        const historySummary = clientTimeline.map(t => `- ${t.date.split('T')[0]}: ${t.title} (${t.description})`).join('\n');
        const notesContext = viewingClient.notes || "Sin notas.";

        const fullContext = `
      Cliente: ${viewingClient.full_name} (${getClientTypeLabel(viewingClient.client_type)})
      Notas: ${notesContext}
      Historial:
      ${historySummary}
      `;

        const result = await analyzeClientStrategy(viewingClient.full_name, fullContext);
        setAiAnalysis(result);
        setIsAnalyzing(false);
    };

    const handleGenerateSuggestions = async () => {
        if (!viewingClient) return;
        setIsSuggesting(true);

        const historySummary = clientTimeline.map(t => `- ${t.date.split('T')[0]}: ${t.title}`).join('\n');
        const result = await generateClientContractSuggestions(viewingClient.full_name, historySummary);

        // Mock parsing assuming bullet points
        const lines = result.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*') || !isNaN(Number(l[0])));
        const suggestions = lines.map(l => l.replace(/^[-*0-9.)]+/, '').trim());

        setContractSuggestions(suggestions.length > 0 ? suggestions : [result]);
        setIsSuggesting(false);
    };

    const handleDraftSuggestion = (suggestion: string) => {
        navigate('/contracts', {
            state: {
                clientId: viewingClient?.id,
                initialTitle: suggestion
            }
        });
    };

    const getCategoryName = (id?: string) => {
        if (!id) return null;
        return categories.find(c => c.id === id)?.name;
    };

    const getClientTypeLabel = (type: ClientType) =>
        type === ClientType.COMPANY ? 'Empresa' : 'Particular';

    const getPriorityLabel = (priority: string) => {
        if (priority === 'Urgent') return 'Urgente';
        if (priority === 'High') return 'Alta';
        if (priority === 'Medium') return 'Media';
        if (priority === 'Low') return 'Baja';
        return priority;
    };

    const COMMON_CONTRACT_TYPES = [
        "Acuerdo de Confidencialidad (NDA)",
        "Contrato de Servicios",
        "Contrato de Trabajo",
        "Contrato de Alquiler",
        "Contrato de Compraventa",
        "Acuerdo de Asociación",
        "Memorando de Entendimiento (MOU)",
        "Poder Especial",
        "Acuerdo de Transacción"
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
                    >
                        <Icons.Upload size={16} />
                        Carga Masiva
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 shadow-sm"
                    >
                        <Icons.Plus size={16} />
                        Nuevo Cliente
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-gray-900">Nombre</th>
                            <th className="px-6 py-3 font-semibold text-gray-900">Tipo</th>
                            <th className="px-6 py-3 font-semibold text-gray-900">Correo</th>
                            <th className="px-6 py-3 font-semibold text-gray-900">Estado</th>
                            <th className="px-6 py-3 font-semibold text-gray-900">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {clients.map(client => (
                            <tr key={client.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                        {client.full_name.substring(0, 2).toUpperCase()}
                                    </div>
                                    {client.full_name}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs ${client.client_type === ClientType.COMPANY ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {client.client_type === ClientType.COMPANY ? 'Empresa' : 'Particular'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{client.email}</td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium border border-green-100">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                        Activo
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <button className="text-gray-400 hover:text-blue-600 transition-colors" onClick={() => setViewingClient(client)}>
                                        <Icons.Edit size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {clients.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-400 italic">Aún no hay clientes. Añada uno o importe una lista.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bulk Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Icons.Upload size={20} className="text-purple-600" />
                                Carga Rápida de Clientes
                            </h3>
                            <button onClick={() => setIsImportModalOpen(false)}><Icons.Close size={20} className="text-gray-400" /></button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Pegue su lista de clientes a continuación (formato CSV) para añadir varios clientes rápidamente.
                            </p>
                            <div className="bg-gray-50 p-3 rounded text-xs text-gray-500 font-mono">
                                Formato: Nombre, Correo, Teléfono, ID<br />
                                Ejemplo: Juan Pérez, juan@mail.com, 11-555-5555, 20123456789
                            </div>

                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 font-mono"
                                placeholder="Pegue los datos aquí..."
                            />

                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                                <button
                                    onClick={handleProcessImport}
                                    disabled={!importText.trim() || importStatus === 'processing'}
                                    className={`px-4 py-2 text-sm text-white rounded-lg font-bold flex items-center gap-2 ${importStatus === 'success' ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                                >
                                    {importStatus === 'processing' ? <Icons.Sparkles className="animate-spin" size={16} /> :
                                        importStatus === 'success' ? <Icons.Check size={16} /> : <Icons.Upload size={16} />}
                                    {importStatus === 'processing' ? 'Procesando...' :
                                        importStatus === 'success' ? '¡Listo!' : 'Importar Clientes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* New Client Modal - Detailed */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl max-w-2xl w-full p-8 shadow-2xl my-8">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Crear Nuevo Cliente</h2>
                                <p className="text-sm text-gray-500 mt-1">Complete los detalles para crear un perfil legal completo.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)}><Icons.Close size={24} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-8">
                            {/* Section 1: Identity & Contact */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4">Identidad y Contacto</h3>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo / Razón Social</label>
                                        <input required name="full_name" placeholder="ej. TechSolutions SRL o Juan Pérez" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cliente</label>
                                        <select
                                            name="client_type"
                                            value={createClientType}
                                            onChange={(e) => setCreateClientType(e.target.value as ClientType)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50"
                                        >
                                            <option value={ClientType.INDIVIDUAL}>Particular</option>
                                            <option value={ClientType.COMPANY}>Empresa</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-1/3">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Doc.</label>
                                            <select name="document_type" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                                <option value="DNI">DNI</option>
                                                <option value="CUIT">CUIT</option>
                                                <option value="Pasaporte">Pasaporte</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Número de Documento</label>
                                            <input required name="document_number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ej. 20-12345678-9" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
                                        <input required name="email" type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="contacto@ejemplo.com" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                        <input name="phone" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="+54 9 11..." />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Legal Address */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4">Domicilio Legal</h3>
                                <div className="grid grid-cols-6 gap-4">
                                    <div className="col-span-6">
                                        <label className="block text-xs text-gray-500 mb-1">Dirección</label>
                                        <input name="address" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ej. Av. Libertador 1000, Piso 5, Depto B" />
                                    </div>
                                    <div className="col-span-4">
                                        <label className="block text-xs text-gray-500 mb-1">Ciudad</label>
                                        <input name="city" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="CABA" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-500 mb-1">Código Postal</label>
                                        <input name="zip_code" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="1425" />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Signatory (Conditional) */}
                            {createClientType === ClientType.COMPANY && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4">Representante Legal (Firmante)</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Representante</label>
                                            <input name="legal_representative" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ej. Nombre del Socio Gerente" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">DNI del Representante</label>
                                            <input name="representative_dni" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="DNI del firmante" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Section 4: Preferences */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4">Preferencias de Contrato (IA)</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Tipo de Contrato por Defecto</label>
                                        <input
                                            name="default_contract_type"
                                            list="common-types-create"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            placeholder="Contrato más común para este cliente..."
                                        />
                                        <datalist id="common-types-create">
                                            {COMMON_CONTRACT_TYPES.map(t => <option key={t} value={t} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Contexto por Defecto / Términos de Pago</label>
                                        <textarea
                                            name="default_context"
                                            rows={2}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                                            placeholder="ej. 'Pago a 30 días', 'Jurisdicción en Buenos Aires', 'Confidencialidad Estricta'..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-5 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-sm">Crear Perfil de Cliente</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Full Client Dossier View */}
            {viewingClient && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex justify-end">
                    <div className="w-full max-w-5xl bg-white h-full shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold">
                                    {viewingClient.full_name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl font-serif font-bold text-gray-900">{viewingClient.full_name}</h2>
                                        <button onClick={() => setIsEditProfileOpen(true)} className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100">
                                            <Icons.Edit size={16} />
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-500">{getClientTypeLabel(viewingClient.client_type)} • ID: {viewingClient.document_number}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => navigate('/contracts')} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                                    <Icons.Contracts size={16} /> Contrato
                                </button>
                                <button onClick={() => navigate('/tasks')} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                                    <Icons.Tasks size={16} /> Tarea
                                </button>
                                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                                <button onClick={() => setViewingClient(null)} className="text-gray-400 hover:text-gray-900 p-2">
                                    <Icons.Close size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Main Content (Left) */}
                            <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
                                {/* Tabs */}
                                <div className="px-8 pt-6 border-b border-gray-200 bg-white">
                                    <div className="flex gap-6">
                                        <button onClick={() => setActiveTab('timeline')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'timeline' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                            Línea de Tiempo y Actividad
                                        </button>
                                        <button onClick={() => setActiveTab('documents')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'documents' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                            Documentos ({clientContracts.length + clientFiles.length + managedDocs.length})
                                        </button>
                                        <button onClick={() => setActiveTab('tasks')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                            Tareas ({clientTasks.length})
                                        </button>
                                    </div>
                                </div>

                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-y-auto p-8">

                                    {activeTab === 'timeline' && (
                                        <div className="space-y-8 max-w-3xl">
                                            <div className="relative border-l-2 border-gray-200 ml-4 space-y-8 pb-8">
                                                {clientTimeline.map((item, idx) => (
                                                    <div key={item.id + idx} className="relative pl-8">
                                                        {/* Dot */}
                                                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${item.color.split(' ')[0]}`}></div>

                                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                                            <div>
                                                                <span className="text-xs text-gray-400 font-mono mb-1 block">
                                                                    {new Date(item.date).toLocaleString()}
                                                                </span>
                                                                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                                    <item.icon size={14} className="text-gray-500" />
                                                                    {item.title}
                                                                </h4>
                                                                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                                            </div>
                                                            {item.status && (
                                                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-gray-100 rounded text-gray-500 self-start">
                                                                    {item.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'documents' && (
                                        <div className="space-y-8">
                                            {/* Contracts Section */}
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                    <Icons.Contracts size={16} className="text-gray-400" />
                                                    Contratos
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {clientContracts.map(c => (
                                                        <div key={c.id} className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/contracts')}>
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                                                                    <Icons.Contracts size={20} />
                                                                </div>
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${c.status === 'Signed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {c.status === 'Signed' ? 'Firmado' : c.status === 'In Review' ? 'En Revisión' : 'Borrador'}
                                                                </span>
                                                            </div>
                                                            <h4 className="font-bold text-gray-900 mb-1">{c.title}</h4>
                                                            <p className="text-xs text-gray-500 mb-4">{c.contract_type} • Versión {c.version_number}</p>
                                                            <div className="flex items-center justify-between text-xs text-gray-400">
                                                                <span>Actualizado el {new Date(c.updated_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Managed Documents Section */}
                                            {activeTab === 'documents' && (
                                                <div className="pt-6 border-t border-gray-100">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                            <Icons.FileText size={16} className="text-gray-400" />
                                                            Documentos Gestionados
                                                        </h3>
                                                        <button onClick={handleOpenAssignModal} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                                                            + Vincular Documento
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {managedDocs.map(d => (
                                                            <div key={d.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-200 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <Icons.FileText size={16} className="text-gray-400" />
                                                                    <div>
                                                                        <p className="text-sm font-medium text-gray-900">{d.title}</p>
                                                                        <p className="text-xs text-gray-500">{d.document_type || 'Documento'} • {(d.file_size_bytes / 1024).toFixed(0)} KB</p>
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleUnlinkDoc(d.id)} className="text-gray-400 hover:text-red-500 p-1">
                                                                    <Icons.Trash size={14} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {managedDocs.length === 0 && <p className="text-sm text-gray-400 italic">No hay documentos vinculados.</p>}
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    )}

                                    {activeTab === 'tasks' && (
                                        <div className="space-y-6">
                                            <form onSubmit={handleAddClientTask} className="flex gap-2">
                                                <input
                                                    value={newTaskTitle}
                                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                                    placeholder="Añadir una nueva tarea para este cliente..."
                                                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                                                />
                                                <button type="submit" disabled={!newTaskTitle.trim()} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                                                    Añadir Tarea
                                                </button>
                                            </form>

                                            <div className="space-y-3">
                                                {clientTasks.map(task => (
                                                    <div key={task.id} className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-lg hover:border-gray-300 transition-colors group">
                                                        <div className={`mt-0.5 w-4 h-4 rounded border cursor-pointer flex items-center justify-center ${task.status === 'Completed' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                                            {task.status === 'Completed' && <Icons.Check size={10} className="text-white" />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className={`text-sm ${task.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${task.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {getPriorityLabel(task.priority)}
                                                                </span>
                                                                {task.due_date && <span className="text-xs text-gray-400 flex items-center gap-1"><Icons.Calendar size={10} /> {task.due_date}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {clientTasks.length === 0 && <p className="text-center py-8 text-gray-400 italic">Sin tareas activas.</p>}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Link Document Modal */}
            {isAssignDocModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Vincular Documento</h3>
                        <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                            {unassignedDocs.map(d => (
                                <div key={d.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => handleAssignDoc(d.id)}>
                                    <div className="flex items-center gap-3">
                                        <Icons.FileText size={16} className="text-gray-400" />
                                        <div className="text-sm font-medium text-gray-700">{d.title}</div>
                                    </div>
                                    <Icons.Plus size={16} className="text-gray-400" />
                                </div>
                            ))}
                            {unassignedDocs.length === 0 && <p className="text-center text-gray-500 text-sm">No se encontraron documentos sin asignar.</p>}
                        </div>
                        <button onClick={() => setIsAssignDocModalOpen(false)} className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Cerrar</button>
                    </div>
                </div>
            )}

        </div>
    );
};
