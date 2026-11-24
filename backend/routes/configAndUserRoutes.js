const express = require('express');
const { getSupportContact } = require('../controllers/authController');
const {
  getMe,
  updateMe,
  addAddress,
  updateAddress,
  deleteAddress,
  createPet,
  getPets,
  updatePet,
  deletePet,
  listProfessionals,
  getProfessionalById,
  upsertMyProfessionalProfile,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public support contact for Forgot Password popup
router.get('/config/support-contact', getSupportContact);

// Current user & address book
router.get('/users/me', protect, getMe);
router.put('/users/me', protect, updateMe);
router.post('/users/me/addresses', protect, addAddress);
router.put('/users/me/addresses/:addressId', protect, updateAddress);
router.delete('/users/me/addresses/:addressId', protect, deleteAddress);

// Pet CRUD
router.post('/pets', protect, createPet);
router.get('/pets', protect, getPets);
router.put('/pets/:petId', protect, updatePet);
router.delete('/pets/:petId', protect, deletePet);

// Professionals directory & self-service profile
router.get('/professionals', protect, listProfessionals);
router.get('/professionals/:professionalId', protect, getProfessionalById);
router.put('/professionals/me', protect, upsertMyProfessionalProfile);

module.exports = router;