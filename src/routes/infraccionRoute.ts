import { Router } from 'express';
import {
  generarInfraccion,
  generarDescargo,
  anularInfraccion,
  obtenerInfraccionPorId,
  obtenerInfraccionPorCodigoBarras,
  listarInfracciones,
} from '../controller/infraccionController';
import { requireAuth } from '../middleware/requireAuth';
import { requireInspectorRole, requireAdministrativeRole } from '../middleware/roleCheck';

const router = Router();

// Consultas
router.get('/', requireAuth, listarInfracciones);
router.get('/codigo/:codigo', requireAuth, obtenerInfraccionPorCodigoBarras);
router.get('/:id', requireAuth, obtenerInfraccionPorId);

// Operaciones de inspectores
router.post('/', requireAuth, requireInspectorRole, generarInfraccion);

// Operaciones de administrativos
router.put('/:id/descargo', requireAuth, requireAdministrativeRole, generarDescargo);
router.put('/:id/anular', requireAuth, requireAdministrativeRole, anularInfraccion);

export default router;