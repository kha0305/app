const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  consultation_id: {
    type: String,
    required: true
  },
  sender_id: {
    type: String,
    required: true
  },
  sender_role: {
    type: String,
    enum: ['patient', 'doctor'],
    required: true
  },
  message_text: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Message', messageSchema);
