// src/routes/pagoRoutes.ts
import { Router } from 'express';
import {
  registrarPago,
  getPagos,
  getPago,
  cancelPayment,
} from '../controller/pagoController';
import { requireAuth } from '../middleware/requireAuth';
import { requireRoles, requireAdminRole } from '../middleware/roleCheck';

const router = Router();

router.post('/', requireAuth, requireRoles(['administrativo', 'admin']), registrarPago);
router.get('/', requireAuth, requireRoles(['administrativo', 'admin']), getPagos);
router.get('/:id', requireAuth, requireRoles(['administrativo', 'admin']), getPago);
router.put('/:id/anular', requireAuth, requireAdminRole, cancelPayment);

export default router;