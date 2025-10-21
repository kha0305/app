const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  patient_id: {
    type: String,
    required: true
  },
  doctor_id: {
    type: String,
    required: true
  },
  appointment_id: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  consultation_type: {
    type: String,
    enum: ['chat', 'video'],
    default: 'chat'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  ended_at: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Consultation', consultationSchema);
