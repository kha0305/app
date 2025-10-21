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
const PasswordResetToken = require('./models/PasswordResetToken');
const Consultation = require('./models/Consultation');
const Message = require('./models/Message');
const Payment = require('./models/Payment');

// Import middleware
const { authenticateToken, requireDoctor, requirePatient, requireAdmin, SECRET_KEY } = require('./middleware/auth');

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

// ============= FORGOT PASSWORD ROUTES =============
// Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ detail: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // For security, don't reveal if email exists
      return res.json({ message: 'If email exists, reset instructions have been sent' });
    }

    // Generate reset token
    const resetToken = generateUUID();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token
    const passwordResetToken = new PasswordResetToken({
      id: generateUUID(),
      user_id: user.id,
      token: resetToken,
      expires_at: expiresAt
    });

    await passwordResetToken.save();

    // In production, send email here
    console.log('📧 [SIMULATED EMAIL] Password reset link:');
    console.log(`Reset token: ${resetToken}`);
    console.log(`For user: ${email}`);
    console.log(`Expires at: ${expiresAt}`);

    res.json({ 
      message: 'If email exists, reset instructions have been sent',
      // For demo purposes, return token (remove in production!)
      demo_token: resetToken,
      demo_expires_at: expiresAt
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ detail: 'Failed to process request', error: error.message });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({ detail: 'Token and new password are required' });
    }

    // Find valid token
    const resetToken = await PasswordResetToken.findOne({ 
      token, 
      used: false,
      expires_at: { $gt: new Date() }
    });

    if (!resetToken) {
      return res.status(400).json({ detail: 'Invalid or expired token' });
    }

    // Find user
    const user = await User.findOne({ id: resetToken.user_id });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    // Update password
    user.password_hash = password_hash;
    await user.save();

    // Mark token as used
    resetToken.used = true;
    await resetToken.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ detail: 'Failed to reset password', error: error.message });
  }
});

// ============= CONSULTATION/CHAT ROUTES =============
// Create consultation session
app.post('/api/consultations', authenticateToken, async (req, res) => {
  try {
    const { doctor_id, appointment_id, consultation_type } = req.body;
    const patient_id = req.user.user_id;

    // Verify doctor exists
    const doctor = await User.findOne({ id: doctor_id, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({ detail: 'Doctor not found' });
    }

    // Create consultation
    const consultation = new Consultation({
      id: generateUUID(),
      patient_id,
      doctor_id,
      appointment_id: appointment_id || null,
      consultation_type: consultation_type || 'chat',
      status: 'active'
    });

    await consultation.save();

    res.json(consultation);
  } catch (error) {
    console.error('Create consultation error:', error);
    res.status(500).json({ detail: 'Failed to create consultation', error: error.message });
  }
});

// Get consultations for current user
app.get('/api/consultations', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const role = req.user.role;

    let consultations;
    if (role === 'patient') {
      consultations = await Consultation.find({ patient_id: user_id }).sort({ created_at: -1 });
    } else if (role === 'doctor') {
      consultations = await Consultation.find({ doctor_id: user_id }).sort({ created_at: -1 });
    } else {
      return res.status(403).json({ detail: 'Not authorized' });
    }

    // Populate user details
    const consultationsWithDetails = await Promise.all(consultations.map(async (consultation) => {
      const patient = await User.findOne({ id: consultation.patient_id });
      const doctor = await User.findOne({ id: consultation.doctor_id });
      const doctorProfile = await DoctorProfile.findOne({ doctor_id: consultation.doctor_id });

      return {
        ...consultation.toObject(),
        patient_name: patient?.full_name,
        doctor_name: doctor?.full_name,
        doctor_specialty: doctorProfile?.specialty
      };
    }));

    res.json(consultationsWithDetails);
  } catch (error) {
    console.error('Get consultations error:', error);
    res.status(500).json({ detail: 'Failed to get consultations', error: error.message });
  }
});

// Get consultation by ID
app.get('/api/consultations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const consultation = await Consultation.findOne({ id });
    if (!consultation) {
      return res.status(404).json({ detail: 'Consultation not found' });
    }

    // Check authorization
    if (consultation.patient_id !== user_id && consultation.doctor_id !== user_id) {
      return res.status(403).json({ detail: 'Not authorized to view this consultation' });
    }

    // Get user details
    const patient = await User.findOne({ id: consultation.patient_id });
    const doctor = await User.findOne({ id: consultation.doctor_id });
    const doctorProfile = await DoctorProfile.findOne({ doctor_id: consultation.doctor_id });

    res.json({
      ...consultation.toObject(),
      patient_name: patient?.full_name,
      doctor_name: doctor?.full_name,
      doctor_specialty: doctorProfile?.specialty
    });
  } catch (error) {
    console.error('Get consultation error:', error);
    res.status(500).json({ detail: 'Failed to get consultation', error: error.message });
  }
});

// Send message in consultation
app.post('/api/consultations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message_text } = req.body;
    const sender_id = req.user.user_id;
    const sender_role = req.user.role;

    if (!message_text) {
      return res.status(400).json({ detail: 'Message text is required' });
    }

    // Verify consultation exists and user is authorized
    const consultation = await Consultation.findOne({ id });
    if (!consultation) {
      return res.status(404).json({ detail: 'Consultation not found' });
    }

    if (consultation.patient_id !== sender_id && consultation.doctor_id !== sender_id) {
      return res.status(403).json({ detail: 'Not authorized' });
    }

    if (consultation.status !== 'active') {
      return res.status(400).json({ detail: 'Consultation is not active' });
    }

    // Create message
    const message = new Message({
      id: generateUUID(),
      consultation_id: id,
      sender_id,
      sender_role,
      message_text
    });

    await message.save();

    res.json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ detail: 'Failed to send message', error: error.message });
  }
});

// Get messages for consultation
app.get('/api/consultations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    // Verify consultation exists and user is authorized
    const consultation = await Consultation.findOne({ id });
    if (!consultation) {
      return res.status(404).json({ detail: 'Consultation not found' });
    }

    if (consultation.patient_id !== user_id && consultation.doctor_id !== user_id) {
      return res.status(403).json({ detail: 'Not authorized' });
    }

    // Get messages
    const messages = await Message.find({ consultation_id: id }).sort({ created_at: 1 });

    // Mark messages as read
    await Message.updateMany(
      { consultation_id: id, sender_id: { $ne: user_id }, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ detail: 'Failed to get messages', error: error.message });
  }
});

// End consultation
app.patch('/api/consultations/:id/end', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    const consultation = await Consultation.findOne({ id });
    if (!consultation) {
      return res.status(404).json({ detail: 'Consultation not found' });
    }

    // Only doctor or patient can end consultation
    if (consultation.patient_id !== user_id && consultation.doctor_id !== user_id) {
      return res.status(403).json({ detail: 'Not authorized' });
    }

    consultation.status = 'completed';
    consultation.ended_at = new Date();
    await consultation.save();

    res.json(consultation);
  } catch (error) {
    console.error('End consultation error:', error);
    res.status(500).json({ detail: 'Failed to end consultation', error: error.message });
  }
});

// ============= PAYMENT ROUTES =============
// Create payment for appointment
app.post('/api/payments/create', authenticateToken, requirePatient, async (req, res) => {
  try {
    const { appointment_id, payment_method } = req.body;
    const patient_id = req.user.user_id;

    // Verify appointment exists
    const appointment = await Appointment.findOne({ id: appointment_id });
    if (!appointment) {
      return res.status(404).json({ detail: 'Appointment not found' });
    }

    if (appointment.patient_id !== patient_id) {
      return res.status(403).json({ detail: 'Not authorized' });
    }

    // Get doctor fee
    const doctorProfile = await DoctorProfile.findOne({ doctor_id: appointment.doctor_id });
    if (!doctorProfile) {
      return res.status(404).json({ detail: 'Doctor profile not found' });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ appointment_id, status: { $in: ['pending', 'completed'] } });
    if (existingPayment) {
      return res.status(400).json({ detail: 'Payment already exists for this appointment' });
    }

    // Create payment
    const payment = new Payment({
      id: generateUUID(),
      appointment_id,
      patient_id,
      doctor_id: appointment.doctor_id,
      amount: doctorProfile.consultation_fee,
      payment_method: payment_method || 'cash',
      status: 'pending'
    });

    await payment.save();

    res.json(payment);
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ detail: 'Failed to create payment', error: error.message });
  }
});

// Confirm payment (demo - simulated payment processing)
app.post('/api/payments/:id/confirm', authenticateToken, requirePatient, async (req, res) => {
  try {
    const { id } = req.params;
    const patient_id = req.user.user_id;

    const payment = await Payment.findOne({ id });
    if (!payment) {
      return res.status(404).json({ detail: 'Payment not found' });
    }

    if (payment.patient_id !== patient_id) {
      return res.status(403).json({ detail: 'Not authorized' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ detail: 'Payment is not pending' });
    }

    // Simulate payment processing (always success in demo)
    payment.status = 'completed';
    payment.transaction_id = `DEMO_TXN_${generateUUID().substring(0, 8)}`;
    payment.paid_at = new Date();
    await payment.save();

    console.log('💰 [DEMO PAYMENT] Payment confirmed:', payment.transaction_id);

    res.json(payment);
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ detail: 'Failed to confirm payment', error: error.message });
  }
});

// Get payment by appointment
app.get('/api/payments/appointment/:appointment_id', authenticateToken, async (req, res) => {
  try {
    const { appointment_id } = req.params;
    const user_id = req.user.user_id;

    const payment = await Payment.findOne({ appointment_id });
    if (!payment) {
      return res.status(404).json({ detail: 'Payment not found' });
    }

    // Check authorization
    if (payment.patient_id !== user_id && payment.doctor_id !== user_id) {
      return res.status(403).json({ detail: 'Not authorized' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ detail: 'Failed to get payment', error: error.message });
  }
});

// Get all payments for user
app.get('/api/payments/my-payments', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const role = req.user.role;

    let payments;
    if (role === 'patient') {
      payments = await Payment.find({ patient_id: user_id }).sort({ created_at: -1 });
    } else if (role === 'doctor') {
      payments = await Payment.find({ doctor_id: user_id }).sort({ created_at: -1 });
    } else {
      return res.status(403).json({ detail: 'Not authorized' });
    }

    res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ detail: 'Failed to get payments', error: error.message });
  }
});

// ============= ADMIN ROUTES =============
// Get admin statistics
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalDoctors = await User.countDocuments({ role: 'doctor' });
    const totalAppointments = await Appointment.countDocuments();
    const pendingAppointments = await Appointment.countDocuments({ status: 'pending' });
    const confirmedAppointments = await Appointment.countDocuments({ status: 'confirmed' });
    const completedAppointments = await Appointment.countDocuments({ status: 'completed' });
    const cancelledAppointments = await Appointment.countDocuments({ status: 'cancelled' });
    const totalConsultations = await Consultation.countDocuments();
    const activeConsultations = await Consultation.countDocuments({ status: 'active' });
    const totalPayments = await Payment.countDocuments();
    const completedPayments = await Payment.countDocuments({ status: 'completed' });
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      users: {
        total: totalUsers,
        patients: totalPatients,
        doctors: totalDoctors
      },
      appointments: {
        total: totalAppointments,
        pending: pendingAppointments,
        confirmed: confirmedAppointments,
        completed: completedAppointments,
        cancelled: cancelledAppointments
      },
      consultations: {
        total: totalConsultations,
        active: activeConsultations
      },
      payments: {
        total: totalPayments,
        completed: completedPayments,
        revenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ detail: 'Failed to get statistics', error: error.message });
  }
});

// Get all users (admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;

    let query = {};
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-password_hash')
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ detail: 'Failed to get users', error: error.message });
  }
});

// Get user by ID (admin)
app.get('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ id }).select('-password_hash');
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Get additional info
    let additionalInfo = {};
    if (user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ doctor_id: id });
      const appointmentsCount = await Appointment.countDocuments({ doctor_id: id });
      additionalInfo = { profile, appointmentsCount };
    } else if (user.role === 'patient') {
      const appointmentsCount = await Appointment.countDocuments({ patient_id: id });
      additionalInfo = { appointmentsCount };
    }

    res.json({ ...user.toObject(), ...additionalInfo });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ detail: 'Failed to get user', error: error.message });
  }
});

// Delete user (admin)
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ id });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Don't allow deleting admin accounts
    if (user.role === 'admin') {
      return res.status(403).json({ detail: 'Cannot delete admin accounts' });
    }

    // Delete user and related data
    await User.deleteOne({ id });

    if (user.role === 'doctor') {
      await DoctorProfile.deleteMany({ doctor_id: id });
      await DoctorSchedule.deleteMany({ doctor_id: id });
    }

    // Don't delete appointments, just mark doctor/patient as deleted
    await Appointment.updateMany({ doctor_id: id }, { doctor_id: 'DELETED' });
    await Appointment.updateMany({ patient_id: id }, { patient_id: 'DELETED' });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ detail: 'Failed to delete user', error: error.message });
  }
});

// Get all appointments (admin)
app.get('/api/admin/appointments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .sort({ appointment_date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Appointment.countDocuments(query);

    // Populate user and doctor details
    const appointmentsWithDetails = await Promise.all(appointments.map(async (appointment) => {
      const patient = await User.findOne({ id: appointment.patient_id });
      const doctor = await User.findOne({ id: appointment.doctor_id });
      const doctorProfile = await DoctorProfile.findOne({ doctor_id: appointment.doctor_id });

      return {
        ...appointment.toObject(),
        patient_name: patient?.full_name,
        doctor_name: doctor?.full_name,
        doctor_specialty: doctorProfile?.specialty
      };
    }));

    res.json({
      appointments: appointmentsWithDetails,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get appointments error:', error);
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
