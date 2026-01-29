
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from './errorHandler';

export const requirePermission = (permission: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw new AppError('User not authenticated', 401);
            }

            // Check permissions from the database for this role & tenant
            const { data: permissionRecord, error } = await supabase
                .from('role_permissions')
                .select('permissions')
                .match({
                    tenant_id: req.user.tenant_id,
                    role_name: req.user.role
                })
                .single();

            if (error || !permissionRecord) {
                // Fallback or deny if no specific permission record exists
                // For super_admin, we might want to bypass
                if (req.user.role === 'super_admin') {
                    return next();
                }
                throw new AppError('Forbidden: No permission record found', 403);
            }

            // Check dynamic permission field inside the JSONB column
            const hasPermission = permissionRecord.permissions?.[permission];

            if (!hasPermission) {
                throw new AppError(`Forbidden: Missing permission ${permission}`, 403);
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
