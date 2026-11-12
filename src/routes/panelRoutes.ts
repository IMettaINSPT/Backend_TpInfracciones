import { Router } from 'express';
import {
  getDeudaPatente,
  getDeudaTitular,
  getMetricasPanel,
} from '../controller/panelController';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/roleCheck';

const router = Router();

router.get('/deuda/patente/:patente', requireAuth, requirePermission('deuda:consultar'), getDeudaPatente);
router.get('/deuda/titular/:titularId', requireAuth, requirePermission('deuda:consultar'), getDeudaTitular);
router.get('/metricas', requireAuth, requirePermission('panel:ver'), getMetricasPanel);

export default router;