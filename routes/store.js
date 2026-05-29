const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const StoreOrder = require('../models/StoreOrder');
const { protect } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/emailSender');

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// POST /api/store/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { product, productId, amount, buyerName, buyerEmail, buyerPhone } = req.body;
    if (!product || !amount || !buyerEmail) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (!process.env.RAZORPAY_KEY_ID) {
      return res.status(503).json({ success: false, message: 'Payments not configured yet' });
    }
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: 'INR',
      notes: { product, productId, buyerEmail, buyerName }
    });

    const dbOrder = await StoreOrder.create({
      razorpayOrderId: order.id,
      buyerEmail, buyerName, buyerPhone,
      product, productId,
      amount,
      status: 'created'
    });

    res.json({ success: true, orderId: order.id, key: process.env.RAZORPAY_KEY_ID, dbOrderId: dbOrder._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/store/verify-payment
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId, deliveryUrl } = req.body;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body).digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const order = await StoreOrder.findByIdAndUpdate(dbOrderId, {
      razorpayPaymentId: razorpay_payment_id,
      status: 'paid',
      deliveryUrl: deliveryUrl || ''
    }, { new: true });

    // Send delivery email
    if (order && !order.deliveryEmailSent) {
      await sendEmail({
        to: order.buyerEmail,
        subject: `Your BioXApe order — ${order.product}`,
        html: `<h2>Thank you for your purchase!</h2>
               <p>Hi ${order.buyerName}, your order for <strong>${order.product}</strong> is confirmed.</p>
               ${deliveryUrl ? `<p><a href="${deliveryUrl}">Click here to download your product</a></p>` : '<p>Your physical item will be shipped within 3-5 business days.</p>'}
               <p>Order ID: ${razorpay_payment_id}</p>
               <p>Amount paid: ₹${order.amount}</p>`
      });
      await StoreOrder.findByIdAndUpdate(dbOrderId, { deliveryEmailSent: true });
    }

    res.json({ success: true, message: 'Payment verified', deliveryUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/store/orders — admin only
router.get('/orders', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const orders = await StoreOrder.find().sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
