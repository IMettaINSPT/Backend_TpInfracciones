import { Router } from 'express';
import {
  listarPerfiles,
  listarPermisos,
  crearPerfil,
  actualizarPermisosPerfil,
} from '../controller/PerfilController';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/roleCheck';

const router = Router();

router.use(requireAuth, requirePermission('perfiles:gestionar'));

router.get('/', listarPerfiles);
router.get('/permisos', listarPermisos);
router.post('/', crearPerfil);
router.patch('/:id/permisos', actualizarPermisosPerfil);

export default router;