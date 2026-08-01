import express from 'express'
import { requireAuth } from '../middlewares/authMiddleware.js'
import {
  shortenLinkController,
  handleRedirectController,
  getAnalyticsSummaryController,
} from '../controllers/linkController.js'

const router = express.Router()

router.post('/shorten-link', requireAuth, shortenLinkController)
router.get('/r/:code', handleRedirectController)
router.get('/analytics/summary', requireAuth, getAnalyticsSummaryController)

export default router
