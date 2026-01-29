import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { aiRateLimit } from '../middleware/aiRateLimit';

const router = Router();

router.use(aiRateLimit);

router.post('/analyze-style-single', aiController.analyzeDocumentStyleSingle);
router.post('/analyze-style-deep', aiController.analyzeDocumentStyleDeep);
router.post('/style-profile', aiController.generateStyleProfile);
router.post('/style-profile-master', aiController.generateMasterStyleProfile);
router.post('/contract-preview', aiController.generateContractPreview);
router.post('/contract-generate', aiController.generateContract);
router.post('/contract-generate-with-style', aiController.generateContractWithStyle);
router.post('/contract-improve', aiController.improveContract);
router.post('/contract-refine', aiController.refineContractText);
router.post('/contract-clause', aiController.generateClause);
router.post('/client-strategy', aiController.analyzeClientStrategy);
router.post('/client-contract-suggestions', aiController.generateClientContractSuggestions);
router.post('/contract-analyze', aiController.analyzeContract);
router.post('/contract-ask', aiController.askContract);
router.post('/document-extract-text', aiController.extractTextFromDocument);
router.post('/document-clean-text', aiController.cleanDocumentText);
router.post('/document-rewrite', aiController.rewriteDocumentText);
router.post('/document-title', aiController.detectDocumentTitle);
router.post('/clause-explain', aiController.explainClause);
router.post('/version-diff', aiController.generateVersionDiffSummary);
router.post('/document-categorize', aiController.autoCategorizeDocument);
router.post('/document-tags', aiController.autoTagDocument);

export default router;
