import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const windowMinutes = Number(env.RATE_LIMIT_WINDOW_MINUTES || 15);
const maxRequests = Number(env.RATE_LIMIT_MAX || 60);

export const aiRateLimit = rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas solicitudes de IA. Intenta nuevamente mas tarde.' }
});
