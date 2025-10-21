const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  appointment_id: {
    type: String,
    required: true
  },
  patient_id: {
    type: String,
    required: true
  },
  doctor_id: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'VND'
  },
  payment_method: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'momo', 'vnpay'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transaction_id: {
    type: String,
    default: null
  },
  paid_at: {
    type: Date,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
