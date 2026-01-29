
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { contractGenerator } from '../services/ai/contract-generator.service';
import { AppError } from '../middleware/errorHandler';

export const contractController = {
    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const { data: contracts, error } = await supabase
                .from('contracts')
                .select('*, client:clients(*), category:contract_categories(*)')
                .eq('tenant_id', req.user!.tenant_id);

            if (error) throw new AppError(error.message, 500);
            res.json(contracts);
        } catch (error) {
            next(error);
        }
    },

    async get(req: Request, res: Response, next: NextFunction) {
        try {
            const { data: contract, error } = await supabase
                .from('contracts')
                .select('*, client:clients(*), category:contract_categories(*), versions:contract_versions(*)')
                .eq('id', req.params.id)
                .eq('tenant_id', req.user!.tenant_id)
                .single();

            if (error || !contract) {
                throw new AppError('Contract not found', 404);
            }
            res.json(contract);
        } catch (error) {
            next(error);
        }
    },

    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { data: contract, error } = await supabase
                .from('contracts')
                .insert({
                    ...req.body,
                    tenant_id: req.user!.tenant_id,
                    created_by: req.user!.id
                })
                .select()
                .single();

            if (error) throw new AppError(error.message, 500);
            res.status(201).json(contract);
        } catch (error) {
            next(error);
        }
    },

    async generate(req: Request, res: Response, next: NextFunction) {
        try {
            const { client_id, contract_type, context, category_id, use_style } = req.body;

            const content = await contractGenerator.generateContract({
                tenant_id: req.user!.tenant_id,
                user_id: req.user!.id,
                client_id,
                contract_type,
                context,
                category_id,
                use_style
            });

            // Create draft contract
            const { data: contract, error } = await supabase
                .from('contracts')
                .insert({
                    tenant_id: req.user!.tenant_id,
                    title: `${contract_type} - ${new Date().toISOString()}`,
                    client_id,
                    category_id,
                    status: 'Draft',
                    content,
                    ai_generated: true,
                    created_by: req.user!.id
                })
                .select()
                .single();

            if (error) throw new AppError(`Failed to save generated contract: ${error.message}`, 500);

            res.status(201).json({ contract, content });
        } catch (error) {
            next(error);
        }
    },

    async update(req: Request, res: Response, next: NextFunction) {
        // Implement update logic
        res.status(501).json({ message: 'Not implemented yet' });
    },

    async delete(req: Request, res: Response, next: NextFunction) {
        // Implement delete logic
        res.status(501).json({ message: 'Not implemented yet' });
    },

    async analyze(req: Request, res: Response, next: NextFunction) {
        // Implement analysis logic
        res.status(501).json({ message: 'Not implemented yet' });
    },

    async improve(req: Request, res: Response, next: NextFunction) {
        // Implement improve logic
        res.status(501).json({ message: 'Not implemented yet' });
    },

    async getVersions(req: Request, res: Response, next: NextFunction) {
        // Implement getVersions logic
        res.status(501).json({ message: 'Not implemented yet' });
    },

    async createVersion(req: Request, res: Response, next: NextFunction) {
        // Implement createVersion logic
        res.status(501).json({ message: 'Not implemented yet' });
    }
};
