import { Router } from 'express';
import {
  createTitular,
  getTitulares,
  getTitularById,
  updateTitular,
  deleteTitular,
  closeTitularidad,
} from '../controller/TitularController';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/roleCheck';

const router = Router();

router.get('/', requireAuth, requirePermission('titular:ver'), getTitulares);
router.get('/:id', requireAuth, requirePermission('titular:ver'), getTitularById);
router.post('/', requireAuth, requirePermission('titular:gestionar'), createTitular);
router.put('/:id', requireAuth, requirePermission('titular:gestionar'), updateTitular);
router.patch('/:id/vehiculos/:vehiculoId/baja', requireAuth, requirePermission('titular:gestionar'), closeTitularidad);
router.delete('/:id', requireAuth, requirePermission('titular:eliminar'), deleteTitular);

export default router;