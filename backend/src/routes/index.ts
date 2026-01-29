import { Router } from 'express';
import authRoutes from './auth.routes';
import contractRoutes from './contracts.routes';
import aiRoutes from './ai.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/contracts', contractRoutes);
router.use('/ai', aiRoutes);

export default router;
