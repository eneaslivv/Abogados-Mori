
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { contractController } from '../controllers/contract.controller';
import { requirePermission } from '../middleware/rbac';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/', contractController.list);
router.get('/:id', contractController.get);
router.post('/', requirePermission('access_contract_generator'), contractController.create);
router.put('/:id', contractController.update);
router.delete('/:id', requirePermission('can_delete_documents'), contractController.delete);

// AI Features
router.post('/generate', requirePermission('access_contract_generator'), contractController.generate);
router.post('/:id/analyze', requirePermission('access_contract_analysis'), contractController.analyze);
router.post('/improve', contractController.improve);

// Versioning
router.get('/:id/versions', contractController.getVersions);
router.post('/:id/versions', contractController.createVersion);

export default router;
