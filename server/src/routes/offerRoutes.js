import express from 'express'
import { requireAuth } from '../middlewares/authMiddleware.js'
import {
  unshortenUrlController,
  scrapeMercadoLivreController,
  fetchHtmlController,
  getSchedulesController,
  createScheduleController,
  deleteScheduleController,
  updateScheduleTimeController,
  triggerDueSchedulesController,
} from '../controllers/offerController.js'

const router = express.Router()

router.get('/unshorten', unshortenUrlController)
router.post('/scrape/mercadolivre', scrapeMercadoLivreController)
router.post('/fetch-html', fetchHtmlController)

router.get('/schedules', requireAuth, getSchedulesController)
router.post('/schedules/create', requireAuth, createScheduleController)
router.post('/schedules/:id/delete', requireAuth, deleteScheduleController)
router.post('/schedules/:id/update-time', requireAuth, updateScheduleTimeController)
router.post('/schedules/trigger-due', requireAuth, triggerDueSchedulesController)

export default router
