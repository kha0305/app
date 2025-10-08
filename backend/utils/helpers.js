const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

// Generate unique patient code
async function generatePatientCode() {
  const count = await User.countDocuments({ role: 'patient' });
  return `BN-${String(count + 1).padStart(5, '0')}`;
}

// Generate unique doctor code
async function generateDoctorCode() {
  const count = await User.countDocuments({ role: 'doctor' });
  return `BS-${String(count + 1).padStart(5, '0')}`;
}

// Generate UUID
function generateUUID() {
  return uuidv4();
}

// Specialties list
const specialties = [
  'Nội khoa',
  'Ngoại khoa',
  'Sản phụ khoa',
  'Nhi khoa',
  'Tim mạch',
  'Da liễu',
  'Thần kinh',
  'Tai Mũi Họng'
];

module.exports = {
  generatePatientCode,
  generateDoctorCode,
  generateUUID,
  specialties
};