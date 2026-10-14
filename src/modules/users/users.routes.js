import express from 'express';
import { signup, login } from './users.controller.js';

const router = express.Router();

router.post('/api/auth/signup', signup);
router.post('/api/auth/login', login);

export const userRoutes = router;