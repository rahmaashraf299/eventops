import express from 'express';
import { mockPayment } from './paymentController.js';

const router = express.Router();

// مسار الدفع التجريبي
router.post('/mock', mockPayment);

export default router;