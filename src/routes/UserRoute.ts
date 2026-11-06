// src/routes/user.routes.ts
import { Router } from 'express';
import {
  crearUsuario,
  listarUsuarios,
  eliminarUsuario,
  actualizarRolUsuario,
} from '../controller/UserController';
import { requireAuth} from '../middleware/requireAuth';
import { requireAdminRole } from '../middleware/roleCheck';

const router = Router();

// Todas las rutas de administración de usuarios exigen ser admin
router.use(requireAuth, requireAdminRole);

router.post('/', crearUsuario);
router.get('/', listarUsuarios);
router.patch('/:id/role', actualizarRolUsuario);
router.delete('/:id', eliminarUsuario);

export default router;