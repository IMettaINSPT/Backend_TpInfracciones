import { Router } from 'express';
import {
  getDeudaPatente,
  getDeudaTitular,
  getMetricasPanel,
} from '../controller/panelController';
import { requireAuth } from '../middleware/requireAuth';
import { requireRoles } from '../middleware/roleCheck';

const router = Router();

// Accesible para administrativo y admin
router.get('/deuda/patente/:patente', requireAuth, requireRoles(['administrativo', 'admin']), getDeudaPatente);
router.get('/deuda/titular/:titularId', requireAuth, requireRoles(['administrativo', 'admin']), getDeudaTitular);
router.get('/metricas', requireAuth, requireRoles(['administrativo', 'admin']), getMetricasPanel);

export default router;