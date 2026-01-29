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

    // NEW: Training Progress
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
            setIsAnalyzingDoc(false);
            setIsUploadModalOpen(false);

            setUploadFile(null);
            setUploadTitle('');
            setUploadDocType('');
            setUploadCategory('');
        };
        reader.readAsText(uploadFile);
    };

    const handleSaveDocEdits = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDoc) return;
        db.update<ContractTrainingDocument>('training_docs', editingDoc.id, editingDoc);
        refreshData();
        setEditingDoc(null);
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
                const analysis = await analyzeDocumentStyleDeep(
                    doc.extracted_text,
                    doc.contract_type,
                    getCategoryName(doc.category_id)
                );
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
        setIsEditingStyle(false);
    };

    const handleSaveManualStyle = () => {
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
        const res = await rewriteDocumentText(simInput, manualStyleInput || styleProfile?.style_text, "Reescribe usando estrictamente el estilo ADN del estudio.");
        setSimOutput(res);
        setIsSimulating(false);
    };

    const handleDeleteDoc = (id: string) => {
        if (confirm('¿Eliminar este documento del entrenamiento?')) {
            db.delete('training_docs', id);
            refreshData();
        }
    };

    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;
        db.create<ContractCategory>('contract_categories', {
            name: newCategoryName,
            description: 'Categoria personalizada',
                                    < button onClick = {() => setIsUploadModalOpen(false)}> <Icons.Close size={20} className="text-gray-400" /></button >
                                </div >
    <form onSubmit={handleConfirmUpload} className="space-y-4">
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Archivo</label>
            <div className="text-sm text-gray-900 font-medium p-2 bg-gray-50 rounded border border-gray-200 flex items-center gap-2">
                <Icons.FileText size={16} className="text-purple-600" />
                {uploadFile?.name}
            </div>
        </div>
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
            <input required value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Documento</label>
            <input required value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)} placeholder="ej. NDA, Contrato de Servicios" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
            <select required value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 bg-white">
                <option value="">-- Seleccionar Categoría --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
        </div>
        <button type="submit" disabled={isAnalyzingDoc} className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-purple-700 disabled:opacity-50 mt-2 flex justify-center items-center gap-2">
            {isAnalyzingDoc ? <Icons.Sparkles className="animate-spin" size={16} /> : <Icons.Upload size={16} />}
            {isAnalyzingDoc ? 'Analizando Tono...' : 'Subir y Analizar'}
        </button>
    </form>
                            </div >
                        </div >
                    )}

{
    editingDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">Editar Documento de Entrenamiento</h3>
                    <button onClick={() => setEditingDoc(null)}><Icons.Close size={20} className="text-gray-400" /></button>
                </div>
                <form onSubmit={handleSaveDocEdits} className="flex-1 flex flex-col min-h-0 space-y-4">
                    <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
                            <input value={editingDoc.title} onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
                            <input value={editingDoc.contract_type} onChange={(e) => setEditingDoc({ ...editingDoc, contract_type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
                            <select value={editingDoc.category_id || ''} onChange={(e) => setEditingDoc({ ...editingDoc, category_id: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- Ninguna --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Etiqueta de Tono</label>
                            <input value={editingDoc.tone_label || ''} onChange={(e) => setEditingDoc({ ...editingDoc, tone_label: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div className="flex-shrink-0">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Resumen de Estilo</label>
                        <input value={editingDoc.style_summary || ''} onChange={(e) => setEditingDoc({ ...editingDoc, style_summary: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Texto Extraído (Fuente)</label>
                        <textarea
                            value={editingDoc.extracted_text}
                            onChange={(e) => setEditingDoc({ ...editingDoc, extracted_text: e.target.value })}
                            className="flex-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono resize-none"
                        />
                    </div>
                    <div className="flex justify-end gap-3 flex-shrink-0 pt-2">
                        <button type="button" onClick={() => setEditingDoc(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
                </div >
            );
        }

if (activeSection === 'roles') {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm animate-in fade-in">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Permisos de Roles</h2>
            <p className="text-sm text-gray-500 max-w-2xl leading-relaxed mb-6">
                Defina a qué puede acceder cada rol en el sistema. Los cambios se aplican inmediatamente.
            </p>

            <div className="flex gap-2 mb-6 border-b border-gray-100">
                {Object.values(UserRole).map(role => (
                    <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedRole === role ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        {role === UserRole.SUPER_ADMIN ? 'Super Administrador' : role === UserRole.LAWYER ? 'Abogado' : role === UserRole.PARALEGAL ? 'Paralegal' : 'Asistente'}
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
    );
}

if (activeSection === 'categories') {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm animate-in fade-in">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Categorías Legales</h2>
            <p className="text-sm text-gray-500 max-w-2xl leading-relaxed mb-6">
                Organice sus contratos, tareas y datos de entrenamiento en dominios legales específicos.
            </p>

            <div className="flex gap-2 mb-6">
                <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ingrese el nombre de la nueva categoría..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
                <button
                    onClick={handleAddCategory}
                    disabled={!newCategoryName}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                    Agregar Categoría
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
    );
}

return (
    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <Icons.Settings className="text-gray-400" size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-900">Configuración General</h3>
        <p className="text-gray-500 mt-2">Gestión de equipo, facturación y notificaciones próximamente.</p>
    </div>
);
    };

return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-6">
            <div>
                <h1 className="text-3xl font-serif font-bold text-gray-900">Configuración del Estudio</h1>
                <p className="text-gray-500 mt-2">Administre la identidad de IA de su firma, categorías legales y permisos del equipo.</p>
            </div>
            <div className="flex gap-2">
                {(['ai', 'categories', 'roles', 'general'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveSection(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === tab ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {tab === 'ai' ? 'ADN de la Firma' : tab === 'categories' ? 'Categorías' : tab === 'roles' ? 'Roles' : 'General'}
                    </button>
                ))}
            </div>
        </div>

        {renderSectionContent()}
    </div>
);
};
