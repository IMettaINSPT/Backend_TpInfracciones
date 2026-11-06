import { Router } from 'express';
import {
  createVehiculo,
  getVehiculos,
  getVehiculoById,
  updateVehiculo,
  addTitularVehiculo,
  deleteVehiculo,
  getVehiculoByPatente
} from '../controller/vehiculoController';
import { requireAuth } from '../middleware/requireAuth';
import { requireRoles } from '../middleware/roleCheck';

const router = Router();

// Consultas de lectura: abiertas a todos los roles
router.get('/', requireAuth, getVehiculos);
router.get('/:id', requireAuth, getVehiculoById);
router.get('/patente/:patente', requireAuth, getVehiculoByPatente);

// Modificaciones registrales: solo personal administrativo o administradores
router.post('/', requireAuth, requireRoles(['administrativo', 'admin']), createVehiculo);
router.put('/:id', requireAuth, requireRoles(['administrativo', 'admin']), updateVehiculo);
router.post('/:id/titulares', requireAuth, requireRoles(['administrativo', 'admin']), addTitularVehiculo);
router.delete('/:id', requireAuth, requireRoles(['administrativo', 'admin']), deleteVehiculo);


export default router;