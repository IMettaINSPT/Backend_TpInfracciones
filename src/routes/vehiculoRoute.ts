import { Router } from 'express';
import {
  createVehiculo,
  getVehiculos,
  getVehiculoByPatente,
  getVehiculoById,
  updateVehiculo,
  addTitularVehiculo,
  deleteVehiculo,
} from '../controller/vehiculoController';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/roleCheck';

const router = Router();

router.get('/patente/:patente', requireAuth, requirePermission('vehiculo:ver_patente'), getVehiculoByPatente);
router.get('/', requireAuth, requirePermission('vehiculo:ver'), getVehiculos);
router.get('/:id', requireAuth, requirePermission('vehiculo:ver'), getVehiculoById);
router.post('/', requireAuth, requirePermission('vehiculo:gestionar'), createVehiculo);
router.put('/:id', requireAuth, requirePermission('vehiculo:gestionar'), updateVehiculo);
router.post('/:id/titulares', requireAuth, requirePermission('vehiculo:gestionar'), addTitularVehiculo);
router.delete('/:id', requireAuth, requirePermission('vehiculo:gestionar'), deleteVehiculo);

export default router;