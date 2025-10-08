const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  start_time: String,
  end_time: String,
  is_available: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const doctorScheduleSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  doctor_id: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  time_slots: [timeSlotSchema],
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DoctorSchedule', doctorScheduleSchema);