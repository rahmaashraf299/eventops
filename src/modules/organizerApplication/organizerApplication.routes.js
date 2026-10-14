import express from 'express';
import {
    applyForOrganizer,
    getMyApplications,
    getAllApplications,
    reviewApplication
} from './organizerApplication.controller.js';
import { verifyToken, allowRoles } from '../../middlewares/auth.js';
import { validateCreateApplication } from '../../middlewares/validateCreateApplication.js';
import { validateReviewApplication } from '../../middlewares/validateReviewApplication.js';

const router = express.Router();

// ==========================================
// 1. User / Participant Routes
// ==========================================

// POST /api/organizer-applications - Submit application
router.post('/api/organizer-applications', verifyToken, validateCreateApplication, applyForOrganizer);

// GET /api/organizer-applications/me - Get my applications
router.get('/api/organizer-applications/me', verifyToken, getMyApplications);

// ==========================================
// 2. Admin Routes
// ==========================================

// GET /api/admin/organizer-applications - List all applications
router.get('/api/admin/organizer-applications', verifyToken, allowRoles('admin'), getAllApplications);

// PATCH /api/admin/organizer-applications/:id - Approve or Reject application
router.patch('/api/admin/organizer-applications/:id', verifyToken, allowRoles('admin'), validateReviewApplication, reviewApplication);

export const organizerApplicationRoutes = router;
export default router;
