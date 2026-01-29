
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';

export const AppErrorClass = AppError; // Export for re-use if needed
