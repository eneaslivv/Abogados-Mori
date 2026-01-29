import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
    NODE_ENV: z.string().default('development'),
    PORT: z.string().default('3001'),
    JWT_SECRET: z.string().min(1),
    JWT_REFRESH_SECRET: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    CORS_ORIGINS: z.string().optional(),
    RATE_LIMIT_WINDOW_MINUTES: z.string().optional(),
    RATE_LIMIT_MAX: z.string().optional()
});

const rawEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ||
        (process.env.NODE_ENV === 'production' ? undefined : process.env.VITE_SUPABASE_ANON_KEY),
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    RATE_LIMIT_WINDOW_MINUTES: process.env.RATE_LIMIT_WINDOW_MINUTES,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX
};

const parsed = EnvSchema.safeParse(rawEnv);

if (!parsed.success) {
    console.error('Configuracion de entorno invalida', parsed.error.flatten().fieldErrors);
    throw new Error('Configuracion de entorno invalida');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.VITE_SUPABASE_ANON_KEY && process.env.NODE_ENV !== 'production') {
    console.warn('SUPABASE_SERVICE_ROLE_KEY no esta configurada. Se usa VITE_SUPABASE_ANON_KEY solo en desarrollo.');
}

export const env = parsed.data;
