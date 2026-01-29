import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import { env } from './config/env';

const app: Application = express();

const allowedOrigins = (env.CORS_ORIGINS || 'http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

app.use(morgan('combined'));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.send(`
    <style>body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f2f5; }</style>
    <div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #0F172A;">🚀 LegalFlow API</h1>
        <p style="color: #64748B;">El Backend esta funcionando correctamente.</p>
        <p>Para ver la App, abre: <a href="http://localhost:5174">http://localhost:5174</a></p>
    </div>
    `);
});

app.use('/api/v1', routes);

app.use(errorHandler);

export { app };
