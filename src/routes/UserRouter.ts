import { Router } from 'express';
import { crearUsuario ,login} from '../controller/User';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

router.post('/login', login);
router.post('/', requireAuth, requireAdmin, crearUsuario);

export default router;