import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { db } from '../services/mockDb';
import { generateStyleProfile, rewriteDocumentText, analyzeDocumentStyleSingle } from '../services/geminiService';
import { ContractTrainingDocument, ContractCategory, RoleSettings, UserRole, ContractStyleProfile } from '../types';

export const Settings: React.FC = () => {
  const [trainingDocs, setTrainingDocs] = useState<ContractTrainingDocument[]>([]);
  const [categories, setCategories] = useState<ContractCategory[]>([]);
  const [styleProfile, setStyleProfile] = useState<ContractStyleProfile | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState<'ai' | 'categories' | 'roles' | 'general'>('ai');

  // Role Permissions State
  const [roles, setRoles] = useState<RoleSettings[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.LAWYER);

  // Category Management State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  
  // Upload & Filter State
  const [filterDocCategory, setFilterDocCategory] = useState('ALL');

  // Manual Edit State
  const [isEditingStyle, setIsEditingStyle] = useState(false);
  const [manualStyleInput, setManualStyleInput] = useState('');

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocType, setUploadDocType] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);

  // Edit Document Modal State
  const [editingDoc, setEditingDoc] = useState<ContractTrainingDocument | null>(null);

  // Simulation State
  const [simInput, setSimInput] = useState('');
  const [simOutput, setSimOutput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  const refreshData = () => {
    setTrainingDocs(db.getAll('training_docs'));
    setCategories(db.getAll('contract_categories'));
    setRoles(db.getAll('roles_settings'));
    const profile = db.getContractStyleProfile();
    setStyleProfile(profile || null);
    setManualStyleInput(profile?.style_text || '');
  };

  useEffect(() => {
    refreshData();
  }, []);

  // --- Upload & Analysis Flow ---

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const f = e.target.files[0];
          setUploadFile(f);
          setUploadTitle(f.name.replace(/\.[^/.]+$/, "")); // Auto-strip extension
          setIsUploadModalOpen(true);
      }
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!uploadFile) return;
      
      setIsAnalyzingDoc(true);

      const reader = new FileReader();
      reader.onload = async (ev) => {
          const text = ev.target?.result as string;
          
          // 1. Analyze specific document style immediately
          const analysis = await analyzeDocumentStyleSingle(text);

          // 2. Save to DB
          db.create<ContractTrainingDocument>('training_docs', {
              uploaded_by: 'user-1',
              title: uploadTitle,
              contract_type: uploadDocType || 'General Contract',
              category_id: uploadCategory || undefined,
              file_name: uploadFile.name,
              extracted_text: text,
              style_summary: analysis.summary,
              tone_label: analysis.tone,
              created_at: new Date().toISOString(),
              tenant_id: 'demo'
          } as any);

          refreshData();
          setIsAnalyzingDoc(false);
          setIsUploadModalOpen(false);
          
          // Reset form
          setUploadFile(null);
          setUploadTitle('');
          setUploadDocType('');
          setUploadCategory('');
      };
      reader.readAsText(uploadFile);
  };

  // --- Edit Document Flow ---
  const handleSaveDocEdits = (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingDoc) return;
      db.update<ContractTrainingDocument>('training_docs', editingDoc.id, editingDoc);
      refreshData();
      setEditingDoc(null);
  };

  // --- Global Training Flow ---
  const handleRegenerateStyle = async () => {
    setIsGenerating(true);
    const docs = db.getAll<ContractTrainingDocument>('training_docs');
    const texts = docs.map(d => d.extracted_text);
    
    // Now returns structured analysis including completeness
    const result = await generateStyleProfile(texts);
    
    db.saveContractStyleProfile({
        style_text: result.style_text,
        completeness_score: result.completeness_score,
        missing_elements: result.missing_elements,
        suggestions: result.suggestions
    });
    
    refreshData();
    setIsGenerating(false);
    setIsEditingStyle(false);
  };

  const handleSaveManualStyle = () => {
      // Manual override assumes 100% confidence by user
      db.saveContractStyleProfile({ 
          style_text: manualStyleInput,
          completeness_score: 100,
          missing_elements: [] 
      });
      refreshData();
      setIsEditingStyle(false);
  };

  const handleTestSimulation = async () => {
      if (!simInput.trim()) return;
      setIsSimulating(true);
      const res = await rewriteDocumentText(simInput, manualStyleInput || styleProfile?.style_text, "Rewrite using the Firm DNA style strictly.");
      setSimOutput(res);
      setIsSimulating(false);
  };

  const handleDeleteDoc = (id: string) => {
      if(confirm('Remove this document from training?')) {
          db.delete('training_docs', id);
          refreshData();
      }
  }

  // --- Category Handlers ---
  const handleAddCategory = () => {
      if (!newCategoryName.trim()) return;
      db.create<ContractCategory>('contract_categories', {
          name: newCategoryName,
          description: 'Custom category',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tenant_id: 'demo'
      } as any);
      setNewCategoryName('');
      refreshData();
  };

  const handleDeleteCategory = (id: string) => {
      if (confirm('Are you sure?')) {
          db.delete('contract_categories', id);
          refreshData();
      }
  };

  const startEditingCategory = (cat: ContractCategory) => {
      setEditingCategoryId(cat.id);
      setEditingCategoryName(cat.name);
  };

  const saveEditingCategory = () => {
      if (editingCategoryId && editingCategoryName.trim()) {
          db.update<ContractCategory>('contract_categories', editingCategoryId, { name: editingCategoryName });
          setEditingCategoryId(null);
          setEditingCategoryName('');
          refreshData();
      }
  };

  // --- Role Handlers ---
  const togglePermission = (key: keyof RoleSettings['permissions']) => {
      const roleSetting = roles.find(r => r.role_name === selectedRole);
      if (!roleSetting) return;

      const newPerms = { ...roleSetting.permissions, [key]: !roleSetting.permissions[key] };
      db.update<RoleSettings>('roles_settings', roleSetting.id, { permissions: newPerms });
      refreshData();
  };

  const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || 'Uncategorized';
  const filteredDocs = filterDocCategory === 'ALL' ? trainingDocs : trainingDocs.filter(d => d.category_id === filterDocCategory);
  const activeRoleSettings = roles.find(r => r.role_name === selectedRole);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900">Studio Settings</h1>
            <p className="text-gray-500 mt-2">Manage your firm's AI identity, legal categories, and team permissions.</p>
        </div>
        <div className="flex gap-2">
            {(['ai', 'categories', 'roles', 'general'] as const).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveSection(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === tab ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    {tab === 'ai' ? 'Firm DNA' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
      </div>

      {activeSection === 'ai' && (
          <div className="grid grid-cols-12 gap-8">
              {/* LEFT COLUMN: KNOWLEDGE BASE */}
              <div className="col-span-12 lg:col-span-5 space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                          <h3 className="font-bold text-gray-900 flex items-center gap-2">
                              <Icons.Brain size={18} className="text-purple-600" />
                              Knowledge Base
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">Upload historical contracts to teach the AI your specific tone and style.</p>
                      </div>
                      
                      <div className="p-5 space-y-4">
                          {/* Upload Area */}
                          <div className="relative group">
                              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl opacity-50 group-hover:opacity-100 transition duration-200 blur"></div>
                              <div className="relative bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-400 transition-colors cursor-pointer">
                                  <input 
                                    type="file" 
                                    accept=".txt,.md,.pdf" 
                                    onChange={handleFileSelection} 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  />
                                  <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-600">
                                      <Icons.Upload size={20} />
                                  </div>
                                  <h4 className="text-sm font-bold text-gray-900">Add Training Document</h4>
                                  <p className="text-xs text-gray-500 mt-1">Click to select file...</p>
                              </div>
                          </div>

                          {/* File List */}
                          <div>
                              <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Analyzed Docs ({filteredDocs.length})</span>
                                  <select 
                                    value={filterDocCategory}
                                    onChange={(e) => setFilterDocCategory(e.target.value)}
                                    className="text-[10px] border-none bg-transparent text-gray-500 font-medium focus:ring-0 cursor-pointer hover:text-gray-900"
                                  >
                                      <option value="ALL">All Categories</option>
                                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                              </div>
                              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
                                  {filteredDocs.length === 0 ? (
                                      <p className="text-center text-xs text-gray-400 py-8 italic border border-dashed border-gray-200 rounded-lg">No documents found.</p>
                                  ) : (
                                      filteredDocs.map(doc => (
                                          <div key={doc.id} onClick={() => setEditingDoc(doc)} className="group bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer relative">
                                              <div className="flex justify-between items-start mb-2">
                                                  <h4 className="text-sm font-bold text-gray-900 truncate pr-6">{doc.title}</h4>
                                                  <div className="flex flex-col items-end">
                                                      <span className="text-[9px] font-bold uppercase bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mb-1">
                                                          {doc.contract_type}
                                                      </span>
                                                      <span className="text-[9px] text-gray-400">{getCategoryName(doc.category_id)}</span>
                                                  </div>
                                              </div>
                                              
                                              {/* Tone Badge */}
                                              {doc.tone_label && (
                                                  <div className="flex items-center gap-2 mb-2">
                                                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                                          Tone: {doc.tone_label}
                                                      </span>
                                                  </div>
                                              )}

                                              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                                  {doc.style_summary || "No style summary available."}
                                              </p>

                                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white shadow-sm rounded p-0.5 border border-gray-100">
                                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }} className="p-1 text-gray-400 hover:text-red-500">
                                                      <Icons.Trash size={12} />
                                                  </button>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      </div>
                      
                      {/* Action */}
                      <div className="p-5 bg-gray-50 border-t border-gray-200">
                           <button 
                                onClick={handleRegenerateStyle}
                                disabled={isGenerating || trainingDocs.length === 0}
                                className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform active:scale-95"
                           >
                               {isGenerating ? <Icons.Sparkles className="animate-spin" /> : <Icons.Brain />}
                               {isGenerating ? 'Building Profile...' : 'Train Firm DNA Model'}
                           </button>
                           <p className="text-[10px] text-center text-gray-400 mt-2">
                               Combines all analyzed documents into one master profile.
                           </p>
                      </div>
                  </div>
              </div>

              {/* RIGHT COLUMN: IDENTITY ENGINE */}
              <div className="col-span-12 lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full min-h-[600px]">
                      <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                          <div>
                              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                  <Icons.Sparkles size={18} className="text-blue-600" />
                                  Master Identity Profile
                              </h3>
                              <p className="text-xs text-gray-500 mt-1">
                                  {styleProfile ? 'Active Style Profile (Ready for Drafting)' : 'No Identity Trained'}
                              </p>
                          </div>
                          <div className="flex gap-2">
                              {isEditingStyle ? (
                                  <>
                                      <button onClick={() => setIsEditingStyle(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                      <button onClick={handleSaveManualStyle} className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm">Save Changes</button>
                                  </>
                              ) : (
                                  <button onClick={() => { setIsEditingStyle(true); setManualStyleInput(styleProfile?.style_text || ''); }} disabled={!styleProfile} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg disabled:opacity-50">
                                      Edit Manually
                                  </button>
                              )}
                          </div>
                      </div>

                      {/* Model Training Feedback Loop */}
                      {styleProfile && (
                          <div className="px-6 pt-6 pb-2">
                              <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Training Completeness</span>
                                  <span className={`text-xs font-bold ${styleProfile.completeness_score && styleProfile.completeness_score >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                                      {styleProfile.completeness_score || 0}%
                                  </span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-1000 ${styleProfile.completeness_score && styleProfile.completeness_score >= 80 ? 'bg-green-500' : 'bg-orange-500'}`} 
                                    style={{ width: `${styleProfile.completeness_score || 0}%` }}
                                  ></div>
                              </div>

                              {/* Missing Info Feedback */}
                              {styleProfile.missing_elements && styleProfile.missing_elements.length > 0 && (
                                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-2">
                                      <h4 className="text-xs font-bold text-orange-800 flex items-center gap-2 mb-2">
                                          <Icons.Sparkles size={12} /> The AI needs more data:
                                      </h4>
                                      <ul className="list-disc list-inside text-xs text-orange-700 space-y-1">
                                          {styleProfile.missing_elements.map((el, i) => (
                                              <li key={i}>{el}</li>
                                          ))}
                                      </ul>
                                      {styleProfile.suggestions && styleProfile.suggestions.length > 0 && (
                                          <div className="mt-3 pt-2 border-t border-orange-200/50">
                                              <span className="text-[10px] font-bold text-orange-600 uppercase">Suggestion: </span>
                                              <span className="text-xs text-orange-700">{styleProfile.suggestions[0]}</span>
                                          </div>
                                      )}
                                  </div>
                              )}
                          </div>
                      )}

                      <div className="flex-1 p-6 bg-white overflow-hidden flex flex-col">
                          {styleProfile || isEditingStyle ? (
                              isEditingStyle ? (
                                  <textarea 
                                      value={manualStyleInput}
                                      onChange={(e) => setManualStyleInput(e.target.value)}
                                      className="flex-1 w-full p-4 text-sm font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none leading-relaxed"
                                      placeholder="Define your style rules here..."
                                  />
                              ) : (
                                  <div className="flex-1 w-full p-6 text-sm font-serif text-gray-800 bg-gray-50/30 border border-gray-100 rounded-xl overflow-y-auto whitespace-pre-wrap leading-loose shadow-inner">
                                      {styleProfile.style_text}
                                  </div>
                              )
                          ) : (
                              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                      <Icons.Brain size={32} className="opacity-30" />
                                  </div>
                                  <p className="text-sm font-medium">Model Waiting for Data</p>
                                  <p className="text-xs mt-1">Add documents on the left to begin.</p>
                              </div>
                          )}
                      </div>
                      
                      {/* Simulation Playground */}
                      <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 block">Test Your Style (Simulator)</label>
                          <div className="flex gap-2">
                              <input 
                                value={simInput}
                                onChange={(e) => setSimInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleTestSimulation()}
                                placeholder="Type a raw sentence here (e.g. 'You are fired immediately')..."
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                              />
                              <button 
                                onClick={handleTestSimulation}
                                disabled={!styleProfile || isSimulating}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50 shadow-sm"
                              >
                                  {isSimulating ? '...' : 'Rewrite'}
                              </button>
                          </div>
                          {simOutput && (
                              <div className="mt-3 p-3 bg-white border border-purple-100 rounded-lg text-sm text-purple-900 font-medium animate-in fade-in slide-in-from-top-1">
                                  <span className="text-xs text-purple-400 font-bold uppercase mr-2">Result:</span>
                                  {simOutput}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Add Training Document</h3>
                      <button onClick={() => setIsUploadModalOpen(false)}><Icons.Close size={20} className="text-gray-400" /></button>
                  </div>
                  <form onSubmit={handleConfirmUpload} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">File</label>
                          <div className="text-sm text-gray-900 font-medium p-2 bg-gray-50 rounded border border-gray-200 flex items-center gap-2">
                              <Icons.FileText size={16} className="text-purple-600" />
                              {uploadFile?.name}
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                          <input required value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Document Type</label>
                          <input required value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)} placeholder="e.g. NDA, Service Agreement" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                          <select required value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 bg-white">
                              <option value="">-- Select Category --</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                      <button type="submit" disabled={isAnalyzingDoc} className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-purple-700 disabled:opacity-50 mt-2 flex justify-center items-center gap-2">
                          {isAnalyzingDoc ? <Icons.Sparkles className="animate-spin" size={16} /> : <Icons.Upload size={16} />}
                          {isAnalyzingDoc ? 'Analyzing Tone...' : 'Upload & Analyze'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* Edit Document Modal */}
      {editingDoc && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4 flex-shrink-0">
                      <h3 className="text-lg font-bold text-gray-900">Edit Training Document</h3>
                      <button onClick={() => setEditingDoc(null)}><Icons.Close size={20} className="text-gray-400" /></button>
                  </div>
                  
                  <form onSubmit={handleSaveDocEdits} className="flex-1 flex flex-col min-h-0 space-y-4">
                      <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                              <input value={editingDoc.title} onChange={(e) => setEditingDoc({...editingDoc, title: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                              <input value={editingDoc.contract_type} onChange={(e) => setEditingDoc({...editingDoc, contract_type: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                              <select value={editingDoc.category_id || ''} onChange={(e) => setEditingDoc({...editingDoc, category_id: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                  <option value="">-- None --</option>
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tone Label</label>
                              <input value={editingDoc.tone_label || ''} onChange={(e) => setEditingDoc({...editingDoc, tone_label: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                          </div>
                      </div>

                      <div className="flex-shrink-0">
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Style Summary</label>
                          <input value={editingDoc.style_summary || ''} onChange={(e) => setEditingDoc({...editingDoc, style_summary: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      </div>

                      <div className="flex-1 min-h-0 flex flex-col">
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Extracted Text (Source)</label>
                          <textarea 
                            value={editingDoc.extracted_text} 
                            onChange={(e) => setEditingDoc({...editingDoc, extracted_text: e.target.value})} 
                            className="flex-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono resize-none" 
                          />
                      </div>

                      <div className="flex justify-end gap-3 flex-shrink-0 pt-2">
                          <button type="button" onClick={() => setEditingDoc(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                          <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg">Save Changes</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {activeSection === 'roles' && (
           <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm animate-in fade-in">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Role Permissions</h2>
                <p className="text-sm text-gray-500 max-w-2xl leading-relaxed mb-6">
                    Define what each role can access in the system. Changes apply immediately.
                </p>
                
                <div className="flex gap-2 mb-6 border-b border-gray-100">
                    {Object.values(UserRole).map(role => (
                        <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedRole === role ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                        >
                            {role.replace('_', ' ').toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    {activeRoleSettings && Object.entries(activeRoleSettings.permissions).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                            <div>
                                <p className="text-sm font-medium text-gray-900 capitalize">{key.replace(/_/g, ' ')}</p>
                            </div>
                            <button 
                            onClick={() => togglePermission(key as any)}
                            className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 ease-in-out ${val ? 'bg-green-500' : 'bg-gray-200'}`}
                            >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${val ? 'translate-x-5' : ''}`}></div>
                            </button>
                        </div>
                    ))}
                </div>
           </div>
      )}

      {activeSection === 'categories' && (
           <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm animate-in fade-in">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Legal Categories</h2>
                <p className="text-sm text-gray-500 max-w-2xl leading-relaxed mb-6">
                    Organize your contracts, tasks, and training data into specific legal domains.
                </p>
                
                <div className="flex gap-2 mb-6">
                    <input 
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Enter new category name..."
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                    />
                    <button 
                        onClick={handleAddCategory}
                        disabled={!newCategoryName}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                    >
                        Add Category
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map(cat => (
                        <div key={cat.id} className="group bg-gray-50 hover:bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between transition-all hover:shadow-sm">
                            {editingCategoryId === cat.id ? (
                                <div className="flex items-center gap-2 flex-1 mr-2">
                                    <input 
                                        value={editingCategoryName}
                                        onChange={(e) => setEditingCategoryName(e.target.value)}
                                        className="w-full text-sm border-gray-300 rounded px-2 py-1 h-8"
                                        autoFocus
                                    />
                                    <button onClick={saveEditingCategory} className="text-green-600 hover:bg-green-50 p-1 rounded"><Icons.Check size={16} /></button>
                                    <button onClick={() => setEditingCategoryId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><Icons.Close size={16} /></button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => startEditingCategory(cat)}>
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-1">
                                <button onClick={() => startEditingCategory(cat)} className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Icons.Edit size={14} /></button>
                                <button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Icons.Close size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
           </div>
      )}

      {activeSection === 'general' && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <Icons.Settings className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">General Settings</h3>
              <p className="text-gray-500 mt-2">Team management, billing, and notifications coming soon.</p>
          </div>
      )}
    </div>
  );
};