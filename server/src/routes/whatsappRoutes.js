import express from 'express'
import { requireAuth } from '../middlewares/authMiddleware.js'
import { checkPostLimit } from '../middlewares/limitMiddleware.js'
import {
  connectWhatsappController,
  getWhatsappStatusController,
  disconnectWhatsappController,
  getWhatsappGroupsController,
  createWhatsappGroupController,
  sendWhatsappTextController,
  sendWhatsappMediaController,
} from '../controllers/whatsappController.js'

const router = express.Router()

router.post('/connect', requireAuth, connectWhatsappController)
router.get('/status', requireAuth, getWhatsappStatusController)
router.post('/disconnect', requireAuth, disconnectWhatsappController)
router.get('/groups', requireAuth, getWhatsappGroupsController)
router.post('/create-group', requireAuth, createWhatsappGroupController)
router.post('/send-text', requireAuth, checkPostLimit, sendWhatsappTextController)
router.post('/send-media', requireAuth, checkPostLimit, sendWhatsappMediaController)

export default router
