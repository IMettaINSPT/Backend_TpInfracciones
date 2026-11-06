import { Router } from 'express';
import { login } from '../controller/authController';

const router = Router();

// POST /auth/login
router.post('/login', login);

export default router;