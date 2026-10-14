import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Transaction = require('../../../db/models/Transaction.js');

// دالة الدفع التجريبي (Mock Payment)
export const mockPayment = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, message: 'Please provide the payment amount' });
    }

    const fee = amount * 0.02; // 2% عمولة افتراضية
    const net = amount - fee;

    const newTransaction = new Transaction({
      provider: 'mock',
      providerRef: 'mock_ref_' + Date.now(),
      amount: amount,
      fee: fee,
      net: net,
      status: 'succeeded'
    });

    await newTransaction.save();

    res.status(201).json({
      success: true,
      message: 'Mock payment processed successfully! 🎉',
      data: {
        transaction: newTransaction
      }
    });

  } catch (error) {
    console.error('Payment Error:', error);
    res.status(500).json({ success: false, message: 'Server error during payment processing' });
  }
};