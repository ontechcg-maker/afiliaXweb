import express from 'express'
import { requireAuth } from '../middlewares/authMiddleware.js'
import {
  connectInstagramController,
  getInstagramStatusController,
  disconnectInstagramController,
  sendInstagramPostController,
} from '../controllers/instagramController.js'

const router = express.Router()

router.post('/connect', requireAuth, connectInstagramController)
router.get('/status', requireAuth, getInstagramStatusController)
router.post('/disconnect', requireAuth, disconnectInstagramController)
router.post('/send', requireAuth, sendInstagramPostController)

export default router
