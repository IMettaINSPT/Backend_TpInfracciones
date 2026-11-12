import { Router } from 'express';
import { registrarPago, getPagos, getPago, cancelPayment } from '../controller/pagoController';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/roleCheck';

const router = Router();

router.post('/', requireAuth, requirePermission('pago:crear'), registrarPago);
router.get('/', requireAuth, requirePermission('pago:ver'), getPagos);
router.get('/:id', requireAuth, requirePermission('pago:ver'), getPago);
router.put('/:id/anular', requireAuth, requirePermission('pago:anular'), cancelPayment);

export default router;