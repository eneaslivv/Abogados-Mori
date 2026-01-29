import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { generateFromParts, generateJson, generateText } from '../services/ai/gemini.service';

type StyleProfileResult = {
    style_text: string;
    completeness_score: number;
    missing_elements: string[];
    suggestions: string[];
};

type ContractAnalysisResult = {
    summary: string;
    key_clauses: { title: string; content: string; type: 'standard' | 'unusual' }[];
    risks: { severity: 'High' | 'Medium' | 'Low'; description: string; clause_ref: string }[];
    obligations: { party: 'Client' | 'Counterparty' | 'Both'; description: string }[];
    missing_clauses: { name: string; reason: string }[];
    recommended_changes: string;
    highlighted_variables: { label: string; value: string }[];
};

type DocumentAnalysisDeep = {
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
};

type MasterStyleProfile = {
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
};

const extractStrategicSamples = (fullText: string) => {
    const length = fullText.length;
    const samples: { section: string; text: string }[] = [];

    samples.push({ section: 'Inicio', text: fullText.substring(0, 3000) });
    const middleStart = Math.max(0, Math.floor(length / 2) - 1500);
    samples.push({ section: 'Medio', text: fullText.substring(middleStart, middleStart + 3000) });
    samples.push({ section: 'Final', text: fullText.substring(Math.max(0, length - 3000)) });

    const clauseMatches = [
        { label: 'Clausula Confidencialidad', regex: /confidencialidad|secreto|reserva/i },
        { label: 'Clausula Responsabilidad', regex: /responsabilidad|indemnizaci[oó]n|limitaci[oó]n/i },
        { label: 'Clausula Resolucion', regex: /resoluci[oó]n de conflictos|jurisdicci[oó]n|arbitraje/i },
        { label: 'Clausula Terminacion', regex: /terminaci[oó]n|rescisi[oó]n|extinci[oó]n/i }
    ];

    clauseMatches.forEach((match) => {
        const found = fullText.match(match.regex);
        if (found?.index !== undefined) {
            const start = Math.max(0, found.index - 500);
            samples.push({
                section: match.label,
                text: fullText.substring(start, Math.min(fullText.length, found.index + 1500))
            });
        }
    });

    return samples;
};

export const aiController = {
    async analyzeDocumentStyleSingle(req: Request, res: Response, next: NextFunction) {
        try {
            const { text } = req.body || {};
            if (!text) throw new AppError('text es requerido', 400);

            const prompt = `Eres LegalFlow AI. Analiza el estilo de redaccion del siguiente documento legal.

Extracto del documento:
${String(text).substring(0, 5000)}

Tareas:
1. Identifica el TONO especifico (por ejemplo: "Formal y Estricto", "Moderno y Directo", "Protectivo", "Arcaico"). Devuelve una etiqueta corta.
2. Escribe una breve oracion (1 linea) que resuma los patrones de estilo encontrados.

Devuelve JSON: { "tone": "string", "summary": "string" }`;

            const result = await generateJson<{ tone: string; summary: string }>(prompt, {
                tone: 'Desconocido',
                summary: 'No se pudo analizar.'
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async generateStyleProfile(req: Request, res: Response, next: NextFunction) {
        try {
            const { documentsText } = req.body || {};
            if (!Array.isArray(documentsText)) throw new AppError('documentsText debe ser un arreglo', 400);

            const allText = documentsText.map((t: string) => String(t).substring(0, 4000)).join('\n\n---\n\n');

            const prompt = `Eres LegalFlow AI. Analiza los siguientes documentos legales para construir un Perfil de Redaccion "ADN del Estudio".

El objetivo es capturar la voz exacta del estudio para que futuros contratos suenen como si los hubieran escrito ellos.

Enfocate en:
1. Tono y ritmo: agresivo, defensivo, conciliador; oraciones largas o cortas.
2. Vocabulario: arcaicismos legales vs. lenguaje moderno.
3. Estructura de clausulas: titulos, mayusculas, negritas, numeracion (1.1 vs Primero).
4. Responsabilidad y riesgo: exenciones, indemnidad, limites.
5. Particularidades por materia (Familia, Litigios, etc.).

Documentos: ${allText}

DEVUELVE JSON:
{
  "style_text": "Perfil detallado y editable del estilo del estudio.",
  "completeness_score": number,
  "missing_elements": ["string"],
  "suggestions": ["string"]
}`;

            const result = await generateJson<StyleProfileResult>(prompt, {
                style_text: 'Error generando el perfil de estilo. Intenta nuevamente.',
                completeness_score: 0,
                missing_elements: ['Analisis fallido'],
                suggestions: ['Reintentar analisis']
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async analyzeDocumentStyleDeep(req: Request, res: Response, next: NextFunction) {
        try {
            const { fullText, documentType, categoryName } = req.body || {};
            if (!fullText || !documentType) throw new AppError('fullText y documentType son requeridos', 400);

            const samples = extractStrategicSamples(String(fullText));
            const prompt = `Eres un experto en analisis de redaccion legal argentina. Analiza este documento en profundidad.

TIPO DE DOCUMENTO: ${documentType}
CATEGORIA: ${categoryName || 'General'}

=== MUESTRAS ESTRATEGICAS ===
${samples.map((s, i) => `--- Muestra ${i + 1}: ${s.section} ---\n${s.text}`).join('\n\n')}

=== INSTRUCCIONES ===
Analiza los siguientes aspectos CON EJEMPLOS CONCRETOS del texto:

1. ESTRUCTURA FORMAL:
   - Numeracion de clausulas exacta
   - Estilo de titulos (mayusculas, negrita, titulo)
   - Preambulo (si existe) y su formato
   - Formato del bloque de firmas

2. TONO Y VOZ:
   - Nivel de formalidad
   - Voz (pasiva/activa/mixta) con ejemplo
   - Persona gramatical
   - Arcaicismos usados

3. VOCABULARIO LEGAL ARGENTINO:
   - Uso de "V.S." o "Su Senoria"
   - Forma de citar leyes (ejemplos)
   - Uso de vos/usted

4. CLAUSULAS TIPO:
   - Confidencialidad (extracto literal)
   - Limitacion de responsabilidad (extracto literal)
   - Resolucion de conflictos (extracto literal)
   - Rescision/terminacion (extracto literal)

5. PARA ESCRITOS JUDICIALES:
   - Estructura Sumario/Objeto/Hechos/Derecho/Petitorio
   - Formulas de tratamiento al tribunal
   - Estilo de fundamentacion legal

Devuelve JSON con esta estructura y citas literales cuando sea posible:
{
  "structure": {
    "has_preamble": boolean,
    "clause_numbering_style": "string",
    "section_headers_style": "string",
    "signature_block_format": "string"
  },
  "tone": {
    "formality_level": "muy_formal" | "formal" | "neutral" | "moderno",
    "use_of_archaisms": ["string"],
    "voice": "passive" | "active" | "mixed",
    "person": "first_plural" | "third_person" | "impersonal"
  },
  "signature_clauses": {
    "confidentiality_approach": "string",
    "liability_limitation_style": "string",
    "dispute_resolution_preference": "string",
    "termination_clause_pattern": "string"
  },
  "argentine_legal_style": {
    "uses_vos_usted": "vos" | "usted" | "mixed",
    "judicial_formulas": ["string"],
    "citation_style": "string",
    "procedural_structure": boolean
  },
  "examples": {
    "preamble": "string",
    "confidentiality_clause": "string",
    "liability_clause": "string",
    "dispute_clause": "string",
    "termination_clause": "string",
    "signature_block": "string"
  }
}`;

            const result = await generateJson<DocumentAnalysisDeep>(prompt, {
                structure: {
                    has_preamble: false,
                    clause_numbering_style: 'No detectado',
                    section_headers_style: 'No detectado',
                    signature_block_format: 'No detectado'
                },
                tone: {
                    formality_level: 'neutral',
                    use_of_archaisms: [],
                    voice: 'mixed',
                    person: 'impersonal'
                },
                signature_clauses: {
                    confidentiality_approach: '',
                    liability_limitation_style: '',
                    dispute_resolution_preference: '',
                    termination_clause_pattern: ''
                },
                argentine_legal_style: {
                    uses_vos_usted: 'usted',
                    judicial_formulas: [],
                    citation_style: '',
                    procedural_structure: false
                },
                examples: {}
            }, { temperature: 0.3 });

            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async generateMasterStyleProfile(req: Request, res: Response, next: NextFunction) {
        try {
            const { analyses, categories } = req.body || {};
            if (!Array.isArray(analyses) || analyses.length === 0) throw new AppError('analyses es requerido', 400);

            const categoryList = Array.isArray(categories) ? categories : [];
            const prompt = `Eres un experto en redaccion legal argentina. A partir de los analisis de ${analyses.length} documentos, crea un MANUAL DE ESTILO COMPLETO para este estudio juridico.

=== ANALISIS INDIVIDUALES ===
${JSON.stringify(analyses, null, 2)}

=== CATEGORIAS DETECTADAS ===
${categoryList.join(', ')}

=== TU TAREA ===
Crea un "style_instruction" que capture todos los patrones detectados.

DEBE INCLUIR:
1. Reglas de estructura (numeracion, titulos, preambulo con ejemplo)
2. Reglas de tono (formalidad, voz, persona, arcaicismos)
3. Vocabulario legal argentino (tratamiento al tribunal, citas legales, vos/usted)
4. Clausulas modelo (confidencialidad, responsabilidad, conflictos, rescision)
5. Escritos judiciales (estructura y formulas) si aplica
6. Checklist de validacion (10-15 puntos)

RETORNA JSON:
{
  "style_instruction": "INSTRUCCION COMPLETA (minimo 2000 palabras)",
  "validation_checklist": ["punto 1", "punto 2"],
  "examples": {
    "good_preamble": "ejemplo literal",
    "good_clause_structure": "ejemplo literal",
    "signature_block": "ejemplo literal"
  },
  "completeness_score": 0,
  "missing_elements": ["elemento 1"],
  "suggestions": ["sugerencia 1"]
}`;

            const result = await generateJson<MasterStyleProfile>(prompt, {
                style_instruction: '',
                validation_checklist: [],
                examples: {
                    good_preamble: '',
                    good_clause_structure: '',
                    signature_block: ''
                },
                completeness_score: 0,
                missing_elements: ['Analisis insuficiente'],
                suggestions: ['Sube mas documentos']
            }, { temperature: 0.2 });

            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async generateContractPreview(req: Request, res: Response, next: NextFunction) {
        try {
            const { contractType, clientData, context, styleProfile, categoryName, trainingDocSummaries, isJudicial } = req.body || {};
            if (!contractType || !clientData || !context) throw new AppError('contractType, clientData y context son requeridos', 400);

            const clientInfoStr = `
Nombre completo: ${clientData.full_name}
Tipo: ${clientData.client_type}
Documento: ${clientData.document_type} ${clientData.document_number}
Direccion: ${clientData.address || '[DIRECCION FALTANTE]'}
Ciudad/CP: ${clientData.city || ''} ${clientData.zip_code || ''}
`;

            const prompt = `Eres LegalFlow AI. Antes de generar el ${isJudicial ? 'ESCRITO JUDICIAL' : 'Contrato'}, analiza los datos y produce una vista previa.

Entradas:
Datos del cliente: ${clientInfoStr}
Tipo: ${contractType}
Categoria: ${categoryName || 'General'}
Contexto: ${context}
${isJudicial ? 'MODO: Escrito judicial con estructura argentina (Encabezado, Objeto, Hechos, Derecho, Petitorio).' : ''}

Tareas:
1) Resume la informacion a usar.
2) Detecta inconsistencias o datos faltantes.
3) ${categoryName ? `Evalua si el pedido coincide con la categoria: ${categoryName}.` : ''}
4) Propone un esquema/estructura.

Formatea con encabezados:
## Resumen
## Inconsistencias
## Alineacion con la categoria (${categoryName})
## Estructura sugerida
${trainingDocSummaries ? `## Documentos de entrenamiento\n${trainingDocSummaries}` : ''}
${styleProfile ? `\n## Perfil de estilo\n${styleProfile}` : ''}
`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async generateContract(req: Request, res: Response, next: NextFunction) {
        try {
            const { contractType, clientData, context, styleProfile, categoryName, isJudicial } = req.body || {};
            if (!contractType || !clientData || !context) throw new AppError('contractType, clientData y context son requeridos', 400);

            const clientInfoStr = `
Nombre completo: ${clientData.full_name}
Tipo: ${clientData.client_type}
Documento: ${clientData.document_type} ${clientData.document_number}
Direccion: ${clientData.address || '[DIRECCION FALTANTE]'}
Ciudad/CP: ${clientData.city || ''} ${clientData.zip_code || ''}
`;

            const prompt = `Eres LegalFlow AI, especializado en redaccion legal argentina.

TAREA: Generar ${isJudicial ? 'ESCRITO JUDICIAL' : 'CONTRATO LEGAL'}
CATEGORIA: ${categoryName || 'General'}

${styleProfile ? `PERFIL DE ESTILO (OBLIGATORIO):\n${styleProfile}` : ''}

Titulo/Tipo: ${contractType}

DATOS DEL CLIENTE (OBLIGATORIO):
${clientInfoStr}

Contexto: ${context}

Instrucciones:
1. Adaptar la redaccion, tono, clausulas y estructura a la materia legal seleccionada: ${categoryName || 'General'}.

${isJudicial ? `2. REGLAS DE ESCRITO JUDICIAL:
- Seguir estructura argentina:
  a. Encabezado (Sumario, Objeto, Personeria).
  b. Objeto (Claro y preciso).
  c. Hechos (Relato ordenado).
  d. Derecho (Fundamentacion juridica).
  e. Prueba (Si corresponde).
  f. Petitorio (Puntos claros).
  g. Firma (Marcador).
- Tono respetuoso con el tribunal ("V.S.", "Su Senoria").
` : `2. REGLAS DE CONTRATO:
- Usar clausulas estandar para la categoria ${categoryName}.
- Incluir definiciones claras y responsabilidad.
`}

3. REGLA ESTRICTA: Debes usar los datos del cliente. Si faltan, usa [INSERTAR_DATO].

Devuelve solo el texto legal final.`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async generateContractWithStyle(req: Request, res: Response, next: NextFunction) {
        try {
            const { contractType, clientData, context, styleProfile, categoryName, isJudicial } = req.body || {};
            if (!contractType || !clientData || !context) throw new AppError('contractType, clientData y context son requeridos', 400);

            const clientInfoStr = `
Nombre completo: ${clientData.full_name}
Tipo: ${clientData.client_type}
Documento: ${clientData.document_type} ${clientData.document_number}
Direccion: ${clientData.address || '[DIRECCION FALTANTE]'}
Ciudad/CP: ${clientData.city || ''} ${clientData.zip_code || ''}
`;

            const prompt = `Eres LegalFlow AI, experto en redaccion legal argentina con aplicacion de identidad de marca.
            
TAREA: Generar ${isJudicial ? 'ESCRITO JUDICIAL' : 'CONTRATO LEGAL'} con reporte de validacion de estilo.
CATEGORIA: ${categoryName || 'General'}

PERFIL DE ESTILO MAESTRO (OBLIGATORIO):
${styleProfile ? (typeof styleProfile === 'string' ? styleProfile : JSON.stringify(styleProfile)) : 'No proporcionado. Usa estilo legal argentino estandar.'}

Titulo/Tipo: ${contractType}
Cliente: ${clientInfoStr}
Contexto: ${context}

TAREAS:
1. Genera el texto legal completo siguiendo estrictamente el Perfil de Estilo Maestro.
2. Realiza un autocontrol de calidad basado en el Perfil de Estilo.

RETORNA UN JSON CON ESTA ESTRUCTURA:
{
  "content": "EL TEXTO LEGAL COMPLETO AQUI",
  "validation_report": [
    "✓ Regla 1 cumplida",
    "✗ Regla 2 no cumplida porque...",
    "✓ Regla 3 cumplida"
  ]
}

REGLA CRITICA: El validation_report debe contener al menos 8 items de verificacion especificos del perfil de estilo.`;

            const result = await generateJson<{ content: string; validation_report: string[] }>(prompt, {
                content: 'Error generando contrato. Intenta nuevamente.',
                validation_report: ['✗ Error en comunicacion con el servicio de IA']
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async improveContract(req: Request, res: Response, next: NextFunction) {
        try {
            const { contractText, styleProfile, categoryName } = req.body || {};
            if (!contractText) throw new AppError('contractText es requerido', 400);

            const prompt = `Eres LegalFlow AI. Mejora el siguiente texto legal ${styleProfile ? 'manteniendo la identidad del estudio' : 'para claridad y robustez legal'}.

${styleProfile ? `PERFIL DE ESTILO:\n${styleProfile}` : ''}
${categoryName ? `Categoria legal: ${categoryName}` : ''}

Texto a mejorar: ${contractText}

Instrucciones:
1. Adaptar la redaccion, tono, clausulas y estructura a la materia legal: ${categoryName || 'General'}.
2. Mantener tono, formalidad, formato y estructura.

Devuelve solo el texto mejorado.`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async refineContractText(req: Request, res: Response, next: NextFunction) {
        try {
            const { contractText, styleProfile, objective, categoryName } = req.body || {};
            if (!contractText) throw new AppError('contractText es requerido', 400);

            const prompt = `Eres LegalFlow AI. Reescribe o refina el siguiente texto.

${styleProfile ? `PERFIL DE ESTILO (OBLIGATORIO):\n${styleProfile}` : 'ESTILO: Legal profesional.'}
${categoryName ? `CATEGORIA LEGAL: ${categoryName}` : ''}

OBJETIVO DEL USUARIO:
${objective || 'Mejorar claridad y solidez legal.'}

TEXTO:
${contractText}

Devuelve SOLO el texto reescrito.`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async generateClause(req: Request, res: Response, next: NextFunction) {
        try {
            const { topic, styleProfile, categoryName } = req.body || {};
            if (!topic) throw new AppError('topic es requerido', 400);

            const prompt = `Eres LegalFlow AI. Genera una sola clausula legal.

${styleProfile ? `Estilo: ${styleProfile}` : ''}
Categoria: ${categoryName || 'General'}
Tema: ${topic}

Instrucciones:
Adaptar la redaccion a la materia legal seleccionada: ${categoryName}.

Devuelve solo el texto de la clausula.`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async analyzeClientStrategy(req: Request, res: Response, next: NextFunction) {
        try {
            const { clientName, history } = req.body || {};
            if (!clientName || !history) throw new AppError('clientName y history son requeridos', 400);

            const prompt = `Eres LegalFlow AI, asistente estrategico legal. Analiza el historial del cliente "${clientName}" y sugiere los proximos pasos.

Historial:
${history}

Devuelve un resumen breve con riesgos, contratos sugeridos o tareas de seguimiento.`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async generateClientContractSuggestions(req: Request, res: Response, next: NextFunction) {
        try {
            const { clientName, history } = req.body || {};
            if (!clientName || !history) throw new AppError('clientName y history son requeridos', 400);

            const prompt = `Eres LegalFlow AI. En base al historial del cliente, sugiere 3 contratos o escritos judiciales a redactar.

Cliente: ${clientName}
Historial: ${history}

Devuelve SOLO una lista con 3 titulos en viñetas.`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async analyzeContract(req: Request, res: Response, next: NextFunction) {
        try {
            const { contractText, categoryName } = req.body || {};
            if (!contractText) throw new AppError('contractText es requerido', 400);

            const prompt = `Eres LegalFlow AI. Analiza el siguiente contrato/escrito y produce un resumen estructurado.

Categoria legal: ${categoryName || 'General'}

Documento:
${contractText}

TAREAS:
1) Resumen ejecutivo
2) Clausulas clave
3) Obligaciones
4) Riesgos
5) Clausulas faltantes segun la categoria

Devuelve SOLO un JSON con la estructura:
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

            const result = await generateJson<ContractAnalysisResult>(prompt, {
                summary: 'Analisis fallido.',
                key_clauses: [],
                risks: [],
                obligations: [],
                missing_clauses: [],
                recommended_changes: '',
                highlighted_variables: []
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async askContract(req: Request, res: Response, next: NextFunction) {
        try {
            const { contractText, question } = req.body || {};
            if (!contractText || !question) throw new AppError('contractText y question son requeridos', 400);

            const prompt = `Eres LegalFlow AI. Responde la siguiente pregunta estrictamente con base en el texto del contrato.

Pregunta: ${question}

Contexto del contrato:
${contractText}
`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async extractTextFromDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { base64Data, mimeType } = req.body || {};
            if (!base64Data || !mimeType) throw new AppError('base64Data y mimeType son requeridos', 400);

            const prompt = 'Extrae todo el texto del documento, preservando la estructura cuando sea posible.';
            const text = await generateFromParts([{ inlineData: { mimeType, data: base64Data } }], prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async cleanDocumentText(req: Request, res: Response, next: NextFunction) {
        try {
            const { rawText } = req.body || {};
            if (!rawText) throw new AppError('rawText es requerido', 400);

            const prompt = `Eres LegalFlow AI. Limpia y reconstruye el siguiente texto legal.

Tareas:
1. Corregir saltos de linea.
2. Quitar numeros de pagina y pies.
3. Estandarizar la estructura.

Devuelve SOLO el texto limpio.

Texto:
${String(rawText).substring(0, 30000)}
`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async rewriteDocumentText(req: Request, res: Response, next: NextFunction) {
        try {
            const { text, styleProfile, objective } = req.body || {};
            if (!text) throw new AppError('text es requerido', 400);

            const prompt = `Eres LegalFlow AI. Reescribe el siguiente documento legal.

${styleProfile ? `GUIA DE ESTILO (Usar ADN del estudio):\n${styleProfile}` : 'ESTILO: Legal profesional.'}
${objective ? `OBJETIVO DEL USUARIO:\n${objective}` : 'OBJETIVO: Normalizar el texto.'}

TEXTO DEL DOCUMENTO:
${String(text).substring(0, 20000)}

Devuelve SOLO el texto reescrito.`;

            const resultText = await generateText(prompt);
            res.json({ text: resultText });
        } catch (error) {
            next(error);
        }
    },

    async detectDocumentTitle(req: Request, res: Response, next: NextFunction) {
        try {
            const { text } = req.body || {};
            if (!text) throw new AppError('text es requerido', 400);

            const prompt = `Eres LegalFlow AI. Infere un titulo profesional para este documento.

Inicio del documento:
${String(text).substring(0, 1000)}

Devuelve SOLO el titulo.`;

            const title = (await generateText(prompt)).replace(/"/g, '').trim();
            res.json({ text: title || 'Documento sin titulo' });
        } catch (error) {
            next(error);
        }
    },

    async explainClause(req: Request, res: Response, next: NextFunction) {
        try {
            const { clauseText } = req.body || {};
            if (!clauseText) throw new AppError('clauseText es requerido', 400);

            const prompt = `Eres LegalFlow AI. Explica la siguiente clausula en lenguaje claro.

Clausula:
${clauseText}
`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async generateVersionDiffSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const { oldVersion, newVersion } = req.body || {};
            if (!oldVersion || !newVersion) throw new AppError('oldVersion y newVersion son requeridos', 400);

            const prompt = `Eres LegalFlow AI. Compara las siguientes versiones y explica las diferencias.

Version anterior: ${String(oldVersion).substring(0, 10000)}
Version nueva: ${String(newVersion).substring(0, 10000)}

Devuelve un resumen breve de diferencias.`;

            const text = await generateText(prompt);
            res.json({ text });
        } catch (error) {
            next(error);
        }
    },

    async autoCategorizeDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { text, categories } = req.body || {};
            if (!text || !Array.isArray(categories)) throw new AppError('text y categories son requeridos', 400);

            const prompt = `Eres LegalFlow AI. Clasifica el documento en una de las categorias disponibles.

Categorias: ${categories.join(', ')}

PALABRAS CLAVE:
- Juicios: juicios, demandas, procesos judiciales, escritos judiciales
- Derecho de Familia: familia, regimen de comunicacion, tenencia, guarda, patria potestad
- Divorcios: divorcio, separacion, convenio regulador, disolucion matrimonial
- Alimentos: cuota alimentaria, alimentos, manutencion, obligacion alimentaria
- Sucesiones: sucesion, herencia, bienes hereditarios, declaratoria, testamento

Extracto:
${String(text).substring(0, 2000)}...

Instrucciones:
1. Detecta palabras clave.
2. Elige la categoria mas adecuada.
3. Devuelve SOLO el nombre de la categoria.
`;

            const resultText = (await generateText(prompt)).trim().replace(/"/g, '');
            const matched = categories.find((c: string) => c.toLowerCase() === resultText.toLowerCase());
            res.json({ text: matched || 'Otro' });
        } catch (error) {
            next(error);
        }
    },

    async autoTagDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { text } = req.body || {};
            if (!text) throw new AppError('text es requerido', 400);

            const prompt = `Eres LegalFlow AI. Agrega entre 3 y 8 etiquetas relevantes.

Documento:
${String(text).substring(0, 2000)}...

Devuelve SOLO una lista separada por comas.`;

            const resultText = await generateText(prompt);
            const tags = resultText.split(',').map((s) => s.trim()).filter(Boolean);
            res.json({ tags });
        } catch (error) {
            next(error);
        }
    }
};
