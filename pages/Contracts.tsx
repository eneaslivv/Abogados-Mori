import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icons } from '../components/Icons';
import { db } from '../services/mockDb';
import { generateContract, improveContract, generateClause, generateContractPreview, analyzeContract, askContract, cleanDocumentText, detectDocumentTitle, explainClause, extractTextFromDocument, generateVersionDiffSummary, refineContractText, generateContractWithStyle } from '../services/geminiService';
import { Contract, Client, ContractStatus, ContractCategory, ContractTrainingDocument, ContractAnalysis, ExternalContract, ExtractedDocument, ContractVersion } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';

const COMMON_CONTRACT_TYPES = [
    "Acuerdo de Confidencialidad (NDA)",
    "Contrato de Servicios",
    "Contrato de Trabajo",
    "Contrato de Alquiler",
    "Contrato de Compraventa",
    "Acuerdo de Asociación",
    "Memorando de Entendimiento (MOU)",
    "Poder Especial",
    "Acuerdo de Transacción",
    "Acuerdo de Accionistas",
    "Contrato de Consultoría",
    "Contrato de Licencia",
    "Política de Privacidad",
    "Términos de Servicio"
];

// Unified Type for List View
interface UnifiedDocument {
    id: string;
    type: 'contract' | 'pdf';
    title: string;
    status: string;
    date: string;
    clientName: string;
    categoryName?: string;
    raw?: Contract | ExtractedDocument;
}

type StyleMode = 'firm' | 'neutral' | 'custom';

export const Contracts: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'list' | 'editor' | 'analysis' | 'pdf_viewer'>('list');

    // Data
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [extractedDocs, setExtractedDocs] = useState<ExtractedDocument[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [categories, setCategories] = useState<ContractCategory[]>([]);
    const [trainingDocs, setTrainingDocs] = useState<ContractTrainingDocument[]>([]);
    const [styleProfile, setStyleProfile] = useState<string>('');

    // List View State (Search & Filters)
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'alpha'>('newest');
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    // Editor State
    const [editingContract, setEditingContract] = useState<Partial<Contract>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiPromptOpen, setAiPromptOpen] = useState(false);
    const [clausePromptOpen, setClausePromptOpen] = useState(false);
    const [showUnderstandingPanel, setShowUnderstandingPanel] = useState(false);

    // Drafting Assistant State (New)
    const [draftingObjective, setDraftingObjective] = useState('');
    const [styleMode, setStyleMode] = useState<StyleMode>('firm');
    const [customStyle, setCustomStyle] = useState('');
    const [editorSidebarTab, setEditorSidebarTab] = useState<'context' | 'drafting'>('drafting');

    // Sidebar Edit States (Client Context)
    const [editingClientMode, setEditingClientMode] = useState(false);
    const [clientEdits, setClientEdits] = useState<Partial<Client>>({});

    // PDF Viewer State
    const [selectedPdf, setSelectedPdf] = useState<ExtractedDocument | null>(null);
    const [pdfViewMode, setPdfViewMode] = useState<'clean' | 'raw'>('clean');

    // Analysis State
    const [currentAnalysis, setCurrentAnalysis] = useState<ContractAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [qaInput, setQaInput] = useState('');
    const [qaHistory, setQaHistory] = useState<{ q: string, a: string }[]>([]);
    const [qaLoading, setQaLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [analysisSection, setAnalysisSection] = useState<'overview' | 'risks' | 'clauses' | 'chat'>('overview');

    // PDF Tool State
    const [variables, setVariables] = useState<{ label: string, value: string }[]>([]);
    const [summary, setSummary] = useState('');
    const [selectionExplanation, setSelectionExplanation] = useState('');
    const [pdfSidebarTab, setPdfSidebarTab] = useState<'chat' | 'variables' | 'summary'>('chat');

    // Preview State
    const [previewContent, setPreviewContent] = useState<string>('');
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [pendingGenData, setPendingGenData] = useState<{ clientId: string, type: string, context: string, useStyle: boolean, isJudicial: boolean } | null>(null);

    // Versioning State
    const [versions, setVersions] = useState<ContractVersion[]>([]);
    const [showVersionPanel, setShowVersionPanel] = useState(false);
    const [selectedVersionDiff, setSelectedVersionDiff] = useState<ContractVersion | null>(null);
    const [diffSummary, setDiffSummary] = useState('');
    const [isDiffing, setIsDiffing] = useState(false);

    // Validation Report State
    const [validationReport, setValidationReport] = useState<string[] | null>(null);
    const [showValidationModal, setShowValidationModal] = useState(false);

    // File Input Ref for Upload
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Refresh Data
    const refreshData = () => {
        setContracts(db.getAll('contracts'));
        setExtractedDocs(db.getAll('extracted_documents'));
        setClients(db.getAll('clients'));
        setCategories(db.getAll('contract_categories'));
        setTrainingDocs(db.getAll('training_docs'));
        const profile = db.getContractStyleProfile();
        setStyleProfile(profile?.style_text || '');
    };

    useEffect(() => {
        refreshData();
    }, []);

    // Scroll to bottom of chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [qaHistory]);

    // Check for navigation state (e.g. creating from Client page)
    useEffect(() => {
        if (location.state?.clientId && activeTab === 'list') {
            handleCreateNew(location.state.clientId, location.state.initialTitle);
        } else if (location.state?.initialTitle && activeTab === 'list') {
            handleCreateNew(undefined, location.state.initialTitle);
        }
    }, [location]);

    // --- Computed Data ---
    const getClientName = (id?: string) => {
        if (!id) return 'Sin Asignar';
        return clients.find(c => c.id === id)?.full_name || 'Cliente Desconocido';
    };

    const getCategoryName = (id?: string) => {
        if (!id) return '';
        return categories.find(c => c.id === id)?.name || '';
    };

    const getClient = (id?: string) => clients.find(c => c.id === id);

    const unifiedDocuments = useMemo(() => {
        const docs: UnifiedDocument[] = [];

        // Add Contracts
        contracts.forEach(c => {
            docs.push({
                id: c.id,
                type: 'contract',
                title: c.title,
                status: c.status,
                date: c.updated_at,
                clientName: getClientName(c.client_id),
                categoryName: getCategoryName(c.category_id),
                raw: c
            });
        });

        // Add PDFs
        extractedDocs.forEach(p => {
            docs.push({
                id: p.id,
                type: 'pdf',
                title: p.title,
                status: 'Importado',
                date: p.created_at,
                clientName: 'Fuente Externa',
                categoryName: 'Transcripción PDF',
                raw: p
            });
        });

        // Filter & Sort
        let result = docs;

        // 1. Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(d =>
                d.title.toLowerCase().includes(q) ||
                d.clientName.toLowerCase().includes(q)
            );
        }

        // 2. Filter Status
        if (filterStatus !== 'ALL') {
            if (filterStatus === 'Imported') {
                result = result.filter(d => d.type === 'pdf');
            } else {
                result = result.filter(d => d.status === filterStatus);
            }
        }

        // 3. Filter Category
        if (filterCategory !== 'ALL') {
            result = result.filter(d => {
                const c = d.raw as Contract; // Casting safely enough for id check
                return c.category_id === filterCategory;
            });
        }

        // 4. Sort
        result.sort((a, b) => {
            if (sortOrder === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
            if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
            if (sortOrder === 'alpha') return a.title.localeCompare(b.title);
            return 0;
        });

        return result;
    }, [contracts, extractedDocs, clients, searchQuery, filterStatus, filterCategory, sortOrder]);


    // --- Handlers ---

    const handleCreateNew = (clientId?: string, initialTitle?: string) => {
        setEditingContract({
            title: initialTitle || 'Contrato sin Título',
            content: '',
            status: ContractStatus.DRAFT,
            contract_type: initialTitle || 'Contrato de Servicios',
            client_id: clientId || undefined,
            version_number: 1
        });
        setVersions([]);
        setActiveTab('editor');
        setShowUnderstandingPanel(true);
        if (clientId) {
            const c = clients.find(cl => cl.id === clientId);
            if (c && c.default_contract_type) {
                setEditingContract(prev => ({
                    ...prev,
                    contract_type: c.default_contract_type
                }));
            }
        }
    };

    const handleClientChange = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        return client;
    };

    const handleSaveClientEdits = async () => {
        if (!editingContract.client_id) return;
        db.update<Client>('clients', editingContract.client_id, clientEdits);
        setClients(prev => prev.map(c => c.id === editingContract.client_id ? { ...c, ...clientEdits } : c));
        setEditingClientMode(false);
    };

    const getEffectiveStyle = () => {
        if (styleMode === 'neutral') return undefined;
        if (styleMode === 'custom') return customStyle;
        return styleProfile;
    };

    const isJudicialCategory = (categoryId?: string) => {
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return false;
        const judicialKeywords = ['juicios', 'familia', 'divorcios', 'alimentos', 'sucesiones'];
        return judicialKeywords.some(kw => cat.name.toLowerCase().includes(kw));
    };

    const handleRequestPreview = async (clientId: string, type: string, context: string, useStyle: boolean, isJudicial: boolean) => {
        setIsPreviewing(true);
        setPreviewContent('');
        setPendingGenData({ clientId, type, context, useStyle, isJudicial });

        const client = clients.find(c => c.id === clientId);
        if (!client) { setIsPreviewing(false); return; }

        const catName = getCategoryName(editingContract.category_id);
        const styleToUse = useStyle ? (customStyle || styleProfile) : undefined;

        const preview = await generateContractPreview(
            type, client, context, styleToUse, catName, '', isJudicial
        );

        setPreviewContent(preview);
        setIsPreviewing(false);
    };

    const handleFinalGenerate = async () => {
        if (!pendingGenData) return;
        setIsGenerating(true);
        setAiPromptOpen(false);
        const { clientId, type, context, useStyle, isJudicial } = pendingGenData;

        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        const catName = getCategoryName(editingContract.category_id);
        const styleToUse = useStyle ? (db.getContractStyleProfile()) : undefined;

        try {
            const { content, validation_report } = await generateContractWithStyle(
                type, client, context, styleToUse || undefined, catName, isJudicial
            );

            setEditingContract(prev => ({ ...prev, content, contract_type: type, client_id: clientId }));
            if (validation_report && validation_report.length > 0) {
                setValidationReport(validation_report);
                setShowValidationModal(true);
            }
            setPreviewContent('');
            setPendingGenData(null);
        } catch (error) {
            console.error("Error generating contract:", error);
            const content = await generateContract(type, client, context, styleToUse?.style_text, catName, isJudicial);
            setEditingContract(prev => ({ ...prev, content, contract_type: type, client_id: clientId }));
        }
        setIsGenerating(false);
    };

    const handleGenerateClause = async (topic: string, useStyle: boolean) => {
        setIsGenerating(true);
        setClausePromptOpen(false);
        const catName = getCategoryName(editingContract.category_id);
        const styleToUse = useStyle ? (customStyle || styleProfile) : undefined;
        const clause = await generateClause(topic, styleToUse, catName);
        setEditingContract(prev => ({ ...prev, content: (prev.content || '') + (prev.content ? '\n\n' : '') + clause }));
        setIsGenerating(false);
    };

    const handleRefine = async () => {
        if (!editingContract.content) return;
        setIsGenerating(true);
        const catName = getCategoryName(editingContract.category_id);
        const styleToUse = getEffectiveStyle();
        const refined = await refineContractText(editingContract.content, styleToUse, draftingObjective, catName);
        setEditingContract(prev => ({ ...prev, content: refined }));
        setIsGenerating(false);
    };

    const handleImproveContract = async () => {
        if (!editingContract.content) return;
        setIsGenerating(true);
        const catName = getCategoryName(editingContract.category_id);
        const styleToUse = getEffectiveStyle();
        const improved = await improveContract(editingContract.content, styleToUse, catName);
        setEditingContract(prev => ({ ...prev, content: improved }));
        setIsGenerating(false);
    };

    const handleSaveContract = () => {
        if (editingContract.id) {
            db.update('contracts', editingContract.id, editingContract as any);
        } else {
            db.create('contracts', { ...editingContract, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any);
        }
        refreshData();
        setActiveTab('list');
    };

    const handleOpenAnalysis = () => {
        if (!editingContract.id) return alert("Guarde primero.");
        setActiveTab('analysis');
        setAnalysisSection('overview');
        const existing = db.getAll<ContractAnalysis>('contract_analyses').find(a => a.contract_id === editingContract.id);
        setCurrentAnalysis(existing || null);
    };

    const handleRunAnalysis = async () => {
        if (!editingContract.content || !editingContract.id) return;
        setIsAnalyzing(true);
        const catName = getCategoryName(editingContract.category_id);
        try {
            const result = await analyzeContract(editingContract.content, catName);
            const analysis = db.create<ContractAnalysis>('contract_analyses', { contract_id: editingContract.id, ...result, created_at: new Date().toISOString() } as any);
            setCurrentAnalysis(analysis);
        } catch (e) { alert("Análisis fallido."); }
        setIsAnalyzing(false);
    };

    const handleAskQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        const content = activeTab === 'pdf_viewer' ? selectedPdf?.extracted_text_clean : editingContract.content;
        if (!qaInput.trim() || !content) return;
        setQaLoading(true);
        const question = qaInput;
        setQaInput('');
        setQaHistory(prev => [...prev, { q: question, a: '...' }]);
        const answer = await askContract(content, question);
        setQaHistory(prev => prev.map(item => item.q === question ? { q: question, a: answer } : item));
        setQaLoading(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Mock upload/extract
        alert("Archivo subido. Extrayendo texto...");
    };

    const handleOpenPdf = (doc: ExtractedDocument) => { setSelectedPdf(doc); setActiveTab('pdf_viewer'); };

    // VIEWS
    if (activeTab === 'analysis') return <div className="p-8">Vista de Análisis (Mock) <button onClick={() => setActiveTab('editor')}>Volver</button></div>;
    if (activeTab === 'pdf_viewer' && selectedPdf) return <div className="p-8">Vista PDF: {selectedPdf.title} <button onClick={() => setActiveTab('list')}>Volver</button></div>;

    if (activeTab === 'editor') {
        const isJudicial = isJudicialCategory(editingContract.category_id);
        return (
            <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white gap-4 flex-shrink-0 z-10">
                    <div className="flex items-center gap-4 flex-1">
                        <button onClick={() => setActiveTab('list')} className="text-gray-400 hover:text-gray-900 border p-1 rounded hover:bg-gray-50"><Icons.ChevronRight className="rotate-180" size={20} /></button>
                        <input value={editingContract.title} onChange={(e) => setEditingContract({ ...editingContract, title: e.target.value })} className="text-lg font-bold border-none focus:ring-0 text-gray-900" placeholder="Título" />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setAiPromptOpen(true)} className="flex items-center gap-2 text-purple-700 bg-purple-50 px-3 py-1.5 rounded-md text-sm font-bold border border-purple-100 hover:bg-purple-100"><Icons.Sparkles size={14} /> Generador IA</button>
                        <button onClick={handleSaveContract} className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-800">Guardar</button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden bg-[#F5F5F5]">
                    <div className="flex-1 bg-white shadow-sm overflow-y-auto relative mx-auto my-6 max-w-4xl border border-gray-200 min-h-[calc(100vh-160px)]">
                        {isGenerating && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Icons.Sparkles className="animate-spin text-purple-600" size={32} /></div>}
                        <textarea className="w-full h-full min-h-[800px] resize-none border-none focus:ring-0 text-gray-800 font-serif leading-loose text-lg p-16" value={editingContract.content} onChange={(e) => setEditingContract({ ...editingContract, content: e.target.value })} />
                    </div>

                    <div className="w-80 bg-white border-l border-gray-200 flex flex-col p-4 space-y-4">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Asistente de Redacción</label>
                        <textarea value={draftingObjective} onChange={(e) => setDraftingObjective(e.target.value)} placeholder="¿Qué quieres hacer?" className="w-full text-sm border-gray-300 rounded-lg p-3 h-32 resize-none" />
                        <button onClick={handleRefine} className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-purple-700">Refinar Texto</button>
                    </div>
                </div>

                {/* Modals */}
                {aiPromptOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className={`bg-white rounded-xl w-full p-6 space-y-4 ${previewContent ? 'max-w-4xl' : 'max-w-lg'}`}>
                            <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Generador IA</h3><button onClick={() => setAiPromptOpen(false)}><Icons.Close /></button></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium">Cliente</label>
                                    <select className="w-full border p-2 rounded" defaultValue={editingContract.client_id || ''} onChange={(e) => setEditingContract({ ...editingContract, client_id: e.target.value })}>
                                        <option value="">Seleccione...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                                    </select>
                                    <label className="block text-sm font-medium">Tipo de Contrato</label>
                                    <input placeholder="Personalizado..." className="w-full border p-2 rounded" defaultValue={editingContract.contract_type || ''} />
                                    <label className="block text-sm font-medium">Contexto</label>
                                    <textarea id="gen-context" className="w-full border p-2 rounded" rows={4} />
                                    <button onClick={() => {
                                        const context = (document.getElementById('gen-context') as HTMLTextAreaElement).value;
                                        handleRequestPreview(editingContract.client_id || '', editingContract.contract_type || 'Contrato', context, true, isJudicial);
                                    }} className="w-full bg-purple-600 text-white py-2 rounded font-bold">Previsualizar</button>
                                </div>
                                {previewContent && (
                                    <div className="flex flex-col gap-4">
                                        <div className="bg-gray-50 p-4 border rounded max-h-96 overflow-auto text-sm"><pre className="whitespace-pre-wrap">{previewContent}</pre></div>
                                        <button onClick={handleFinalGenerate} className="w-full bg-green-600 text-white py-2 rounded font-bold">Confirmar y Generar</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Validation Modal */}
                {showValidationModal && validationReport && (
                    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden p-6">
                            <h3 className="font-bold flex items-center gap-2 text-blue-900 border-b pb-4 mb-4"><Icons.CheckSquare size={20} /> Reporte de Validación ADN</h3>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {validationReport.map((item, i) => (
                                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${item.startsWith('✓') ? 'bg-green-50 border-green-100 text-green-900' : 'bg-red-50 border-red-100 text-red-900'}`}>{item}</div>
                                ))}
                            </div>
                            <button onClick={() => setShowValidationModal(false)} className="w-full mt-6 bg-gray-900 text-white py-2 rounded-lg font-bold">Cerrar</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // LIST VIEW
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Contratos y Documentos</h1>
                    <p className="text-sm text-gray-500">{unifiedDocuments.length} elementos gestionados</p>
                </div>
                <button onClick={() => handleCreateNew()} className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Icons.Plus size={18} /> Nuevo Contrato</button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200">
                <div className="relative flex-1">
                    <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
                </div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded-lg p-2">
                    <option value="ALL">Todos los Estados</option>
                    <option value="Draft">Borrador</option>
                    <option value="In Review">En Revisión</option>
                    <option value="Signed">Firmado</option>
                </select>
                <div className="flex border rounded-lg overflow-hidden">
                    <button onClick={() => setViewMode('table')} className={`p-2 ${viewMode === 'table' ? 'bg-gray-200' : 'bg-white'}`}><Icons.FileText size={18} /></button>
                    <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-gray-200' : 'bg-white'}`}><Icons.Dashboard size={18} /></button>
                </div>
            </div>

            {unifiedDocuments.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No hay documentos que coincidan.</p></div>
            ) : viewMode === 'table' ? (
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                            <tr>
                                <th className="px-6 py-3">Nombre</th>
                                <th className="px-6 py-3">Cliente</th>
                                <th className="px-6 py-3">Estado</th>
                                <th className="px-6 py-3">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-sm">
                            {unifiedDocuments.map(d => (
                                <tr key={d.id} onClick={() => { if (d.type === 'contract') { setEditingContract(d.raw as Contract); setActiveTab('editor'); } else { handleOpenPdf(d.raw as ExtractedDocument); } }} className="hover:bg-gray-50 cursor-pointer">
                                    <td className="px-6 py-4 flex items-center gap-3 font-medium text-gray-900">{d.type === 'contract' ? <Icons.Contracts className="text-purple-600" size={16} /> : <Icons.FileText className="text-orange-600" size={16} />}{d.title}</td>
                                    <td className="px-6 py-4 text-gray-600">{d.clientName}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.status === 'Signed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{d.status}</span></td>
                                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">{new Date(d.date).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {unifiedDocuments.map(d => (
                        <div key={d.id} onClick={() => { if (d.type === 'contract') { setEditingContract(d.raw as Contract); setActiveTab('editor'); } else { handleOpenPdf(d.raw as ExtractedDocument); } }} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md cursor-pointer flex flex-col gap-3">
                            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">{d.type === 'contract' ? <Icons.Contracts size={20} className="text-purple-600" /> : <Icons.FileText size={20} className="text-orange-600" />}</div>
                            <h3 className="font-bold text-gray-900">{d.title}</h3>
                            <p className="text-sm text-gray-500">{d.clientName}</p>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{new Date(d.date).toLocaleDateString()}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
