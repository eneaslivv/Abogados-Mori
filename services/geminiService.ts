import { ContractAnalysis, Client } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

const postJson = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Solicitud fallida: ${response.status}`);
    }

    return response.json() as Promise<T>;
};

export const analyzeDocumentStyleSingle = async (text: string): Promise<{ summary: string; tone: string }> => {
    return postJson('/ai/analyze-style-single', { text });
};

interface StyleProfileResult {
    style_text: string;
    completeness_score: number;
    missing_elements: string[];
    suggestions: string[];
}

export const generateStyleProfile = async (documentsText: string[]): Promise<StyleProfileResult> => {
    return postJson('/ai/style-profile', { documentsText });
};

export interface DocumentAnalysisDeep {
    structure: {
        has_preamble: boolean;
        clause_numbering_style: string;
        section_headers_style: string;
        signature_block_format: string;
    };
    tone: {
        formality_level: 'muy_formal' | 'formal' | 'neutral' | 'moderno';
        use_of_archaisms: string[];
        voice: 'passive' | 'active' | 'mixed';
        person: 'first_plural' | 'third_person' | 'impersonal';
    };
    signature_clauses: {
        confidentiality_approach: string;
        liability_limitation_style: string;
        dispute_resolution_preference: string;
        termination_clause_pattern: string;
    };
    argentine_legal_style: {
        uses_vos_usted: 'vos' | 'usted' | 'mixed';
        judicial_formulas: string[];
        citation_style: string;
        procedural_structure: boolean;
    };
    examples?: {
        preamble?: string;
        confidentiality_clause?: string;
        liability_clause?: string;
        dispute_clause?: string;
        termination_clause?: string;
        signature_block?: string;
    };
}

export interface MasterStyleProfile {
    style_instruction: string;
    validation_checklist: string[];
    examples: {
        good_preamble: string;
        good_clause_structure: string;
        signature_block: string;
    };
    completeness_score: number;
    missing_elements: string[];
    suggestions: string[];
}

export const analyzeDocumentStyleDeep = async (
    fullText: string,
    documentType: string,
    categoryName?: string
): Promise<DocumentAnalysisDeep> => {
    try {
        if (!fullText) {
            throw new Error("El documento no contiene texto para analizar.");
        }

        const result = await postJson<DocumentAnalysisDeep>('/ai/analyze-style-deep', { fullText, documentType, categoryName });

        if (!result.structure || !result.tone) {
            throw new Error("Análisis incompleto. Intenta con un documento más extenso.");
        }

        return result;
    } catch (error: any) {
        console.error("Error en análisis profundo:", error);
        throw new Error(`Fallo en análisis: ${error.message}`);
    }
};

export const generateContractWithStyle = async (
    contractType: string,
    clientData: Client,
    context: string,
    styleProfile?: MasterStyleProfile | string,
    categoryName?: string,
    isJudicial: boolean = false
): Promise<{ content: string; validation_report: string[] }> => {
    return postJson('/ai/contract-generate-with-style', {
        contractType,
        clientData,
        context,
        styleProfile,
        categoryName,
        isJudicial
    });
};

export const generateMasterStyleProfile = async (
    analyses: DocumentAnalysisDeep[],
    categories: string[]
): Promise<MasterStyleProfile> => {
    return postJson('/ai/style-profile-master', { analyses, categories });
};

export const generateContractPreview = async (
    contractType: string,
    clientData: Client,
    context: string,
    styleProfile?: string,
    categoryName?: string,
    trainingDocSummaries?: string,
    isJudicial: boolean = false
): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/contract-preview', {
        contractType,
        clientData,
        context,
        styleProfile,
        categoryName,
        trainingDocSummaries,
        isJudicial
    });
    return result.text;
};

export const generateContract = async (
    contractType: string,
    clientData: Client,
    context: string,
    styleProfile?: string,
    categoryName?: string,
    isJudicial: boolean = false
): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/contract-generate', {
        contractType,
        clientData,
        context,
        styleProfile,
        categoryName,
        isJudicial
    });
    return result.text;
};

export const improveContract = async (
    contractText: string,
    styleProfile?: string,
    categoryName?: string
): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/contract-improve', {
        contractText,
        styleProfile,
        categoryName
    });
    return result.text;
};

export const refineContractText = async (
    contractText: string,
    styleProfile?: string,
    objective?: string,
    categoryName?: string
): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/contract-refine', {
        contractText,
        styleProfile,
        objective,
        categoryName
    });
    return result.text;
};

export const generateClause = async (
    topic: string,
    styleProfile?: string,
    categoryName?: string
): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/contract-clause', {
        topic,
        styleProfile,
        categoryName
    });
    return result.text;
};

export const analyzeClientStrategy = async (
    clientName: string,
    history: string
): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/client-strategy', {
        clientName,
        history
    });
    return result.text;
};

export const generateClientContractSuggestions = async (
    clientName: string,
    history: string
): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/client-contract-suggestions', {
        clientName,
        history
    });
    return result.text;
};

export const analyzeContract = async (
    contractText: string,
    categoryName?: string
): Promise<Omit<ContractAnalysis, 'id' | 'contract_id' | 'tenant_id' | 'created_at'>> => {
    return postJson('/ai/contract-analyze', { contractText, categoryName });
};

export const askContract = async (
    contractText: string,
    question: string
): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/contract-ask', {
        contractText,
        question
    });
    return result.text;
};

export const extractTextFromDocument = async (base64Data: string, mimeType: string): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/document-extract-text', {
        base64Data,
        mimeType
    });
    return result.text;
};

export const cleanDocumentText = async (rawText: string): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/document-clean-text', { rawText });
    return result.text;
};

export const rewriteDocumentText = async (
    text: string,
    styleProfile?: string,
    objective?: string
): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/document-rewrite', {
        text,
        styleProfile,
        objective
    });
    return result.text;
};

export const detectDocumentTitle = async (text: string): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/document-title', { text });
    return result.text;
};

export const explainClause = async (clauseText: string): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/clause-explain', { clauseText });
    return result.text;
};

export const generateVersionDiffSummary = async (oldVersion: string, newVersion: string): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/version-diff', {
        oldVersion,
        newVersion
    });
    return result.text;
};

export const autoCategorizeDocument = async (text: string, categories: string[]): Promise<string> => {
    const result = await postJson<{ text: string }>('/ai/document-categorize', { text, categories });
    return result.text;
};

export const autoTagDocument = async (text: string): Promise<string[]> => {
    const result = await postJson<{ tags: string[] }>('/ai/document-tags', { text });
    return result.tags;
};
