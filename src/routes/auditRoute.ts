import { Router } from 'express';
import {
  obtenerHistorialPorFiltro,
  obtenerHistorialPorEntidadId,
  obtenerTodosLosLogs,
} from '../controller/auditController';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/roleCheck';

const router = Router();

router.use(requireAuth, requirePermission('auditoria:ver'));

router.get('/', obtenerHistorialPorFiltro);
router.get('/historial', obtenerHistorialPorFiltro);
router.get('/logs', obtenerTodosLosLogs);
router.get('/historial/:entidad/:id', obtenerHistorialPorEntidadId);
router.get('/:entidad/:id', obtenerHistorialPorEntidadId);

export default router;