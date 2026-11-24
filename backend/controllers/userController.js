const User = require('../models/User');
const Pet = require('../models/Pet');
const ProfessionalProfile = require('../models/ProfessionalProfile');

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('profile.assignedRelationshipManager', 'name phone email profile.avatarUrl');

    let professionalProfile = null;
    if (
      ['walker', 'trainer', 'groomer', 'vet', 'paravet', 'counsellor', 'relationship_manager'].includes(
        user.role
      )
    ) {
      professionalProfile = await ProfessionalProfile.findOne({ user: user._id }).lean();
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
        professionalProfile,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const { name, email, profile } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name !== undefined) {
      if (String(name).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
      }
      user.name = String(name).trim();
    }

    if (email !== undefined) {
      user.email = String(email).trim().toLowerCase();
    }

    if (profile && typeof profile === 'object') {
      if (profile.avatarUrl !== undefined) user.profile.avatarUrl = profile.avatarUrl;
      if (profile.bio !== undefined) user.profile.bio = profile.bio;
      if (profile.emergencyContactName !== undefined) {
        user.profile.emergencyContactName = profile.emergencyContactName;
      }
      if (profile.emergencyContactPhone !== undefined) {
        user.profile.emergencyContactPhone = profile.emergencyContactPhone;
      }
      if (profile.notificationPreferences) {
        user.profile.notificationPreferences = {
          ...user.profile.notificationPreferences.toObject(),
          ...profile.notificationPreferences,
        };
      }
      if (profile.privacySettings) {
        user.profile.privacySettings = {
          ...user.profile.privacySettings.toObject(),
          ...profile.privacySettings,
        };
      }
    }

    await user.save();
    const safeUser = await User.findById(user._id).select('-password');

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user: safeUser },
    });
  } catch (err) {
    return next(err);
  }
};

const addAddress = async (req, res, next) => {
  try {
    const { label, line1, line2, city, state, pincode, coordinates, isDefault } = req.body;
    if (!line1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Address line1, city, state, and pincode are required.',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const shouldBeDefault = Boolean(isDefault) || user.addresses.length === 0;
    if (shouldBeDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    user.addresses.push({
      label: label || 'Home',
      line1: String(line1).trim(),
      line2: line2 ? String(line2).trim() : '',
      city: String(city).trim(),
      state: String(state).trim(),
      pincode: String(pincode).trim(),
      coordinates: {
        lat: coordinates?.lat ?? null,
        lng: coordinates?.lng ?? null,
      },
      isDefault: shouldBeDefault,
    });

    await user.save();
    return res.status(201).json({
      success: true,
      message: 'Address added successfully.',
      data: { addresses: user.addresses },
    });
  } catch (err) {
    return next(err);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const { label, line1, line2, city, state, pincode, coordinates, isDefault } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const addr = user.addresses.id(addressId);
    if (!addr) {
      return res.status(404).json({ success: false, message: 'Address not found.' });
    }

    if (label !== undefined) addr.label = label;
    if (line1 !== undefined) addr.line1 = line1;
    if (line2 !== undefined) addr.line2 = line2;
    if (city !== undefined) addr.city = city;
    if (state !== undefined) addr.state = state;
    if (pincode !== undefined) addr.pincode = pincode;
    if (coordinates) {
      if (coordinates.lat !== undefined) addr.coordinates.lat = coordinates.lat;
      if (coordinates.lng !== undefined) addr.coordinates.lng = coordinates.lng;
    }

    if (isDefault) {
      user.addresses.forEach((item) => {
        item.isDefault = item._id.toString() === addressId;
      });
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Address updated.',
      data: { addresses: user.addresses },
    });
  } catch (err) {
    return next(err);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const addr = user.addresses.id(addressId);
    if (!addr) {
      return res.status(404).json({ success: false, message: 'Address not found.' });
    }

    const wasDefault = addr.isDefault;
    addr.deleteOne();

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Address removed.',
      data: { addresses: user.addresses },
    });
  } catch (err) {
    return next(err);
  }
};

// Pet CRUD
const createPet = async (req, res, next) => {
  // Add at the start of createPet, updatePet, and deletePet in userController.js:
if (req.user.role !== 'pet_parent' && req.user.role !== 'admin') {
  return res.status(403).json({
    success: false,
    message: 'Only pet parent accounts can manage pets.',
  });
}
  try {
    const {
      name,
      species,
      breed,
      age,
      gender,
      weightKg,
      neuteredOrSpayed,
      medicalHistory,
      behaviourSummary,
      photos,
    } = req.body;

    if (!name || !species || !breed || !gender) {
      return res.status(400).json({
        success: false,
        message: 'Pet name, species (dog/cat), breed, and gender are required.',
      });
    }

    const pet = await Pet.create({
      user: req.user._id,
      name: String(name).trim(),
      species,
      breed: String(breed).trim(),
      age: age || { years: 0, months: 0, lifeStage: 'adult' },
      gender,
      weightKg: weightKg ?? null,
      neuteredOrSpayed: Boolean(neuteredOrSpayed),
      medicalHistory: medicalHistory || {},
      behaviourSummary: behaviourSummary || {},
      photos: Array.isArray(photos) ? photos : [],
    });

    return res.status(201).json({
      success: true,
      message: 'Pet profile created.',
      data: { pet },
    });
  } catch (err) {
    return next(err);
  }
};

const getPets = async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' && req.query.userId
      ? { user: req.query.userId, isActive: true }
      : { user: req.user._id, isActive: true };

    const pets = await Pet.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      data: { pets },
    });
  } catch (err) {
    return next(err);
  }
};

const updatePet = async (req, res, next) => {
  // Add at the start of createPet, updatePet, and deletePet in userController.js:
if (req.user.role !== 'pet_parent' && req.user.role !== 'admin') {
  return res.status(403).json({
    success: false,
    message: 'Only pet parent accounts can manage pets.',
  });
}
  try {
    const { petId } = req.params;
    const pet = await Pet.findById(petId);

    if (!pet || !pet.isActive) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }

    if (pet.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this pet.' });
    }

    const allowedFields = [
      'name',
      'species',
      'breed',
      'age',
      'gender',
      'weightKg',
      'neuteredOrSpayed',
      'medicalHistory',
      'behaviourSummary',
      'photos',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        pet[field] = req.body[field];
      }
    });

    await pet.save();
    return res.status(200).json({
      success: true,
      message: 'Pet profile updated.',
      data: { pet },
    });
  } catch (err) {
    return next(err);
  }
};

const deletePet = async (req, res, next) => {
  // Add at the start of createPet, updatePet, and deletePet in userController.js:
if (req.user.role !== 'pet_parent' && req.user.role !== 'admin') {
  return res.status(403).json({
    success: false,
    message: 'Only pet parent accounts can manage pets.',
  });
}
  try {
    const { petId } = req.params;
    const pet = await Pet.findById(petId);

    if (!pet || !pet.isActive) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }

    if (pet.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this pet.' });
    }

    pet.isActive = false;
    await pet.save();

    return res.status(200).json({
      success: true,
      message: 'Pet profile removed.',
    });
  } catch (err) {
    return next(err);
  }
};

// Public / authenticated professional directory & detail (sensitive credential docs stripped)
const listProfessionals = async (req, res, next) => {
  try {
    const query = { verificationStatus: 'verified' };
    if (req.query.role) {
      query.professionalRole = req.query.role;
    }

    const profiles = await ProfessionalProfile.find(query)
      .populate('user', 'name role')
      .select('-credentials.documentUrl -verificationNotes')
      .sort({ averageRating: -1, completionPercentage: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { professionals: profiles },
    });
  } catch (err) {
    return next(err);
  }
};

const getProfessionalById = async (req, res, next) => {
  try {
    const { professionalId } = req.params;
    const SessionReview = require('../models/SessionReview');

    let profile = await ProfessionalProfile.findById(professionalId)
      .populate('user', 'name role')
      .select('-credentials.documentUrl -verificationNotes')
      .lean();

    if (!profile) {
      profile = await ProfessionalProfile.findOne({ user: professionalId })
        .populate('user', 'name role')
        .select('-credentials.documentUrl -verificationNotes')
        .lean();
    }

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Professional profile not found.' });
    }

    const targetUserId = profile.user?._id || profile.user;
    const recentReviews = await SessionReview.find({
      professional: targetUserId,
      moderationStatus: 'published',
    })
      .populate('customer', 'name')
      .populate('pet', 'name species')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        professional: profile,
        recentReviews,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const upsertMyProfessionalProfile = async (req, res, next) => {
  try {
    const proRoles = [
      'walker',
      'trainer',
      'groomer',
      'vet',
      'paravet',
      'counsellor',
      'relationship_manager',
    ];
    if (!proRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only professional accounts can manage a professional profile.',
      });
    }

    const {
      profilePhoto,
      bio,
      experienceYears,
      specializations,
      qualifications,
      credentials,
      serviceAreas,
      isAvailable,
    } = req.body;

    let profile = await ProfessionalProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = new ProfessionalProfile({
        user: req.user._id,
        professionalRole: req.user.role,
        verificationStatus: 'pending',
      });
    }

    if (profilePhoto !== undefined) profile.profilePhoto = profilePhoto;
    if (bio !== undefined) profile.bio = bio;
    if (experienceYears !== undefined) profile.experienceYears = Number(experienceYears);
    if (Array.isArray(specializations)) profile.specializations = specializations;
    if (Array.isArray(qualifications)) profile.qualifications = qualifications;
    if (Array.isArray(serviceAreas)) profile.serviceAreas = serviceAreas;
    if (typeof isAvailable === 'boolean') profile.isAvailable = isAvailable;

    if (Array.isArray(credentials)) {
      profile.credentials = credentials.map((c) => ({
        title: c.title,
        issuingBody: c.issuingBody,
        credentialNumber: c.credentialNumber || '',
        documentUrl: c.documentUrl || '',
        issuedDate: c.issuedDate || null,
        expiryDate: c.expiryDate || null,
        verified: false,
      }));
    }

    await profile.save();
    return res.status(200).json({
      success: true,
      message: 'Professional profile saved.',
      data: { professionalProfile: profile },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
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
};