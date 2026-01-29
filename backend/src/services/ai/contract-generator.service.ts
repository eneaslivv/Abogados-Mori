import { geminiClient, GEMINI_MODEL } from '../../config/gemini';
import { supabase } from '../../config/supabase';

export class ContractGeneratorService {
    async generateContract(params: {
        tenant_id: string;
        user_id: string;
        client_id: string;
        contract_type: string;
        context: string;
        category_id?: string;
        use_style: boolean;
    }) {
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', params.client_id)
            .single();

        if (clientError || !client) {
            throw new Error('Cliente no encontrado');
        }

        let category = null;
        let isJudicial = false;
        if (params.category_id) {
            const { data: cat } = await supabase
                .from('contract_categories')
                .select('*')
                .eq('id', params.category_id)
                .single();

            if (cat) {
                category = cat;
                isJudicial = cat.is_judicial || false;
            }
        }

        let styleProfile = null;
        if (params.use_style) {
            const { data: profiles } = await supabase
                .from('style_profiles')
                .select('*')
                .eq('tenant_id', params.tenant_id)
                .eq('is_active', true)
                .limit(1);

            if (profiles && profiles.length > 0) {
                styleProfile = profiles[0];
            }
        }

        const prompt = this.buildPrompt({
            client,
            contractType: params.contract_type,
            context: params.context,
            categoryName: category?.name,
            isJudicial,
            styleText: styleProfile?.style_text
        });

        if (!geminiClient) {
            throw new Error('Cliente Gemini no inicializado');
        }

        const model = geminiClient.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent(prompt);
        const content = result.response.text();

        await this.logApiUsage({
            tenant_id: params.tenant_id,
            user_id: params.user_id,
            operation: 'generate_contract',
            model_used: GEMINI_MODEL,
            input_tokens: result.response.usageMetadata?.promptTokenCount || 0,
            output_tokens: result.response.usageMetadata?.candidatesTokenCount || 0
        });

        return content;
    }

    private buildPrompt(params: any): string {
        const { client, contractType, context, categoryName, isJudicial, styleText } = params;

        let prompt = `Eres LegalFlow AI, especializado en redaccion legal argentina.\n\n`;

        if (isJudicial) {
            prompt += `TAREA: Generar un ESCRITO JUDICIAL\n`;
            prompt += `CATEGORIA: ${categoryName}\n\n`;
            prompt += `Estructura obligatoria:\n`;
            prompt += `- Encabezado (Sumario, Objeto, Personeria)\n`;
            prompt += `- Objeto (Claro y preciso)\n`;
            prompt += `- Hechos (Relato ordenado)\n`;
            prompt += `- Derecho (Fundamentacion juridica)\n`;
            prompt += `- Prueba (Si corresponde)\n`;
            prompt += `- Petitorio (Puntos claros)\n`;
            prompt += `- Firma (Marcador)\n\n`;
            prompt += `Tono respetuoso con el tribunal ("V.S.", "Su Senoria").\n\n`;
        } else {
            prompt += `TAREA: Generar un CONTRATO LEGAL\n`;
            prompt += `TIPO: ${contractType}\n`;
            prompt += `CATEGORIA: ${categoryName || 'General'}\n\n`;
        }

        if (styleText) {
            prompt += `PERFIL DE ESTILO (OBLIGATORIO):\n${styleText}\n\n`;
        }

        prompt += `DATOS DEL CLIENTE (OBLIGATORIO):\n`;
        prompt += `Nombre completo: ${client.full_name}\n`;
        prompt += `Tipo: ${client.client_type}\n`;
        prompt += `Documento: ${client.document_type} ${client.document_number}\n`;
        prompt += `Direccion: ${client.address || '[DIRECCION FALTANTE]'}\n`;
        if (client.legal_representative) {
            prompt += `Representante legal: ${client.legal_representative} (DNI: ${client.representative_dni})\n`;
        }
        prompt += `\n`;

        prompt += `CONTEXTO:\n${context}\n\n`;

        prompt += `INSTRUCCIONES:\n`;
        prompt += `1. Adaptar la redaccion, tono, clausulas y estructura a la materia legal seleccionada: ${categoryName}.\n`;
        prompt += `2. Mantener el estilo del estudio y aplicar las convenciones de esa area del derecho.\n`;
        prompt += `3. REGLA ESTRICTA: Usa los datos del cliente. Si faltan, usa [INSERTAR_DATO].\n`;
        prompt += `4. Devuelve SOLO el texto legal final. Sin explicaciones.\n`;

        return prompt;
    }

    private async logApiUsage(data: any) {
        try {
            await supabase.from('api_usage_logs').insert({
                tenant_id: data.tenant_id,
                user_id: data.user_id,
                operation: data.operation,
                model_used: data.model_used,
                input_tokens: data.input_tokens,
                output_tokens: data.output_tokens,
                estimated_cost: 0,
                success: true
            });
        } catch (e) {
            console.error('No se pudo registrar el uso de la API', e);
        }
    }
}

export const contractGenerator = new ContractGeneratorService();
