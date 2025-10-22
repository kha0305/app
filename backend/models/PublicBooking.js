const mongoose = require('mongoose');

const publicBookingSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  booking_type: {
    type: String,
    enum: ['consultation', 'examination'],
    required: true
  },
  preferred_date: {
    type: String,
    required: true
  },
  preferred_time: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PublicBooking', publicBookingSchema);
