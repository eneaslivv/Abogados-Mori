
import bcrypt from 'bcrypt';
import { supabase } from '../config/supabase';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';

class AuthService {
    async register(data: any) {
        // 1. Create tenant
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .insert({
                name: data.company_name,
                subdomain: data.subdomain,
                plan: 'trial'
            })
            .select()
            .single();

        if (tenantError) throw new AppError(`Tenant creation failed: ${tenantError.message}`, 500);

        // 2. Hash password
        const passwordHash = await bcrypt.hash(data.password, 10);

        // 3. Create admin user
        const { data: user, error: userError } = await supabase
            .from('users')
            .insert({
                tenant_id: tenant.id,
                email: data.email,
                password_hash: passwordHash,
                name: data.name,
                role: 'super_admin',
                is_active: true
            })
            .select()
            .single();

        if (userError) throw new AppError(`User creation failed: ${userError.message}`, 500);

        // 6. Generate tokens
        const accessToken = generateAccessToken({
            user_id: user.id,
            tenant_id: tenant.id,
            role: user.role,
            email: user.email
        });

        return { user, tenant, accessToken };
    }

    async login(email: string, password: string) {
        // Note: This relies on RLS allowing SELECT on users table for anon key
        // or the table being public.
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('is_active', true)
            .limit(1);

        if (error) throw new AppError(error.message, 500);

        const user = users?.[0];

        if (!user) {
            throw new AppError('Invalid credentials', 401);
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            throw new AppError('Invalid credentials', 401);
        }

        const accessToken = generateAccessToken({
            user_id: user.id,
            tenant_id: user.tenant_id,
            role: user.role,
            email: user.email
        });

        const refreshToken = generateRefreshToken({
            user_id: user.id,
            tenant_id: user.tenant_id
        });

        // Update last_login
        await supabase
            .from('users')
            .update({ last_login_at: new Date() })
            .eq('id', user.id);

        return { user, accessToken, refreshToken };
    }

    async getUserById(userId: string, tenantId: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .eq('tenant_id', tenantId)
            .single();

        if (error) throw new AppError(error.message, 500);
        return data;
    }
}

export const authService = new AuthService();
