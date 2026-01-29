
import { Request, Response, NextFunction } from 'express';

export const tenantMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.tenant_id) {
        return res.status(403).json({ error: 'Tenant context missing' });
    }
    next();
};
