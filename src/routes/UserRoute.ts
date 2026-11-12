import { Router } from 'express';
import {
  crearUsuario,
  listarUsuarios,
  obtenerUsuarioPorId,
  actualizarPerfilUsuario,
  eliminarUsuario,
} from '../controller/UserController';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/roleCheck';

const router = Router();

router.use(requireAuth, requirePermission('usuarios:gestionar'));

router.post('/', crearUsuario);
router.get('/', listarUsuarios);
router.get('/:id', obtenerUsuarioPorId);
router.patch('/:id/perfil', actualizarPerfilUsuario); // <-- Endpoint para cambiarle el rol/perfil al usuario
router.delete('/:id', eliminarUsuario);

export default router;