
import { GoogleGenAI } from "@google/genai";
import { Contract, Client, ContractAnalysis } from '../types';

// NOTE: In a real production app, never expose API keys in frontend code.
// This should be proxied through a backend.
// For this challenge, we assume process.env.API_KEY is available.

const API_KEY = process.env.API_KEY || ''; // Ensure you have this in your environment or replace for testing
const ai = new GoogleGenAI({ apiKey: API_KEY });
const modelId = 'gemini-2.5-flash';

// --- A) Style Extraction ---

// New: Analyze Single Document Style
export const analyzeDocumentStyleSingle = async (text: string): Promise<{ summary: string, tone: string }> => {
    if (!API_KEY) return { summary: "Simulation: Style analysis.", tone: "Neutral" };

    const prompt = `You are LegalFlow AI. Analyze the writing style of the following specific legal document.
    
    Document Snippet:
    ${text.substring(0, 5000)}
    
    Tasks:
    1. Identify the specific TONE (e.g., "Strict & Formal", "Modern & Direct", "Protective", "Archaic"). Return this as a short label.
    2. Write a brief 1-sentence summary of the stylistic patterns found (e.g., "Uses passive voice and extensive definitions.").
    
    Return JSON: { "tone": "string", "summary": "string" }`;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{"tone": "Unknown", "summary": "Could not analyze."}');
    } catch (error) {
        return { tone: "Unknown", summary: "Analysis failed." };
    }
};

interface StyleProfileResult {
    style_text: string;
    completeness_score: number;
    missing_elements: string[];
    suggestions: string[];
}

export const generateStyleProfile = async (documentsText: string[]): Promise<StyleProfileResult> => {
  if (!API_KEY) return {
      style_text: "Simulation: API Key missing. Style profile generated.",
      completeness_score: 50,
      missing_elements: ["API Key"],
      suggestions: ["Check environment variables"]
  };
  
  // Limit text size per doc to avoid token limits while getting essence
  const allText = documentsText.map(t => t.substring(0, 4000)).join('\n\n---\n\n');
  
  const prompt = `You are LegalFlow AI. Analyze the following set of legal documents to build a unified "Firm DNA" Writing Profile. 
  
  The goal is to capture the exact "voice" of this law firm so future contracts sound exactly like they wrote them.
  
  FOCUS HEAVILY ON:
  1. **Tone & Rhythm**: Is it aggressive? Defensive? Conciliatory? Does it use long, flowing sentences or short, punchy ones?
  2. **Vocabulary**: specific legal archaisms used (e.g., "witnesseth", "hereinbefore") vs modern plain English.
  3. **Clause Structure**: How do they title clauses? Do they use ALL CAPS, Bold, or specific numbering (1.1 vs First)?
  4. **Liability & Risk**: How heavily do they disclaim liability? What is their standard approach to indemnification?
  5. **Category Specifics**: Note if there are specific styles for Family Law, Litigation, etc.
  
  Documents: ${allText} 
  
  RETURN A JSON OBJECT:
  {
    "style_text": "A structured, detailed style profile text that a lawyer can read and edit. It should serve as the 'System Instruction' for future drafting.",
    "completeness_score": number, // 0-100. How comprehensive is this profile? Do we have examples of standard clauses, definitions, etc?
    "missing_elements": ["string"], // List what is missing (e.g., "No examples of Confidentiality Clauses", "No Dispute Resolution style found")
    "suggestions": ["string"] // Specific documents the user should upload to improve the model (e.g., "Upload an NDA", "Upload a Service Agreement")
  }`;

  try {
    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    const txt = response.text || "{}";
    return JSON.parse(txt);
  } catch (error) {
    console.error("AI Error:", error);
    return {
        style_text: "Error generating style profile. Please try again.",
        completeness_score: 0,
        missing_elements: ["Analysis Failed"],
        suggestions: ["Retry analysis"]
    };
  }
};

// --- PREVIEW: Contract Consistency Checker ---
export const generateContractPreview = async (
    contractType: string,
    clientData: Client,
    context: string,
    styleProfile?: string,
    categoryName?: string,
    trainingDocSummaries?: string,
    isJudicial: boolean = false
  ): Promise<string> => {
    if (!API_KEY) return "Simulation: API Key missing. Preview generated.";
  
    const clientInfoStr = `
      Full Name: ${clientData.full_name}
      Type: ${clientData.client_type}
      Document (ID): ${clientData.document_type} ${clientData.document_number}
      Address: ${clientData.address || '[ADDRESS MISSING]'}
      City/Zip: ${clientData.city || ''} ${clientData.zip_code || ''}
    `;
    
    const prompt = `You are LegalFlow AI. Before generating the ${isJudicial ? 'JUDICIAL WRITING (Escrito Judicial)' : 'Contract'}, analyze all inputs and produce a preview summary.
    
    Inputs:
    Client Data: ${clientInfoStr}
    Type: ${contractType}
    Category: ${categoryName || 'General'}
    Context Provided: ${context}
    ${isJudicial ? 'MODE: Generating a Judicial Writing (Escrito Judicial). Structure must follow Argentine procedural rules (Encabezado, Objeto, Hechos, Derecho, Petitorio).' : ''}
    
    Tasks:
    1) Summarize what information will be used.
    2) Identify inconsistencies or missing fields.
    3) ${categoryName ? `Analyze if the request aligns with the category: ${categoryName}.` : ''}
    4) Provide a mock-outline of the structure.
    
    Format the output clearly with headers:
    ## Summary
    ## Detected Issues
    ## Category Alignment (${categoryName})
    ## Structure Preview
    `;
  
    try {
      const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
      });
      return response.text || "Could not generate preview.";
    } catch (error) {
      console.error("AI Error:", error);
      return "Error generating preview.";
    }
  };

// --- B) Contract Generation ---
export const generateContract = async (
  contractType: string,
  clientData: Client,
  context: string,
  styleProfile?: string,
  categoryName?: string,
  isJudicial: boolean = false
): Promise<string> => {
  if (!API_KEY) return "Simulation: API Key missing. Contract generated.";

  const clientInfoStr = `
    Full Name: ${clientData.full_name}
    Type: ${clientData.client_type}
    Document (ID): ${clientData.document_type} ${clientData.document_number}
    Address: ${clientData.address || '[ADDRESS MISSING]'}
    City/Zip: ${clientData.city || ''} ${clientData.zip_code || ''}
  `;
  
  const prompt = `You are LegalFlow AI, specialized in Argentine legal drafting. 
  
  TASK: Generate a ${isJudicial ? 'FORMAL JUDICIAL WRITING (Escrito Judicial)' : 'LEGAL CONTRACT'}
  CATEGORY: ${categoryName || 'General'}
  
  ${styleProfile ? `FIRM STYLE PROFILE (MANDATORY): \n${styleProfile}` : ''}
  
  Title/Type: ${contractType}
  
  CLIENT DATA (STRICT):
  ${clientInfoStr}
  
  Context: ${context}
  
  Instructions: 
  1. Adaptar la redacción, tono, cláusulas y estructura al tipo de materia legal seleccionada: ${categoryName || 'General'}. Mantener el estilo característico del estudio, pero aplicar las convenciones propias de esta área del derecho.
  
  ${isJudicial ? `
  2. JUDICIAL WRITING RULES (Escrito Judicial):
     - Must follow typical Argentine judicial structure:
       a. Encabezado (Sumario, Objeto, Personería).
       b. Objeto (Claramente definido).
       c. Hechos (Relato claro y ordenado).
       d. Derecho (Fundamentación jurídica).
       e. Prueba (Ofrecimiento si corresponde).
       f. Petitorio (Puntos claros de solicitud al juez).
       g. Firma (Placeholder).
     - Tone must be respectful to the Court ("V.S.", "Su Señoría").
  ` : `
  2. CONTRACT RULES:
     - Use standard clauses for the category ${categoryName}.
     - Ensure clear definitions and liability clauses.
  `}
  
  3. STRICT DATA RULE: You MUST use the provided Client Data. Insert placeholders like [INSERT_DATA] if missing.
  
  Return only the final legal text.`;

  try {
    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
    });
    return response.text || "Could not generate contract.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Error generating contract.";
  }
};

// --- C) Contract Improvement ---
export const improveContract = async (
  contractText: string,
  styleProfile?: string,
  categoryName?: string
): Promise<string> => {
  if (!API_KEY) return "Simulation: API Key missing. Contract improved.";

  const prompt = `You are LegalFlow AI. Improve the following legal text ${styleProfile ? "while preserving the law firm’s writing identity" : "for clarity and legal robustness"}.
  
  ${styleProfile ? `FIRM STYLE PROFILE:\n${styleProfile}` : ''}
  ${categoryName ? `Legal Category: ${categoryName}` : ''}
  
  Text to Improve: ${contractText}
  
  Instructions: 
  1. Adaptar la redacción, tono, cláusulas y estructura al tipo de materia legal seleccionada: ${categoryName || 'General'}.
  2. Maintain tone, formality, formatting, and clause structure.
  
  Return only the improved text.`;

  try {
    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
    });
    return response.text || "Could not improve contract.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Error improving contract.";
  }
};

// --- C.2) Refine Contract Text (New) ---
export const refineContractText = async (
  contractText: string,
  styleProfile?: string,
  objective?: string,
  categoryName?: string
): Promise<string> => {
  if (!API_KEY) return "Simulation: API Key missing. Contract refined.";

  const prompt = `You are LegalFlow AI. Rewrite or refine the following text.
  
  ${styleProfile ? `STYLE PROFILE (Must Follow): \n${styleProfile}` : 'STYLE: Professional Legal Standard.'}
  ${categoryName ? `LEGAL CATEGORY: ${categoryName}` : ''}
  
  USER OBJECTIVE / INSTRUCTION:
  ${objective || "Improve clarity and legal robustness."}
  
  TEXT:
  ${contractText}
  
  Return ONLY the rewritten text.`;

  try {
    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
    });
    return response.text || contractText;
  } catch (error) {
    console.error("AI Error:", error);
    return contractText;
  }
};

// --- D) Clause Generation ---
export const generateClause = async (
  topic: string,
  styleProfile?: string,
  categoryName?: string
): Promise<string> => {
  if (!API_KEY) return "Simulation: API Key missing. Clause generated.";

  const prompt = `You are LegalFlow AI. Generate a single legal clause.
  
  ${styleProfile ? `Writing Style: ${styleProfile}` : ''}
  Category: ${categoryName || 'General'}
  Topic: ${topic}
  
  Instructions:
  Adaptar la redacción al tipo de materia legal seleccionada: ${categoryName}.
  
  Return only the clause text.`;

  try {
    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
    });
    return response.text || "Could not generate clause.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Error generating clause.";
  }
};

// --- E) Client Strategy Analysis ---
export const analyzeClientStrategy = async (
  clientName: string,
  history: string
): Promise<string> => {
  if (!API_KEY) return "Simulation: API Key missing. Strategy generated based on history.";

  const prompt = `You are LegalFlow AI, a strategic legal assistant. Analyze the history of the client "${clientName}" and suggest the next best legal actions.
  
  Client History:
  ${history}
  
  Return a concise strategic summary (bullet points) identifying pending risks, suggested new contracts, or follow-up tasks.`;

  try {
    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
    });
    return response.text || "Could not generate strategy.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Error generating strategy.";
  }
};

export const generateClientContractSuggestions = async (
    clientName: string,
    history: string
  ): Promise<string> => {
    if (!API_KEY) return "Simulation: API Key missing.";
  
    const prompt = `You are LegalFlow AI. Based on the client's history, suggest 3 specific contracts or judicial writings that should be drafted next.
    
    Client: ${clientName}
    History: ${history}
    
    Return ONLY a list of 3 contract titles in bullet points.`;
  
    try {
      const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
      });
      return response.text || "";
    } catch (error) {
      console.error("AI Error:", error);
      return "";
    }
  };

// --- F) Deep Contract Analysis (New) ---
export const analyzeContract = async (
    contractText: string,
    categoryName?: string
  ): Promise<Omit<ContractAnalysis, 'id' | 'contract_id' | 'tenant_id' | 'created_at'>> => {
    if (!API_KEY) throw new Error("API Key Missing");

    const prompt = `You are LegalFlow AI using Gemini Pro Search. Analyze the following contract/writing and produce a structured summary.
    
    Legal Category/Domain: ${categoryName || 'General'}
    
    Document:
    ${contractText}
    
    TASKS:
    1) Executive Summary
    2) Key Clauses
    3) Obligations
    4) Risks
    5) Missing clauses based on category: ${categoryName}
    
    Return ONLY a valid JSON object with the structure:
    {
      "summary": "string",
      "key_clauses": [{"title": "string", "content": "string", "type": "standard" | "unusual"}],
      "risks": [{"severity": "High" | "Medium" | "Low", "description": "string", "clause_ref": "string"}],
      "obligations": [{"party": "Client" | "Counterparty" | "Both", "description": "string"}],
      "missing_clauses": [{"name": "string", "reason": "string"}],
      "recommended_changes": "string",
      "highlighted_variables": [{"label": "string", "value": "string"}]
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const jsonText = response.text || "{}";
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Analysis Error:", error);
        throw error;
    }
};

// --- G) Contract Q&A (Ask this Contract) ---
export const askContract = async (
    contractText: string,
    question: string
): Promise<string> => {
    if (!API_KEY) return "Simulation: API Key missing.";

    const prompt = `You are LegalFlow AI powered by Gemini Pro Search. Answer the following question strictly based on the contract text provided.
    
    Question: ${question}
    
    Contract Context:
    ${contractText}
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt
        });
        return response.text || "No answer generated.";
    } catch (error) {
        console.error("QA Error:", error);
        return "Error responding to question.";
    }
};

// --- H) PDF & Document Tools ---

export const extractTextFromDocument = async (base64Data: string, mimeType: string): Promise<string> => {
    if (!API_KEY) return "Simulation: API Key missing for extraction.";
    
    const prompt = "Extract all the text from this document verbatim. Preserve structure where possible.";
    
    try {
      const response = await ai.models.generateContent({
          model: modelId,
          contents: {
              parts: [
                  { inlineData: { mimeType, data: base64Data } },
                  { text: prompt }
              ]
          }
      });
      return response.text || "";
    } catch (error) {
      console.error("Extraction Error:", error);
      return "Error extracting text from document.";
    }
  };

export const cleanDocumentText = async (rawText: string): Promise<string> => {
  if (!API_KEY) return rawText;

  const prompt = `You are LegalFlow AI. Clean and reconstruct the following legal document text.
  
  Tasks:
  1. Fix broken line breaks.
  2. Remove page numbers/footers.
  3. Standardize structure.
  
  Return ONLY the cleaned document text.
  
  Text: 
  ${rawText.substring(0, 30000)} 
  `;

  try {
    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt
    });
    return response.text || rawText;
  } catch (error) {
    console.error("Clean Error:", error);
    return rawText;
  }
};

export const rewriteDocumentText = async (
    text: string, 
    styleProfile?: string, 
    objective?: string
): Promise<string> => {
    if (!API_KEY) return "API Key Missing. Rewrite simulation.";

    const prompt = `You are LegalFlow AI. Rewrite the following legal document text.
    
    ${styleProfile ? `STYLE GUIDELINES (Use Firm DNA): \n${styleProfile}` : 'STYLE: Professional Legal Standard.'}
    ${objective ? `USER OBJECTIVE/INSTRUCTION: \n${objective}` : 'OBJECTIVE: Clean up and normalize the text.'}
    
    DOCUMENT TEXT:
    ${text.substring(0, 20000)}
    
    Return ONLY the rewritten text.`;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt
        });
        return response.text || text;
    } catch (error) {
        console.error("Rewrite Error:", error);
        return text;
    }
};

export const detectDocumentTitle = async (text: string): Promise<string> => {
    if (!API_KEY) return "Untitled Document";
  
    const prompt = `You are LegalFlow AI. Infer a professional title for this legal document.
    
    Document Start:
    ${text.substring(0, 1000)}
    
    Return ONLY the title string.`;
  
    try {
      const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt
      });
      return (response.text || "Untitled Document").replace(/"/g, '').trim();
    } catch (error) {
      return "Untitled Document";
    }
};

export const explainClause = async (clauseText: string): Promise<string> => {
    if (!API_KEY) return "API Key Missing";

    const prompt = `You are LegalFlow AI. Explain the following legal clause in plain language.
    
    Clause:
    ${clauseText}
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt
        });
        return response.text || "Could not explain clause.";
    } catch (error) {
        return "Error explaining clause.";
    }
};

export const generateVersionDiffSummary = async (oldVersion: string, newVersion: string): Promise<string> => {
    if (!API_KEY) return "Difference summary simulation.";

    const prompt = `You are LegalFlow AI. Compare the following two versions and explain differences.
    
    Old Version: ${oldVersion.substring(0, 10000)}
    New Version: ${newVersion.substring(0, 10000)}
    
    Return a concise difference summary.`;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt
        });
        return response.text || "No differences detected.";
    } catch (error) {
        return "Error generating diff summary.";
    }
};

// --- I) Document Management AI (Auto-Categorize & Tag) ---

export const autoCategorizeDocument = async (text: string, categories: string[]): Promise<string> => {
    if (!API_KEY) return "Other";
  
    const prompt = `You are LegalFlow AI. Categorize the document into one of the available categories.
    
    Categories: ${categories.join(', ')}
    
    KEYWORDS TO CHECK:
    - Juicios: juicios, demandas, procesos judiciales, escritos judiciales
    - Derecho de Familia: familia, régimen de comunicación, tenencia, guarda, patria potestad
    - Divorcios: divorcio, separación, convenio regulador, disolución matrimonial
    - Alimentos: cuota alimentaria, alimentos, manutención, obligación alimentaria
    - Sucesiones: sucesión, herencia, bienes hereditarios, declaratoria, testamento
    
    Document Text Sample:
    ${text.substring(0, 2000)}...
    
    Instructions:
    1. Check for keywords first.
    2. Pick the BEST fitting category from the list above.
    3. Return ONLY the category name.
    `;
  
    try {
      const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt
      });
      const result = (response.text || "Other").trim().replace(/"/g, '');
      return categories.find(c => c.toLowerCase() === result.toLowerCase()) || "Other";
    } catch (error) {
      return "Other";
    }
};

export const autoTagDocument = async (text: string): Promise<string[]> => {
    if (!API_KEY) return [];
  
    const prompt = `You are LegalFlow AI. Add 3–8 relevant tags.
    
    Document:
    ${text.substring(0, 2000)}...
    
    Return ONLY a comma-separated list of tags.
    `;
  
    try {
      const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt
      });
      const txt = response.text || "";
      return txt.split(',').map(s => s.trim()).filter(s => s.length > 0);
    } catch (error) {
      return [];
    }
};
