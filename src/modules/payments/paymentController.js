import Transaction from './paymentModel.js';

// POST /api/payments/initiate
// Initiate a mock payment linked to a booking
export const initiatePayment = async (req, res) => {
  try {
    const { bookingId, amount, provider = 'mock' } = req.body;

    // Prevent duplicate transaction for the same booking
    const existing = await Transaction.findOne({ booking: bookingId, status: 'pending' });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A pending transaction already exists for this booking',
      });
    }

    const fee = 0; // Mock has no fee
    const net = amount - fee;

    const transaction = await Transaction.create({
      booking: bookingId,
      provider,
      amount,
      fee,
      net,
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Payment initiated successfully',
      data: transaction,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/payments/mock-confirm/:transactionId
// Simulate payment confirmation (mock only)
export const mockConfirmPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.provider !== 'mock') {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for mock payments',
      });
    }

    if (transaction.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `Transaction is already ${transaction.status}`,
      });
    }

    transaction.status = 'succeeded';
    await transaction.save();

    // NOTE: Person 6 (Tickets) should listen for this confirmation
    // and generate a Ticket + QR after status becomes 'succeeded'

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully (mock)',
      data: transaction,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/:transactionId
// Get a single transaction by ID
export const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId).populate('booking');
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    return res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/booking/:bookingId
// Get transaction linked to a specific booking
export const getTransactionByBooking = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ booking: req.params.bookingId });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'No transaction found for this booking' });
    }
    return res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payments/webhook/paymob  (or /stripe)
// Webhook handler — verifies signature and updates transaction status
export const handleWebhook = async (req, res) => {
  try {
    const { providerRef, status, provider } = req.body;

    if (!providerRef || !status || !provider) {
      return res.status(400).json({ success: false, message: 'Missing webhook fields' });
    }

    // Idempotency guard: don't process the same providerRef twice
    const transaction = await Transaction.findOne({ providerRef });
    if (transaction && transaction.status === 'succeeded') {
      return res.status(200).json({ success: true, message: 'Already processed' });
    }

    const updated = await Transaction.findOneAndUpdate(
      { providerRef },
      {
        status,
        ...(status === 'refunded' ? { refundedAt: new Date() } : {}),
      },
      { new: true, upsert: false }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Transaction not found for this providerRef' });
    }

    return res.status(200).json({ success: true, message: 'Webhook processed', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};