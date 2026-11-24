require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const User = require('../models/User');
const AppConfig = require('../models/AppConfig');

const seedAdminAndConfig = async () => {
  await connectDB();

  const adminName = process.env.ADMIN_NAME;
  const adminPhone = process.env.ADMIN_PHONE;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminName || !adminPhone || !adminPassword) {
    throw new Error('ADMIN_NAME, ADMIN_PHONE, and ADMIN_PASSWORD must be set in environment variables');
  }

  let adminUser = await User.findOne({ phone: adminPhone });

  if (!adminUser) {
    adminUser = await User.create({
      role: 'admin',
      name: adminName,
      phone: adminPhone,
      password: adminPassword,
      walletBalance: 0,
      isPhoneVerified: true,
      accountStatus: 'active',
      profile: {
        bio: 'PetJeeva Platform Administrator',
      },
    });
    console.log(`Created initial Admin account: ${adminUser.name} (${adminUser.phone})`);
  } else {
    adminUser.role = 'admin';
    adminUser.name = adminName;
    adminUser.password = adminPassword;
    adminUser.isPhoneVerified = true;
    adminUser.accountStatus = 'active';
    await adminUser.save();
    console.log(`Updated existing Admin account: ${adminUser.name} (${adminUser.phone})`);
  }

  const supportContact = {
    supportPhone: process.env.SUPPORT_PHONE || '+91-124-400-0100',
    supportWhatsApp: process.env.SUPPORT_WHATSAPP || '+91-98110-00100',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@petjeeva.com',
    supportHours: process.env.SUPPORT_HOURS || 'Mon-Sun, 08:00 AM - 10:00 PM IST',
    emergencyHelpline: process.env.EMERGENCY_HELPLINE || '+91-98110-00911',
  };

  await AppConfig.findOneAndUpdate(
    { configKey: 'GLOBAL_CONFIG' },
    {
      $setOnInsert: {
        configKey: 'GLOBAL_CONFIG',
      },
      $set: {
        supportContact,
        updatedBy: adminUser._id,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('Seeded/updated GLOBAL_CONFIG support contact details.');
};

seedAdminAndConfig()
  .then(() => {
    console.log('SeedAdmin completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('SeedAdmin failed:', err.message);
    process.exit(1);
  });