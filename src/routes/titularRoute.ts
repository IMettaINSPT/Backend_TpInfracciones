// En src/routes/titularRoute.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireRoles } from '../middleware/roleCheck';
import {
  createTitular,
  getTitulares,
  getTitularById,
  updateTitular,
  deleteTitular,
  closeTitularidad, // <-- Importás tu función
} from '../controller/TitularController';

const router = Router();

router.get('/', requireAuth, requireRoles(['admin', 'administrativo']), getTitulares);
router.get('/:id', requireAuth, requireRoles(['admin', 'administrativo']), getTitularById);
router.post('/', requireAuth, requireRoles(['admin', 'administrativo']), createTitular);
router.put('/:id', requireAuth, requireRoles(['admin', 'administrativo']), updateTitular);
router.delete('/:id', requireAuth, requireRoles(['admin']), deleteTitular);

// RUTA PARA BAJA DE TITULARIDAD:
router.patch(
  '/:id/vehiculos/:vehiculoId/baja',
  requireAuth,
  requireRoles(['admin', 'administrativo']),
  closeTitularidad
);

export default router;