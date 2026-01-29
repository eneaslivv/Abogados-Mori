
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from './errorHandler';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                tenant_id: string;
                role: string;
                email: string;
            };
        }
    }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            throw new AppError('No token provided', 401);
        }

        const decoded: any = verifyToken(token);

        req.user = {
            id: decoded.user_id,
            tenant_id: decoded.tenant_id,
            role: decoded.role,
            email: decoded.email
        };

        next();
    } catch (error) {
        next(new AppError('Invalid token', 401));
    }
};
