import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env';

export const geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
export const GEMINI_MODEL = env.GEMINI_MODEL;
