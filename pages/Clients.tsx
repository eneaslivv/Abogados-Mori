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
              title: 'Client Created',
              description: 'Client profile added to LegalFlow.',
              icon: Icons.User,
              color: 'bg-gray-200 text-gray-600'
          });

          // 2. Contracts
          contracts.forEach(c => {
              timeline.push({
                  id: c.id,
                  type: 'contract',
                  date: c.updated_at,
                  title: `Contract: ${c.title}`,
                  description: `${c.contract_type} - ${c.status}`,
                  status: c.status,
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
                  title: `Task: ${t.title}`,
                  description: `${t.status} - ${t.priority} Priority`,
                  status: t.status,
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
                  title: `Event: ${e.title}`,
                  description: `${e.event_type} at ${e.location || 'Remote'}`,
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
      if(!confirm("Are you sure you want to delete this file?")) return;
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
      if (!confirm("Unlink this document from the client?")) return;
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
      const notesContext = viewingClient.notes || "No notes.";
      
      const fullContext = `
      Client: ${viewingClient.full_name} (${viewingClient.client_type})
      Notes: ${notesContext}
      History:
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

  const COMMON_CONTRACT_TYPES = [
    "Non-Disclosure Agreement (NDA)",
    "Service Agreement",
    "Employment Contract",
    "Lease Agreement",
    "Sales Contract",
    "Partnership Agreement",
    "Memorandum of Understanding (MOU)",
    "Power of Attorney",
    "Settlement Agreement"
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <div className="flex gap-3">
             <button 
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
            >
                <Icons.Upload size={16} />
                Bulk Import
            </button>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 shadow-sm"
            >
                <Icons.Plus size={16} />
                New Client
            </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-900">Name</th>
              <th className="px-6 py-3 font-semibold text-gray-900">Type</th>
              <th className="px-6 py-3 font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map(client => (
              <tr key={client.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                        {client.full_name.substring(0,2).toUpperCase()}
                    </div>
                    {client.full_name}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${client.client_type === ClientType.COMPANY ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {client.client_type}
                  </span>
                </td>
                <td className="px-6 py-4">{client.email}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium border border-green-100">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    Active
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
                    <td colSpan={5} className="text-center py-8 text-gray-400 italic">No clients yet. Add one or import a list.</td>
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
                          Quick Client Load
                      </h3>
                      <button onClick={() => setIsImportModalOpen(false)}><Icons.Close size={20} className="text-gray-400" /></button>
                  </div>
                  
                  <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                          Paste your client list below (CSV format) to quickly add multiple clients.
                      </p>
                      <div className="bg-gray-50 p-3 rounded text-xs text-gray-500 font-mono">
                          Format: Name, Email, Phone, ID<br/>
                          Example: Juan Perez, juan@mail.com, 11-555-5555, 20123456789
                      </div>
                      
                      <textarea 
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 font-mono"
                        placeholder="Paste data here..."
                      />

                      <div className="flex justify-end gap-3 pt-2">
                          <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                          <button 
                            onClick={handleProcessImport}
                            disabled={!importText.trim() || importStatus === 'processing'}
                            className={`px-4 py-2 text-sm text-white rounded-lg font-bold flex items-center gap-2 ${importStatus === 'success' ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                          >
                              {importStatus === 'processing' ? <Icons.Sparkles className="animate-spin" size={16} /> : 
                               importStatus === 'success' ? <Icons.Check size={16} /> : <Icons.Upload size={16} />}
                              {importStatus === 'processing' ? 'Processing...' : 
                               importStatus === 'success' ? 'Done!' : 'Import Clients'}
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
                    <h2 className="text-2xl font-bold text-gray-900">Create New Client</h2>
                    <p className="text-sm text-gray-500 mt-1">Fill in the details to create a comprehensive legal profile.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)}><Icons.Close size={24} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-8">
              {/* Section 1: Identity & Contact */}
              <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4">Identity & Contact</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name / Company Name</label>
                          <input required name="full_name" placeholder="e.g. TechSolutions SRL or Juan Perez" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Client Type</label>
                          <select 
                            name="client_type" 
                            value={createClientType}
                            onChange={(e) => setCreateClientType(e.target.value as ClientType)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50"
                          >
                            <option value={ClientType.INDIVIDUAL}>Individual</option>
                            <option value={ClientType.COMPANY}>Company</option>
                          </select>
                      </div>
                      <div className="flex gap-2">
                          <div className="w-1/3">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Doc Type</label>
                              <select name="document_type" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                  <option value="DNI">DNI</option>
                                  <option value="CUIT">CUIT</option>
                                  <option value="Passport">Passport</option>
                              </select>
                          </div>
                          <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Document Number</label>
                              <input required name="document_number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 20-12345678-9" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input required name="email" type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="contact@example.com" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                          <input name="phone" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="+54 9 11..." />
                      </div>
                  </div>
              </div>

              {/* Section 2: Legal Address */}
              <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4">Legal Address</h3>
                  <div className="grid grid-cols-6 gap-4">
                      <div className="col-span-6">
                          <label className="block text-xs text-gray-500 mb-1">Street Address</label>
                          <input name="address" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Av. Libertador 1000, Piso 5, Depto B" />
                      </div>
                      <div className="col-span-4">
                          <label className="block text-xs text-gray-500 mb-1">City</label>
                          <input name="city" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="CABA" />
                      </div>
                      <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Zip Code</label>
                          <input name="zip_code" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="1425" />
                      </div>
                  </div>
              </div>

              {/* Section 3: Signatory (Conditional) */}
              {createClientType === ClientType.COMPANY && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4">Legal Representative (Signatory)</h3>
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Representative Name</label>
                              <input name="legal_representative" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Managing Partner Name" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Representative ID</label>
                              <input name="representative_dni" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="DNI of signer" />
                          </div>
                      </div>
                  </div>
              )}

              {/* Section 4: Preferences */}
              <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4">Contract Preferences (AI Defaults)</h3>
                  <div className="grid grid-cols-1 gap-4">
                      <div>
                          <label className="block text-xs text-gray-500 mb-1">Default Contract Type</label>
                          <input 
                            name="default_contract_type" 
                            list="common-types-create"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder="Most common contract for this client..."
                          />
                          <datalist id="common-types-create">
                              {COMMON_CONTRACT_TYPES.map(t => <option key={t} value={t} />)}
                          </datalist>
                      </div>
                      <div>
                          <label className="block text-xs text-gray-500 mb-1">Default Context / Payment Terms</label>
                          <textarea 
                            name="default_context" 
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" 
                            placeholder="e.g. 'Payment Net 30 days', 'Jurisdiction in Buenos Aires', 'Strict Confidentiality'..."
                          />
                      </div>
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-sm">Create Client Profile</button>
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
                            {viewingClient.full_name.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-serif font-bold text-gray-900">{viewingClient.full_name}</h2>
                                <button onClick={() => setIsEditProfileOpen(true)} className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100">
                                    <Icons.Edit size={16} />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500">{viewingClient.client_type} • ID: {viewingClient.document_number}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/contracts')} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                            <Icons.Contracts size={16} /> Contract
                        </button>
                        <button onClick={() => navigate('/tasks')} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                            <Icons.Tasks size={16} /> Task
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
                                    Timeline & Activity
                                </button>
                                <button onClick={() => setActiveTab('documents')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'documents' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                    Documents ({clientContracts.length + clientFiles.length + managedDocs.length})
                                </button>
                                <button onClick={() => setActiveTab('tasks')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                    Tasks ({clientTasks.length})
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
                                            Contracts
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {clientContracts.map(c => (
                                                <div key={c.id} className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/contracts')}>
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="w-10 h-1