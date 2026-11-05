import { Router } from 'express';
import { crearUsuario } from '../controller/UserController';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

router.post('/', requireAuth, requireAdmin, crearUsuario);

export default router;