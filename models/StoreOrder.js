const mongoose = require('mongoose');

const storeOrderSchema = new mongoose.Schema({
  razorpayPaymentId: { type: String, unique: true },
  razorpayOrderId:   { type: String },
  buyerEmail:        { type: String, required: true },
  buyerName:         { type: String, required: true },
  buyerPhone:        { type: String },
  product:           { type: String, required: true },
  productId:         { type: String },
  amount:            { type: Number, required: true },
  currency:          { type: String, default: 'INR' },
  status:            { type: String, enum: ['created','paid','failed','refunded'], default: 'created' },
  deliveryUrl:       { type: String },
  deliveryEmailSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('StoreOrder', storeOrderSchema);
