import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { db } from '../services/mockDb';
import { generateStyleProfile, rewriteDocumentText, analyzeDocumentStyleSingle, analyzeDocumentStyleDeep, generateMasterStyleProfile, DocumentAnalysisDeep } from '../services/geminiService';
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

    // Filter State
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

    // Training Progress
    const [trainingProgress, setTrainingProgress] = useState({
        stage: 'idle' as 'idle' | 'analyzing' | 'synthesizing' | 'complete',
        current: 0,
        total: 0
    });

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

    const getCategoryName = (id?: string) => {
        if (!id) return '';
        return categories.find(c => c.id === id)?.name || '';
    };

    const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setUploadFile(f);
            setUploadTitle(f.name.replace(/\.[^/.]+$/, ""));
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
            try {
                const analysis = await analyzeDocumentStyleSingle(text);
                db.create<ContractTrainingDocument>('training_docs', {
                    uploaded_by: 'user-1',
                    title: uploadTitle,
                    contract_type: uploadDocType || 'Contrato general',
                    category_id: uploadCategory || undefined,
                    file_name: uploadFile.name,
                    extracted_text: text,
                    style_summary: analysis.summary,
                    tone_label: analysis.tone,
                    created_at: new Date().toISOString(),
                    tenant_id: 'demo'
                } as any);
                refreshData();
                setIsUploadModalOpen(false);
            } catch (err) { alert("Análisis fallido"); }
            setIsAnalyzingDoc(false);
        };
        reader.readAsText(uploadFile);
    };

    const handleRegenerateStyle = async () => {
        setIsGenerating(true);
        const docs = db.getAll<ContractTrainingDocument>('training_docs');
        const categoriesDetected = Array.from(new Set(docs.map(d => getCategoryName(d.category_id)).filter(Boolean)));
        setTrainingProgress({ stage: 'analyzing', current: 0, total: docs.length });

        try {
            const deepAnalyses: DocumentAnalysisDeep[] = [];
            for (let i = 0; i < docs.length; i++) {
                const doc = docs[i];
                const analysis = await analyzeDocumentStyleDeep(doc.extracted_text, doc.contract_type, getCategoryName(doc.category_id));
                deepAnalyses.push(analysis);
                setTrainingProgress(prev => ({ ...prev, current: i + 1 }));
            }

            setTrainingProgress({ stage: 'synthesizing', current: 0, total: 1 });
            const masterProfile = await generateMasterStyleProfile(deepAnalyses, categoriesDetected as string[]);

            db.saveContractStyleProfile({
                style_text: masterProfile.style_instruction,
                completeness_score: masterProfile.completeness_score,
                missing_elements: masterProfile.missing_elements,
                suggestions: masterProfile.suggestions,
                examples: masterProfile.examples,
                validation_checklist: masterProfile.validation_checklist
            });
            setTrainingProgress({ stage: 'complete', current: 1, total: 1 });
        } catch (error) {
            console.error("Error regen style:", error);
            const texts = docs.map(d => d.extracted_text);
            const result = await generateStyleProfile(texts);
            db.saveContractStyleProfile({
                style_text: result.style_text,
                completeness_score: result.completeness_score,
                missing_elements: result.missing_elements,
                suggestions: result.suggestions
            });
            setTrainingProgress({ stage: 'complete', current: 1, total: 1 });
        }

        refreshData();
        setTimeout(() => {
            setIsGenerating(false);
            setTrainingProgress({ stage: 'idle', current: 0, total: 0 });
        }, 1500);
    };

    const handleSaveManualStyle = () => {
        db.saveContractStyleProfile({ style_text: manualStyleInput, completeness_score: 100, missing_elements: [] });
        refreshData();
        setIsEditingStyle(false);
    };

    const handleTestSimulation = async () => {
        if (!simInput.trim()) return;
        setIsSimulating(true);
        const res = await rewriteDocumentText(simInput, manualStyleInput || styleProfile?.style_text, "Reescribe usando estrictamente el estilo ADN del estudio.");
        setSimOutput(res);
        setIsSimulating(false);
    };

    const handleDeleteDoc = (id: string) => {
        if (confirm('¿Eliminar este documento?')) {
            db.delete('training_docs', id);
            refreshData();
        }
    };

    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;
        db.create('contract_categories', { name: newCategoryName, description: 'Personalizada' } as any);
        setNewCategoryName('');
        refreshData();
    };

    const startEditingCategory = (cat: ContractCategory) => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); };
    const saveEditingCategory = () => { if (editingCategoryId) { db.update('contract_categories', editingCategoryId, { name: editingCategoryName }); setEditingCategoryId(null); refreshData(); } };
    const handleDeleteCategory = (id: string) => { if (confirm('¿Eliminar categoría?')) { db.delete('contract_categories', id); refreshData(); } };

    const activeRoleSettings = roles.find(r => r.role === selectedRole);
    const togglePermission = (key: keyof RoleSettings['permissions']) => {
        if (!activeRoleSettings) return;
        const updated = { ...activeRoleSettings.permissions, [key]: !activeRoleSettings.permissions[key] };
        db.update('roles_settings', activeRoleSettings.id, { permissions: updated });
        refreshData();
    };

    const filteredDocs = filterDocCategory === 'ALL' ? trainingDocs : trainingDocs.filter(d => d.category_id === filterDocCategory);

    const renderSectionContent = () => {
        if (activeSection === 'general') {
            return (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4"><Icons.Settings className="text-gray-400" size={32} /></div>
                    <h3 className="text-lg font-bold text-gray-900">Configuración General</h3>
                    <p className="text-gray-500 mt-2">Próximamente gestión de equipo y facturación.</p>
                </div>
            );
        }

        if (activeSection === 'roles') {
            return (
                <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Permisos de Roles</h2>
                    <div className="flex gap-2 mb-6 border-b border-gray-100">
                        {Object.values(UserRole).map(role => (
                            <button key={role} onClick={() => setSelectedRole(role)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedRole === role ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>
                                {role === UserRole.SUPER_ADMIN ? 'Super Admin' : role === UserRole.LAWYER ? 'Abogado' : role === UserRole.PARALEGAL ? 'Paralegal' : 'Asistente'}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {activeRoleSettings && Object.entries(activeRoleSettings.permissions).map(([key, val]) => (
                            <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                                <span className="text-sm font-medium text-gray-900 capitalize">{key.replace(/_/g, ' ')}</span>
                                <button onClick={() => togglePermission(key as any)} className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${val ? 'bg-green-500' : 'bg-gray-200'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${val ? 'translate-x-5' : ''}`}></div>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (activeSection === 'categories') {
            return (
                <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Categorías Legales</h2>
                    <div className="flex gap-2 mb-6">
                        <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nueva categoría..." className="flex-1 border rounded-lg px-4 py-2 text-sm" />
                        <button onClick={handleAddCategory} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium">Agregar</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {categories.map(cat => (
                            <div key={cat.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between border border-gray-200">
                                <span className="text-sm font-medium">{cat.name}</span>
                                <button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-400 hover:text-red-500"><Icons.Close size={16} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // ADN DE LA FIRMA (AI)
        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div><h3 className="text-lg font-bold text-gray-900">Documentos de Entrenamiento</h3><p className="text-sm text-gray-500">Documentos que definen el estilo de su firma.</p></div>
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-purple-700 bg-purple-50 px-4 py-2 rounded-lg text-sm font-bold border border-purple-200"><Icons.Upload size={16} /> Subir Documento</button>
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelection} accept=".txt,.pdf,.md" />
                            </div>

                            <div className="space-y-3">
                                {filteredDocs.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200"><Icons.FileText className="text-purple-600" size={20} /></div>
                                            <div><h4 className="text-sm font-bold text-gray-900">{doc.title}</h4><p className="text-xs text-gray-500">{getCategoryName(doc.category_id)} • {doc.tone_label}</p></div>
                                        </div>
                                        <button onClick={() => handleDeleteDoc(doc.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Trash size={16} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Perfil de Identidad Maestro</h3>
                            {styleProfile ? (
                                <div className="space-y-4">
                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                        <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-neutral-500 uppercase">ADN Detectado</span><span className="text-xl font-bold text-purple-700">{styleProfile.completeness_score}%</span></div>
                                        <div className="w-full bg-purple-200 h-2 rounded-full overflow-hidden"><div className="bg-purple-600 h-full" style={{ width: `${styleProfile.completeness_score}%` }}></div></div>
                                    </div>
                                    <button onClick={handleRegenerateStyle} className="w-full bg-purple-600 text-white py-2 rounded-lg font-bold text-sm shadow-md hover:bg-purple-700">Reentrenar ADN</button>
                                </div>
                            ) : (
                                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl"><p className="text-sm text-gray-500 mb-4">No hay un perfil de estilo activo todavía.</p><button onClick={handleRegenerateStyle} className="text-purple-600 font-bold text-sm">Crear Perfil con IA</button></div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Training Modal */}
                {isGenerating && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl text-center">
                            <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6"><Icons.Sparkles className="text-purple-600 animate-pulse" size={40} /></div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{trainingProgress.stage === 'analyzing' ? 'Analizando Identidad...' : 'Sintetizando ADN Maestro...'}</h3>
                            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-4"><div className="bg-purple-600 h-full transition-all duration-500" style={{ width: `${(trainingProgress.current / trainingProgress.total) * 100}%` }}></div></div>
                            <p className="text-sm text-gray-500 font-medium">Procesando {trainingProgress.current} de {trainingProgress.total} documentos</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-6">
                <div><h1 className="text-3xl font-serif font-bold text-gray-900">Configuración</h1><p className="text-gray-500 mt-2">Personalice las capacidades de su estudio jurídico.</p></div>
                <div className="flex gap-2">
                    {(['ai', 'categories', 'roles', 'general'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveSection(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === tab ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {tab === 'ai' ? 'ADN de la Firma' : tab === 'categories' ? 'Categorías' : tab === 'roles' ? 'Roles' : 'General'}
                        </button>
                    ))}
                </div>
            </div>
            {renderSectionContent()}

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Subir Documento</h3><button onClick={() => setIsUploadModalOpen(false)}><Icons.Close /></button></div>
                        <form onSubmit={handleConfirmUpload} className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label><input required value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label><select required value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <button type="submit" disabled={isAnalyzingDoc} className="w-full bg-purple-600 text-white py-2 rounded-lg font-bold">Subir y Analizar</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
