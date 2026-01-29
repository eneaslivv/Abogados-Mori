
import jwt from 'jsonwebtoken';

export const generateAccessToken = (payload: any) => {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: '7d'
    });
};

export const generateRefreshToken = (payload: any) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
        expiresIn: '30d'
    });
};

export const verifyToken = (token: string) => {
    return jwt.verify(token, process.env.JWT_SECRET!);
};
