// src/routes/titularRoutes.ts
import { Router } from 'express';
import { crearTitular,obtenerTitulares,obtenerTitularPorId,actualizarTitular,eliminarTitular} from '../controller/titularController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/', requireAuth, obtenerTitulares);
router.get('/:id', requireAuth, obtenerTitularPorId);
router.post('/', requireAuth, crearTitular);
router.put('/:id', requireAuth, actualizarTitular);
router.delete('/:id', requireAuth, eliminarTitular);

export default router;