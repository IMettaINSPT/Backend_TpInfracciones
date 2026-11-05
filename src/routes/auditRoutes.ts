// src/routes/auditRoutes.ts
import { Router } from 'express';
import { obtenerHistorialPorFiltro, obtenerHistorialPorEntidadId } from '../controller/auditController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// GET /audit?entidad=Titular&fechaDesde=2026-01-01&fechaHasta=2026-11-05
router.get('/', requireAuth, obtenerHistorialPorFiltro);

// GET /audit/:entidad/:id (para grilla puntual)
router.get('/:entidad/:id', requireAuth, obtenerHistorialPorEntidadId);

export default router;