import { Router } from 'express';
import { signup, verifyEmail, login, getProfile, updateProfile } from './users.controller.js';
import { verifyToken } from '../../middleware/auth.middleware.js';

const userRoutes = Router();

userRoutes.post('/api/auth/signup', signup);
userRoutes.get('/api/auth/verify-email', verifyEmail);
userRoutes.post('/api/auth/login', login);


userRoutes.get('/api/users/me', verifyToken, getProfile);
userRoutes.put('/api/users/me', verifyToken, updateProfile);

export { userRoutes };