import express from 'express'
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js'
import {
  getAdminConfig,
  saveAdminConfig,
  getAdminStats,
  getAdminUsers,
  toggleBlockUser,
  setUserRole,
  setUserPlan,
} from '../controllers/adminController.js'

const router = express.Router()

router.get('/config', requireAuth, requireAdmin, getAdminConfig)
router.post('/config', requireAuth, requireAdmin, saveAdminConfig)
router.get('/stats', requireAuth, requireAdmin, getAdminStats)
router.get('/users', requireAuth, requireAdmin, getAdminUsers)
router.post('/toggle-block', requireAuth, requireAdmin, toggleBlockUser)
router.post('/set-role', requireAuth, requireAdmin, setUserRole)
router.post('/set-plan', requireAuth, requireAdmin, setUserPlan)

export default router
