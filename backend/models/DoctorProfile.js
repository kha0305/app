const mongoose = require('mongoose');

const doctorProfileSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  specialty: {
    type: String,
    required: true
  },
  experience_years: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  consultation_fee: {
    type: Number,
    required: true
  },
  rating: {
    type: Number,
    default: 0.0
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DoctorProfile', doctorProfileSchema);