import { GEMINI_MODEL, geminiClient } from '../../config/gemini';

type InlineData = {
    mimeType: string;
    data: string;
};

type ContentPart =
    | { text: string }
    | { inlineData: InlineData };

const getModel = () => geminiClient.getGenerativeModel({ model: GEMINI_MODEL });

export const generateText = async (prompt: string) => {
    const model = getModel();
    const result = await model.generateContent(prompt);
    return result.response.text() || '';
};

export const generateJson = async <T>(prompt: string, fallback: T, options?: { temperature?: number }) => {
    const model = getModel();
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: options?.temperature
        }
    });
    const text = result.response.text() || '';
    try {
        return JSON.parse(text) as T;
    } catch {
        return fallback;
    }
};

export const generateFromParts = async (parts: ContentPart[], prompt?: string) => {
    const model = getModel();
    const allParts: ContentPart[] = prompt ? [...parts, { text: prompt }] : parts;
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: allParts }]
    });
    return result.response.text() || '';
};
