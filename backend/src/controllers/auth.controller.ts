
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export const authController = {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await authService.register(req.body);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    },

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;
            const result = await authService.login(email, password);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async me(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = await authService.getUserById(req.user.id, req.user.tenant_id);
            res.json(user);
        } catch (error) {
            next(error);
        }
    }
};
