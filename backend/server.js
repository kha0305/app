require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import models
const User = require('./models/User');
const DoctorProfile = require('./models/DoctorProfile');
const DoctorSchedule = require('./models/DoctorSchedule');
const Appointment = require('./models/Appointment');

// Import middleware
const { authenticateToken, requireDoctor, requirePatient, SECRET_KEY } = require('./middleware/auth');

// Import helpers
const { generatePatientCode, generateDoctorCode, generateUUID, specialties } = require('./utils/helpers');

// Initialize app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS || '*',
  credentials: true
}));
app.use(express.json());

// MongoDB connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'medical_appointment_db';

mongoose.connect(`${MONGO_URL}/${DB_NAME}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ============= AUTH ROUTES =============
// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, phone, full_name, role } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ detail: 'Username already exists' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ detail: 'Email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Generate code based on role
    let patient_code = null;
    let doctor_code = null;
    if (role === 'patient') {
      patient_code = await generatePatientCode();
    } else if (role === 'doctor') {
      doctor_code = await generateDoctorCode();
    }

    // Create user
    const user = new User({
      id: generateUUID(),
      username,
      email,
      password_hash,
      phone,
      full_name,
      role,
      patient_code,
      doctor_code
    });

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password_hash;
    delete userResponse._id;
    delete userResponse.__v;

    res.status(200).json(userResponse);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ detail: 'Registration failed', error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ detail: 'Invalid username or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ detail: 'Invalid username or password' });
    }

    // Create token
    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: '7d' }
    );

    // Return token and user
    const userResponse = user.toObject();
    delete userResponse.password_hash;
    delete userResponse._id;
    delete userResponse.__v;

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Login failed', error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.sub });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const userResponse = user.toObject();
    delete userResponse.password_hash;
    delete userResponse._id;
    delete userResponse.__v;

    res.json(userResponse);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ detail: 'Failed to get user', error: error.message });
  }
});

// ============= DOCTOR PROFILE ROUTES =============
// Create doctor profile
app.post('/api/doctors/profile', authenticateToken, requireDoctor, async (req, res) => {
  try {
    const { specialty, experience_years, description, consultation_fee } = req.body;

    // Check if profile exists
    const existing = await DoctorProfile.findOne({ user_id: req.user.sub });
    if (existing) {
      return res.status(400).json({ detail: 'Doctor profile already exists' });
    }

    // Create profile
    const profile = new DoctorProfile({
      id: generateUUID(),
      user_id: req.user.sub,
      specialty,
      experience_years,
      description,
      consultation_fee
    });

    await profile.save();

    const profileResponse = profile.toObject();
    delete profileResponse._id;
    delete profileResponse.__v;

    res.json(profileResponse);
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ detail: 'Failed to create profile', error: error.message });
  }
});

// Get all doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const { specialty } = req.query;
    const query = specialty ? { specialty } : {};

    const profiles = await DoctorProfile.find(query);
    
    const result = [];
    for (const profile of profiles) {
      const user = await User.findOne({ id: profile.user_id });
      if (user) {
        result.push({
          id: profile.id,
          user_id: profile.user_id,
          full_name: user.full_name,
          doctor_code: user.doctor_code || 'N/A',
          specialty: profile.specialty,
          experience_years: profile.experience_years,
          description: profile.description,
          consultation_fee: profile.consultation_fee,
          rating: profile.rating,
          email: user.email,
          phone: user.phone,
          created_at: profile.created_at
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ detail: 'Failed to get doctors', error: error.message });
  }
});

// Get doctor by ID
app.get('/api/doctors/:doctor_id', async (req, res) => {
  try {
    const profile = await DoctorProfile.findOne({ user_id: req.params.doctor_id });
    if (!profile) {
      return res.status(404).json({ detail: 'Doctor not found' });
    }

    const user = await User.findOne({ id: profile.user_id });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    res.json({
      id: profile.id,
      user_id: profile.user_id,
      full_name: user.full_name,
      doctor_code: user.doctor_code || 'N/A',
      specialty: profile.specialty,
      experience_years: profile.experience_years,
      description: profile.description,
      consultation_fee: profile.consultation_fee,
      rating: profile.rating,
      email: user.email,
      phone: user.phone,
      created_at: profile.created_at
    });
  } catch (error) {
    console.error('Get doctor error:', error);
    res.status(500).json({ detail: 'Failed to get doctor', error: error.message });
  }
});

// Get specialties
app.get('/api/specialties', (req, res) => {
  res.json({ specialties });
});

// ============= DOCTOR SCHEDULE ROUTES =============
// Create schedule
app.post('/api/doctors/schedule', authenticateToken, requireDoctor, async (req, res) => {
  try {
    const { date, time_slots } = req.body;

    // Check if schedule exists
    const existing = await DoctorSchedule.findOne({
      doctor_id: req.user.sub,
      date
    });

    if (existing) {
      return res.status(400).json({ detail: 'Schedule for this date already exists' });
    }

    const schedule = new DoctorSchedule({
      id: generateUUID(),
      doctor_id: req.user.sub,
      date,
      time_slots
    });

    await schedule.save();

    const scheduleResponse = schedule.toObject();
    delete scheduleResponse._id;
    delete scheduleResponse.__v;

    res.json(scheduleResponse);
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ detail: 'Failed to create schedule', error: error.message });
  }
});

// Get doctor schedules
app.get('/api/doctors/:doctor_id/schedules', async (req, res) => {
  try {
    const { date } = req.query;
    const query = { doctor_id: req.params.doctor_id };
    if (date) query.date = date;

    const schedules = await DoctorSchedule.find(query).sort({ date: 1 });
    
    const result = schedules.map(s => {
      const obj = s.toObject();
      delete obj._id;
      delete obj.__v;
      return obj;
    });

    res.json(result);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ detail: 'Failed to get schedules', error: error.message });
  }
});

// Get available slots
app.get('/api/doctors/:doctor_id/available-slots', async (req, res) => {
  try {
    const { date } = req.query;

    const schedule = await DoctorSchedule.findOne({
      doctor_id: req.params.doctor_id,
      date
    });

    if (!schedule) {
      return res.json({ date, slots: [] });
    }

    // Get booked appointments
    const bookedAppointments = await Appointment.find({
      doctor_id: req.params.doctor_id,
      appointment_date: date,
      status: { $in: ['pending', 'confirmed'] }
    });

    const bookedTimes = new Set(bookedAppointments.map(a => a.appointment_time));

    // Filter available slots
    const availableSlots = schedule.time_slots.filter(
      slot => slot.is_available && !bookedTimes.has(slot.start_time)
    );

    res.json({ date, slots: availableSlots });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ detail: 'Failed to get available slots', error: error.message });
  }
});

// ============= APPOINTMENT ROUTES =============
// Create appointment
app.post('/api/appointments', authenticateToken, requirePatient, async (req, res) => {
  try {
    const { doctor_id, appointment_date, appointment_time, reason, notes } = req.body;

    // Verify doctor exists
    const doctor = await User.findOne({ id: doctor_id, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({ detail: 'Doctor not found' });
    }

    // Check if slot is available
    const schedule = await DoctorSchedule.findOne({
      doctor_id,
      date: appointment_date
    });

    if (!schedule) {
      return res.status(400).json({ detail: 'Doctor not available on this date' });
    }

    const slotAvailable = schedule.time_slots.some(
      slot => slot.start_time === appointment_time && slot.is_available
    );

    if (!slotAvailable) {
      return res.status(400).json({ detail: 'Time slot not available' });
    }

    // Check if already booked
    const existing = await Appointment.findOne({
      doctor_id,
      appointment_date,
      appointment_time,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existing) {
      return res.status(400).json({ detail: 'Time slot already booked' });
    }

    // Create appointment
    const appointment = new Appointment({
      id: generateUUID(),
      patient_id: req.user.sub,
      doctor_id,
      appointment_date,
      appointment_time,
      reason,
      notes: notes || null
    });

    await appointment.save();

    const appointmentResponse = appointment.toObject();
    delete appointmentResponse._id;
    delete appointmentResponse.__v;

    res.json(appointmentResponse);
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ detail: 'Failed to create appointment', error: error.message });
  }
});

// Get my appointments
app.get('/api/appointments/my-appointments', authenticateToken, async (req, res) => {
  try {
    const query = req.user.role === 'patient'
      ? { patient_id: req.user.sub }
      : { doctor_id: req.user.sub };

    const appointments = await Appointment.find(query).sort({ appointment_date: -1 });

    const result = [];
    for (const apt of appointments) {
      const patient = await User.findOne({ id: apt.patient_id });
      const doctor = await User.findOne({ id: apt.doctor_id });
      const doctorProfile = await DoctorProfile.findOne({ user_id: apt.doctor_id });

      if (patient && doctor && doctorProfile) {
        const aptObj = apt.toObject();
        delete aptObj._id;
        delete aptObj.__v;

        result.push({
          ...aptObj,
          patient_name: patient.full_name,
          patient_code: patient.patient_code || 'N/A',
          patient_phone: patient.phone,
          patient_email: patient.email,
          doctor_name: doctor.full_name,
          doctor_code: doctor.doctor_code || 'N/A',
          doctor_specialty: doctorProfile.specialty,
          doctor_phone: doctor.phone
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ detail: 'Failed to get appointments', error: error.message });
  }
});

// Update appointment status
app.patch('/api/appointments/:appointment_id', authenticateToken, async (req, res) => {
  try {
    const { status, doctor_notes } = req.body;

    const appointment = await Appointment.findOne({ id: req.params.appointment_id });
    if (!appointment) {
      return res.status(404).json({ detail: 'Appointment not found' });
    }

    // Authorization check
    if (req.user.role === 'doctor') {
      if (appointment.doctor_id !== req.user.sub) {
        return res.status(403).json({ detail: 'Not authorized' });
      }
    } else if (req.user.role === 'patient') {
      if (appointment.patient_id !== req.user.sub) {
        return res.status(403).json({ detail: 'Not authorized' });
      }
      if (status !== 'cancelled') {
        return res.status(403).json({ detail: 'Patients can only cancel appointments' });
      }
    }

    // Update appointment
    appointment.status = status;
    if (doctor_notes) {
      appointment.doctor_notes = doctor_notes;
    }
    await appointment.save();

    const appointmentResponse = appointment.toObject();
    delete appointmentResponse._id;
    delete appointmentResponse.__v;

    res.json(appointmentResponse);
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ detail: 'Failed to update appointment', error: error.message });
  }
});

// Delete/Cancel appointment
app.delete('/api/appointments/:appointment_id', authenticateToken, requirePatient, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ id: req.params.appointment_id });
    if (!appointment) {
      return res.status(404).json({ detail: 'Appointment not found' });
    }

    if (appointment.patient_id !== req.user.sub) {
      return res.status(403).json({ detail: 'Not authorized' });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ detail: 'Failed to cancel appointment', error: error.message });
  }
});

// ============= ADMIN ROUTES =============
// Get system stats
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const total_users = await User.countDocuments();
    const total_patients = await User.countDocuments({ role: 'patient' });
    const total_doctors = await User.countDocuments({ role: 'doctor' });
    const total_appointments = await Appointment.countDocuments();
    const pending = await Appointment.countDocuments({ status: 'pending' });
    const confirmed = await Appointment.countDocuments({ status: 'confirmed' });
    const completed = await Appointment.countDocuments({ status: 'completed' });
    const cancelled = await Appointment.countDocuments({ status: 'cancelled' });

    res.json({
      total_users,
      total_patients,
      total_doctors,
      total_appointments,
      pending_appointments: pending,
      confirmed_appointments: confirmed,
      completed_appointments: completed,
      cancelled_appointments: cancelled
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ detail: 'Failed to get stats', error: error.message });
  }
});

// Get all users
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({}, { password_hash: 0, _id: 0, __v: 0 });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ detail: 'Failed to get users', error: error.message });
  }
});

// Get all appointments
app.get('/api/admin/all-appointments', authenticateToken, async (req, res) => {
  try {
    const appointments = await Appointment.find({}).sort({ appointment_date: -1 });

    const result = [];
    for (const apt of appointments) {
      const patient = await User.findOne({ id: apt.patient_id });
      const doctor = await User.findOne({ id: apt.doctor_id });
      const doctorProfile = await DoctorProfile.findOne({ user_id: apt.doctor_id });

      if (patient && doctor && doctorProfile) {
        const aptObj = apt.toObject();
        delete aptObj._id;
        delete aptObj.__v;

        result.push({
          ...aptObj,
          patient_name: patient.full_name,
          patient_code: patient.patient_code || 'N/A',
          patient_phone: patient.phone,
          patient_email: patient.email,
          doctor_name: doctor.full_name,
          doctor_code: doctor.doctor_code || 'N/A',
          doctor_specialty: doctorProfile.specialty,
          doctor_phone: doctor.phone
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Get all appointments error:', error);
    res.status(500).json({ detail: 'Failed to get appointments', error: error.message });
  }
});

// ============= ROOT ROUTE =============
app.get('/api/', (req, res) => {
  res.json({ message: 'Medical Appointment System API', version: '1.0', backend: 'Node.js' });
});

// Start server
const PORT = process.env.PORT || 8001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
