import { Router } from 'express';
import {
  generarInfraccion,
  listarInfracciones,
  obtenerInfraccionPorId,
  obtenerInfraccionPorCodigoBarras,
  generarDescargo,
  anularInfraccion,
} from '../controller/infraccionController';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/roleCheck';

const router = Router();

router.post('/', requireAuth, requirePermission('infraccion:crear'), generarInfraccion);
router.get('/', requireAuth, requirePermission('infraccion:ver'), listarInfracciones);
router.get('/codigo/:codigo', requireAuth, requirePermission('infraccion:ver'), obtenerInfraccionPorCodigoBarras);
router.get('/:id', requireAuth, requirePermission('infraccion:ver'), obtenerInfraccionPorId);
router.put('/:id/descargo', requireAuth, requirePermission('infraccion:descargo'), generarDescargo);
router.put('/:id/anular', requireAuth, requirePermission('infraccion:anular'), anularInfraccion);

export default router;