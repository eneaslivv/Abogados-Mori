import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../components/Icons';
import { db } from '../services/mockDb';
import { Document, Client, DocumentCategory, PermissionSet } from '../types';
import { cleanDocumentText, detectDocumentTitle, askContract, analyzeContract, explainClause, autoCategorizeDocument, autoTagDocument, rewriteDocumentText } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';

// Type for pending uploads in bulk mode
interface PendingUpload {
    id: string;
    file: File;
    status: 'pending' | 'extracting' | 'cleaning' | 'analyzing' | 'ready';
    rawText: string;
    cleanText: string;
    detectedTitle: string;
    detectedCategory: string;
    detectedTags: string[];
    assignedClientId: string; // New field
}

export const Documents: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'bulk_upload' | 'pending_assignment'>('all');
  const [permissions, setPermissions] = useState<PermissionSet>(db.getUserPermissions());
  
  // Data State
  const [docs, setDocs] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [firmStyle, setFirmStyle] = useState<string>('');
  
  // Selection State
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterClient, setFilterClient] = useState('ALL');

  // Bulk Upload State
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkAssignClient, setBulkAssignClient] = useState(''); // For global assignment
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Viewer State
  const [viewMode, setViewMode] = useState<'clean' | 'raw'>('clean');
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'info' | 'refine'>('refine');
  const [qaInput, setQaInput] = useState('');
  const [qaHistory, setQaHistory] = useState<{q: string, a: string}[]>([]);

  // Rewrite / Refine State
  const [rewriteObjective, setRewriteObjective] = useState('');
  const [useFirmStyle, setUseFirmStyle] = useState(true);
  const [isRewriting, setIsRewriting] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setDocs(db.getDocumentsForUser()); // RLS applied here
    setClients(db.getAll('clients'));
    setCategories(db.getAll('document_categories'));
    setPermissions(db.getUserPermissions());
    const profile = db.getContractStyleProfile();
    setFirmStyle(profile?.style_text || '');
  };

  const getClientName = (id?: string) => clients.find(c => c.id === id)?.full_name || 'Unassigned';
  const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || 'Uncategorized';

  // --- Bulk Upload Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const files: File[] = Array.from(e.target.files);
      const newPending: PendingUpload[] = files.map(f => ({
          id: Math.random().toString(36).substr(2, 9),
          file: f,
          status: 'pending',
          rawText: '',
          cleanText: '',
          detectedTitle: f.name,
          detectedCategory: '',
          detectedTags: [],
          assignedClientId: ''
      }));
      setPendingUploads(prev => [...prev, ...newPending]);
      setActiveTab('bulk_upload');
  };

  const processPendingUploads = async () => {
      setIsProcessingBulk(true);
      const cats = categories.map(c => c.name);

      // Process sequentially for demo clarity, could be parallel
      for (let i = 0; i < pendingUploads.length; i++) {
          const item = pendingUploads[i];
          if (item.status === 'ready') continue;

          // Update status
          updatePendingStatus(item.id, 'extracting');

          // 1. Extract
          const rawText = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve(ev.target?.result as string);
              reader.readAsText(item.file); // Mock extraction
          });
          
          updatePendingStatus(item.id, 'cleaning');
          const cleanText = await cleanDocumentText(rawText);
          
          updatePendingStatus(item.id, 'analyzing');
          const title = await detectDocumentTitle(cleanText);
          const categoryName = await autoCategorizeDocument(cleanText, cats);
          const tags = await autoTagDocument(cleanText);

          setPendingUploads(prev => prev.map(p => p.id === item.id ? {
              ...p,
              status: 'ready',
              rawText,
              cleanText,
              detectedTitle: title,
              detectedCategory: categories.find(c => c.name === categoryName)?.id || '',
              detectedTags: tags
          } : p));
      }
      setIsProcessingBulk(false);
  };

  const updatePendingStatus = (id: string, status: PendingUpload['status']) => {
      setPendingUploads(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const handleUpdatePendingClient = (id: string, clientId: string) => {
      setPendingUploads(prev => prev.map(p => p.id === id ? { ...p, assignedClientId: clientId } : p));
  };

  const handleApplyBulkClient = (clientId: string) => {
      setBulkAssignClient(clientId);
      setPendingUploads(prev => prev.map(p => ({ ...p, assignedClientId: clientId })));
  };

  const handleSaveBulk = () => {
      const ready = pendingUploads.filter(p => p.status === 'ready');
      ready.forEach(p => {
          db.create<Document>('documents', {
              uploaded_by: 'user-1',
              title: p.detectedTitle,
              file_url: '#',
              extracted_text_raw: p.rawText,
              extracted_text_clean: p.cleanText,
              document_type: 'PDF',
              category_id: p.detectedCategory || undefined,
              linked_client_id: p.assignedClientId || undefined, // Save assignment
              tags: p.detectedTags,
              embedding_status: 'ready',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              tenant_id: 'demo'
          } as any);
      });
      setPendingUploads([]);
      refreshData();
      setActiveTab('all');
  };

  // --- Batch Actions ---

  const toggleSelectAll = () => {
      if (selectedDocIds.size === filteredDocs.length) {
          setSelectedDocIds(new Set());
      } else {
          setSelectedDocIds(new Set(filteredDocs.map(d => d.id)));
      }
  };

  const toggleSelectDoc = (id: string) => {
      const newSet = new Set(selectedDocIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedDocIds(newSet);
  };

  const handleBatchDelete = () => {
      if (!permissions.can_delete_documents) return alert("You do not have permission to delete documents.");
      if (confirm(`Delete ${selectedDocIds.size} documents?`)) {
          selectedDocIds.forEach(id => db.delete('documents', id));
          setSelectedDocIds(new Set());
          refreshData();
      }
  };

  const handleBatchAssignClient = (clientId: string) => {
      selectedDocIds.forEach(id => db.update<Document>('documents', id, { linked_client_id: clientId }));
      setSelectedDocIds(new Set());
      refreshData();
  };

  // --- Viewer & AI ---

  const handleAsk = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDoc || !qaInput.trim()) return;
      const q = qaInput;
      setQaInput('');
      setQaHistory(prev => [...prev, { q, a: 'Thinking...' }]);
      const a = await askContract(selectedDoc.extracted_text_clean, q);
      setQaHistory(prev => prev.map(item => item.q === q ? { q, a } : item));
  };

  const handleRewrite = async () => {
      if (!selectedDoc) return;
      setIsRewriting(true);
      const profileToUse = useFirmStyle ? firmStyle : undefined;
      const result = await rewriteDocumentText(selectedDoc.extracted_text_clean, profileToUse, rewriteObjective);
      
      // Update local state for immediate preview
      const updatedDoc = { ...selectedDoc, extracted_text_clean: result };
      setSelectedDoc(updatedDoc);
      
      // Update DB
      db.update<Document>('documents', selectedDoc.id, { extracted_text_clean: result });
      refreshData(); // Sync list
      
      setIsRewriting(false);
      setViewMode('clean');
  };

  // --- Filter Logic ---
  
  const filteredDocs = docs.filter(d => {
      if (activeTab === 'pending_assignment' && (d.linked_client_id || d.category_id)) return false;
      
      const matchSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = filterCategory === 'ALL' || d.category_id === filterCategory;
      const matchClient = filterClient === 'ALL' || d.linked_client_id === filterClient;
      
      return matchSearch && matchCat && matchClient;
  });

  // --- Render ---

  if (selectedDoc) {
      // Document Viewer Mode
      return (
          <div className="h-full flex flex-col bg-white animate-in slide-in-from-right-4">
              <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between bg-white flex-shrink-0">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setSelectedDoc(null)} className="text-gray-500 hover:text-gray-900"><Icons.ChevronRight className="rotate-180" /></button>
                      <div>
                          <h1 className="text-lg font-bold text-gray-900">{selectedDoc.title}</h1>
                          <p className="text-xs text-gray-500">
                             {getClientName(selectedDoc.linked_client_id)} • {getCategoryName(selectedDoc.category_id)}
                          </p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                       <button onClick={() => setViewMode('clean')} className={`px-3 py-1.5 text-xs font-medium rounded ${viewMode === 'clean' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>Clean</button>
                       <button onClick={() => setViewMode('raw')} className={`px-3 py-1.5 text-xs font-medium rounded ${viewMode === 'raw' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>Raw</button>
                  </div>
              </div>
              <div className="flex-1 flex overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-12 bg-[#FAFAFA]">
                      <div className="max-w-3xl mx-auto bg-white min-h-full shadow-sm p-12 border border-gray-200">
                           <pre className={`whitespace-pre-wrap leading-relaxed ${viewMode === 'clean' ? 'font-serif text-gray-800' : 'font-mono text-xs text-gray-600'}`}>
                               {viewMode === 'clean' ? selectedDoc.extracted_text_clean : selectedDoc.extracted_text_raw}
                           </pre>
                      </div>
                  </div>
                  <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
                      <div className="flex border-b border-gray-200">
                          <button onClick={() => setSidebarTab('refine')} className={`flex-1 py-3 text-xs font-bold uppercase ${sidebarTab === 'refine' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-400'}`}>Refine</button>
                          <button onClick={() => setSidebarTab('chat')} className={`flex-1 py-3 text-xs font-bold uppercase ${sidebarTab === 'chat' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-400'}`}>Chat</button>
                          <button onClick={() => setSidebarTab('info')} className={`flex-1 py-3 text-xs font-bold uppercase ${sidebarTab === 'info' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-400'}`}>Info</button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                          {sidebarTab === 'refine' && (
                              <div className="space-y-6">
                                  <div>
                                      <h4 className="text-xs font-bold text-gray-900 uppercase mb-3 flex items-center gap-2">
                                          <Icons.Brain size={14} className="text-purple-600" />
                                          AI Rewriter
                                      </h4>
                                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                          Rewrite the entire document using specific instructions or applying your firm's trained style.
                                      </p>
                                      
                                      <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                          <div>
                                              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${useFirmStyle ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'}`}>
                                                      {useFirmStyle && <Icons.Check size={10} className="text-white" />}
                                                  </div>
                                                  <input type="checkbox" className="hidden" checked={useFirmStyle} onChange={() => setUseFirmStyle(!useFirmStyle)} />
                                                  <span className="text-sm font-medium text-gray-900">Apply Firm DNA</span>
                                              </label>
                                              <p className="text-[10px] text-gray-400 pl-6">
                                                  {firmStyle ? "Using active style profile." : "No style trained yet."}
                                              </p>
                                          </div>

                                          <div>
                                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Objective / Instructions</label>
                                              <textarea 
                                                value={rewriteObjective}
                                                onChange={(e) => setRewriteObjective(e.target.value)}
                                                className="w-full text-sm border-gray-300 rounded-lg p-2 h-24 focus:ring-purple-500 focus:border-purple-500 resize-none"
                                                placeholder="e.g. 'Make the tone more aggressive', 'Summarize preamble', 'Translate to English'..."
                                              />
                                          </div>

                                          <button 
                                            onClick={handleRewrite}
                                            disabled={isRewriting}
                                            className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50 flex justify-center items-center gap-2"
                                          >
                                              {isRewriting ? <Icons.Sparkles className="animate-spin" size={16} /> : <Icons.Sparkles size={16} />}
                                              {isRewriting ? 'Transforming...' : 'Rewrite Document'}
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          )}
                          {sidebarTab === 'info' && (
                              <div className="space-y-4">
                                  <div>
                                      <label className="text-xs font-bold text-gray-400 uppercase">Tags</label>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                          {selectedDoc.tags?.map(t => <span key={t} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">{t}</span>)}
                                          {!selectedDoc.tags?.length && <span className="text-xs text-gray-400 italic">No tags</span>}
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-gray-400 uppercase">Category</label>
                                      <p className="text-sm text-gray-900">{getCategoryName(selectedDoc.category_id)}</p>
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-gray-400 uppercase">Client</label>
                                      <p className="text-sm text-gray-900">{getClientName(selectedDoc.linked_client_id)}</p>
                                  </div>
                              </div>
                          )}
                          {sidebarTab === 'chat' && (
                              <div className="flex flex-col h-full">
                                  <div className="flex-1 space-y-3 mb-3">
                                      {qaHistory.map((h, i) => (
                                          <div key={i} className="space-y-1">
                                              <div className="bg-white p-2 rounded text-xs border border-gray-200">{h.q}</div>
                                              <div className="bg-purple-50 p-2 rounded text-xs text-purple-800">{h.a}</div>
                                          </div>
                                      ))}
                                  </div>
                                  <form onSubmit={handleAsk} className="relative">
                                      <input value={qaInput} onChange={(e) => setQaInput(e.target.value)} placeholder="Ask Q..." className="w-full text-sm border-gray-300 rounded pr-8" />
                                      <button type="submit" className="absolute right-2 top-2 text-purple-600"><Icons.ChevronRight size={16} /></button>
                                  </form>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Document Manager</h1>
          <div className="flex gap-2">
               <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
               {permissions.can_upload_documents && (
                   <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
                       <Icons.Upload size={16} /> Bulk Upload
                   </button>
               )}
          </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200">
          <button onClick={() => setActiveTab('all')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>All Documents</button>
          <button onClick={() => setActiveTab('pending_assignment')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending_assignment' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>Pending Assignment</button>
          {pendingUploads.length > 0 && <button onClick={() => setActiveTab('bulk_upload')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'bulk_upload' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>Bulk Upload ({pendingUploads.length})</button>}
      </div>

      {activeTab === 'bulk_upload' ? (
          <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                   <h2 className="text-lg font-bold">Bulk Processing Queue</h2>
                   
                   <div className="flex items-center gap-3">
                       <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                           <span className="text-xs font-bold text-gray-500 uppercase">Assign All To:</span>
                           <select 
                                value={bulkAssignClient}
                                onChange={(e) => handleApplyBulkClient(e.target.value)}
                                className="bg-transparent border-none text-sm font-medium focus:ring-0 p-0 cursor-pointer text-blue-600"
                           >
                               <option value="">-- Select Client --</option>
                               {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                           </select>
                       </div>

                       <button onClick={processPendingUploads} disabled={isProcessingBulk} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
                           {isProcessingBulk ? 'AI Processing...' : 'Run Auto-Categorization'}
                       </button>
                       <button onClick={handleSaveBulk} disabled={pendingUploads.some(p => p.status !== 'ready')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50">
                           Save All
                       </button>
                   </div>
               </div>
               
               <div className="space-y-2 flex-1 overflow-y-auto">
                   {pendingUploads.map(p => (
                       <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                           <div className="flex items-center gap-3 flex-1">
                               <Icons.FileText className="text-gray-400" />
                               <div>
                                   <p className="text-sm font-medium text-gray-900">{p.file.name}</p>
                                   <p className="text-xs text-gray-500">{p.status.toUpperCase()}</p>
                               </div>
                           </div>
                           
                           {/* Category Tag */}
                           <div className="w-40">
                                {p.detectedCategory ? (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{categories.find(c => c.id === p.detectedCategory)?.name}</span>
                                ) : <span className="text-xs text-gray-400 italic">--</span>}
                           </div>

                           {/* Client Selector per Item */}
                           <div className="w-48">
                                <select 
                                    value={p.assignedClientId}
                                    onChange={(e) => handleUpdatePendingClient(p.id, e.target.value)}
                                    className="w-full text-xs border-gray-200 rounded bg-white"
                                >
                                    <option value="">-- Assign Client --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                                </select>
                           </div>

                           <div className="w-40 text-right">
                               {p.detectedTags.length > 0 && <span className="text-xs text-gray-500 truncate block">{p.detectedTags.join(', ')}</span>}
                           </div>
                       </div>
                   ))}
               </div>
          </div>
      ) : (
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
               {/* Toolbar */}
               <div className="p-4 border-b border-gray-100 flex justify-between bg-gray-50/50">
                   <div className="flex gap-3">
                       <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
                       <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border border-gray-200 rounded px-3 py-1.5 text-sm"><option value="ALL">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                       <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="border border-gray-200 rounded px-3 py-1.5 text-sm"><option value="ALL">All Clients</option>{clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select>
                   </div>
                   {selectedDocIds.size > 0 && (
                       <div className="flex items-center gap-2 animate-in fade-in">
                           <span className="text-xs font-bold text-gray-500 mr-2">{selectedDocIds.size} selected</span>
                           <select onChange={(e) => handleBatchAssignClient(e.target.value)} className="text-xs border-gray-300 rounded">
                               <option value="">Assign to Client...</option>
                               {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                           </select>
                           {permissions.can_delete_documents && (
                               <button onClick={handleBatchDelete} className="text-red-600 hover:bg-red-50 p-2 rounded"><Icons.Trash size={16} /></button>
                           )}
                       </div>
                   )}
               </div>

               {/* Table */}
               <div className="flex-1 overflow-y-auto">
                   <table className="w-full text-left text-sm">
                       <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium uppercase text-xs tracking-wider">
                           <tr>
                               <th className="px-4 py-3 w-10"><input type="checkbox" onChange={toggleSelectAll} checked={selectedDocIds.size === filteredDocs.length && filteredDocs.length > 0} /></th>
                               <th className="px-4 py-3">Document</th>
                               <th className="px-4 py-3">Category</th>
                               <th className="px-4 py-3">Client</th>
                               <th className="px-4 py-3">Tags</th>
                               <th className="px-4 py-3 text-right">Date</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                           {filteredDocs.map(doc => (
                               <tr key={doc.id} className={`hover:bg-gray-50 group ${selectedDocIds.has(doc.id) ? 'bg-blue-50/30' : ''}`}>
                                   <td className="px-4 py-3"><input type="checkbox" checked={selectedDocIds.has(doc.id)} onChange={() => toggleSelectDoc(doc.id)} /></td>
                                   <td className="px-4 py-3 cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                                       <div className="flex items-center gap-3">
                                           <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500"><Icons.FileText size={16} /></div>
                                           <span className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">{doc.title}</span>
                                       </div>
                                   </td>
                                   <td className="px-4 py-3 text-gray-600">{getCategoryName(doc.category_id)}</td>
                                   <td className="px-4 py-3 text-gray-600">{getClientName(doc.linked_client_id)}</td>
                                   <td className="px-4 py-3">
                                       <div className="flex flex-wrap gap-1">
                                           {doc.tags?.slice(0, 3).map(t => <span key={t} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">{t}</span>)}
                                       </div>
                                   </td>
                                   <td className="px-4 py-3 text-right text-gray-500 text-xs font-mono">{new Date(doc.created_at).toLocaleDateString()}</td>
                               </tr>
                           ))}
                           {filteredDocs.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No documents found.</td></tr>}
                       </tbody>
                   </table>
               </div>
          </div>
      )}
    </div>
  );
};