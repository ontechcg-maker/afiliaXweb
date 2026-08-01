import express from 'express'
import { requireAuth } from '../middlewares/authMiddleware.js'
import { generateCopyController, getAiInfoController } from '../controllers/aiController.js'

const router = express.Router()

router.post('/generate-copy', requireAuth, generateCopyController)
router.get('/ai-info', requireAuth, getAiInfoController)

export default router
