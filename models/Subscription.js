const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  razorpaySubId:      { type: String, required: true, unique: true },
  razorpayCustomerId: { type: String },
  userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email:              { type: String, required: true },
  plan:               { type: String, enum: ['pro','institutional'], required: true },
  status:             { type: String, enum: ['created','authenticated','active','pending','halted','cancelled','completed','expired'], default: 'created' },
  seats:              { type: Number, default: 1 },
  currentPeriodStart: { type: Date },
  currentPeriodEnd:   { type: Date },
  amountPaid:         { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
