// src/routes/auditRoutes.ts
import { Router } from 'express';
import {
  obtenerHistorialPorFiltro,
  obtenerHistorialPorEntidadId,
  obtenerTodosLosLogs,
} from '../controller/auditController';
import { requireAuth } from '../middleware/requireAuth';
import { requireRoles } from '../middleware/roleCheck';

const router = Router();

router.use(requireAuth, requireRoles(['admin']));
router.get('/', obtenerHistorialPorFiltro);
router.get('/historial', obtenerHistorialPorFiltro);
router.get('/historial/:entidad/:id', obtenerHistorialPorEntidadId);
router.get('/:entidad/:id', obtenerHistorialPorEntidadId);
router.get('/logs', obtenerTodosLosLogs);

export default router;