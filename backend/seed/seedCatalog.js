require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Service = require('../models/Service');
const Package = require('../models/Package');

const toSlug = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const CATALOG_DATA = [
  {
    service: {
      type: 'Training',
      code: 'TRN_CORE',
      title: 'Behaviour & Obedience Training',
      targetSpecies: ['dog', 'cat'],
      description:
        'Structured 1-on-1 training programs covering puppy foundations, leash manners, obedience commands, and behaviour correction.',
      syllabusOrInclusions: [
        'Initial behaviour & temperament assessment',
        'Sit, stay, recall & loose-leash walking',
        'Crate/litter & home routine conditioning',
        'Behavioural score tracking & weekly trainer notes',
      ],
      features: ['Certified Trainers', 'Dedicated Counsellor', 'Session Videos & Reports'],
      sessionDuration: 45,
      activeStatus: true,
    },
    packages: [
      {
        name: 'Free Assessment & Demo Session',
        categoryTag: 'Assessment',
        species: ['dog', 'cat'],
        lifeStage: 'all',
        sessionCount: 1,
        sessionDuration: 30,
        price: 0,
        trainerPayoutPerSession: 250,
        freeDemoEligible: true,
        inclusions: ['Behaviour evaluation', 'Customized training roadmap', 'Counsellor guidance'],
      },
      {
        name: 'Puppy & Obedience Foundation (12 Sessions)',
        categoryTag: 'Obedience',
        species: ['dog', 'cat'],
        lifeStage: 'puppy_kitten',
        sessionCount: 12,
        sessionDuration: 45,
        price: 9600,
        trainerPayoutPerSession: 600,
        freeDemoEligible: false,
        inclusions: ['12 guided sessions', 'Leash & command mastery', 'Progress scorecards'],
      },
      {
        name: 'Behaviour & Aggression Correction (20 Sessions)',
        categoryTag: 'Behaviour Correction',
        species: ['dog', 'cat'],
        lifeStage: 'adult',
        sessionCount: 20,
        sessionDuration: 60,
        price: 18000,
        trainerPayoutPerSession: 675,
        freeDemoEligible: false,
        inclusions: ['20 intensive sessions', 'Reactivity & anxiety protocol', 'RM check-ins'],
      },
    ],
  },
  {
    service: {
      type: 'Walking',
      code: 'WLK_LIVE',
      title: 'GPS-Tracked Daily Dog Walking',
      targetSpecies: ['dog'],
      description:
        'Safe, structured walks with live Leaflet GPS route tracking, real-time timer, distance log, and post-walk report.',
      syllabusOrInclusions: [
        'Harness & leash safety check',
        'Live GPS route & distance tracking',
        'Paw wipe & hydration check post-walk',
      ],
      features: ['Live Leaflet GPS Map', 'Verified Walkers', 'Distance & Photo Log'],
      sessionDuration: 40,
      activeStatus: true,
    },
    packages: [
      {
        name: 'Single Walk Session (40 mins)',
        categoryTag: 'Single Walk',
        species: ['dog'],
        lifeStage: 'all',
        sessionCount: 1,
        sessionDuration: 40,
        price: 350,
        trainerPayoutPerSession: 260,
        freeDemoEligible: false,
        inclusions: ['1 supervised walk', 'Live GPS map', 'Walk summary'],
      },
      {
        name: 'Monthly Walking Pack (24 Walks)',
        categoryTag: 'Monthly Pack',
        species: ['dog'],
        lifeStage: 'all',
        sessionCount: 24,
        sessionDuration: 40,
        price: 7200,
        trainerPayoutPerSession: 225,
        freeDemoEligible: false,
        inclusions: ['24 scheduled walks', 'Priority morning/evening slots', 'Monthly fitness log'],
      },
    ],
  },
  {
    service: {
      type: 'Grooming',
      code: 'GRM_HOME',
      title: 'Doorstep Pet Spa & Grooming',
      targetSpecies: ['dog', 'cat'],
      description:
        'Stress-free at-home bath, coat care, nail trim, ear cleaning, and styling with before/after photo documentation.',
      syllabusOrInclusions: [
        'Species-safe cleansing bath & blow-dry',
        'Coat brushing & de-matting care',
        'Nail trim, paw balm & ear hygiene',
      ],
      features: ['Doorstep Groomers', 'Before & After Photos', 'Pet-Safe Products'],
      sessionDuration: 60,
      activeStatus: true,
    },
    packages: [
      {
        name: 'Essential Bath & Hygiene Spa',
        categoryTag: 'Bath & Hygiene',
        species: ['dog', 'cat'],
        lifeStage: 'all',
        sessionCount: 1,
        sessionDuration: 60,
        price: 1200,
        trainerPayoutPerSession: 900,
        freeDemoEligible: false,
        inclusions: ['Bath & blow-dry', 'Nail trim & ear clean', 'Before/after photos'],
      },
      {
        name: 'Full Grooming & Styling Package (3 Sessions)',
        categoryTag: 'Full Grooming',
        species: ['dog', 'cat'],
        lifeStage: 'all',
        sessionCount: 3,
        sessionDuration: 75,
        price: 4200,
        trainerPayoutPerSession: 1050,
        freeDemoEligible: false,
        inclusions: ['3 full grooming sessions', 'Trim & coat conditioning', 'Sanitary & paw care'],
      },
    ],
  },
  {
    service: {
      type: 'Vaccination',
      code: 'VAC_HOME',
      title: 'Home Vaccination & Health Record',
      targetSpecies: ['dog', 'cat'],
      description:
        'Vet/Paravet administered vaccinations at home with digital health record, downloadable certificate, and booster reminders.',
      syllabusOrInclusions: [
        'Pre-vaccination vitals & health check',
        'Verified vaccine administration',
        'Digital vaccination certificate & booster schedule',
      ],
      features: ['Licensed Vets & Paravets', 'Digital Certificate', 'Booster Reminders'],
      sessionDuration: 30,
      activeStatus: true,
    },
    packages: [
      {
        name: 'Anti-Rabies Home Vaccination',
        categoryTag: 'Anti-Rabies',
        species: ['dog', 'cat'],
        lifeStage: 'all',
        sessionCount: 1,
        sessionDuration: 30,
        price: 800,
        trainerPayoutPerSession: 600,
        freeDemoEligible: false,
        inclusions: ['Anti-Rabies dose', 'Digital certificate', '1-year booster alert'],
        vaccineDetails: {
          vaccineName: 'Anti-Rabies Vaccine',
          doseCount: 1,
          boosterIntervalDays: 365,
        },
      },
      {
        name: '7-in-1 Core Immunization Package',
        categoryTag: '7-in-1',
        species: ['dog'],
        lifeStage: 'all',
        sessionCount: 1,
        sessionDuration: 30,
        price: 1500,
        trainerPayoutPerSession: 1125,
        freeDemoEligible: false,
        inclusions: ['7-in-1 vaccine administration', 'Health vault record', 'Booster reminder'],
        vaccineDetails: {
          vaccineName: 'Canine 7-in-1 Vaccine',
          doseCount: 1,
          boosterIntervalDays: 365,
        },
      },
      {
        name: '9-in-1 Comprehensive Immunization',
        categoryTag: '9-in-1',
        species: ['dog', 'cat'],
        lifeStage: 'all',
        sessionCount: 1,
        sessionDuration: 30,
        price: 1900,
        trainerPayoutPerSession: 1425,
        freeDemoEligible: false,
        inclusions: ['9-in-1 vaccine administration', 'Digital certificate', 'Booster schedule'],
        vaccineDetails: {
          vaccineName: '9-in-1 Immunization',
          doseCount: 1,
          boosterIntervalDays: 365,
        },
      },
    ],
  },
];

const seedCatalog = async () => {
  await connectDB();

  for (const item of CATALOG_DATA) {
    const serviceSlug = item.service.slug || toSlug(item.service.title || item.service.code);

    const serviceDoc = await Service.findOneAndUpdate(
      { code: item.service.code },
      {
        $set: {
          ...item.service,
          slug: serviceSlug,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    for (const pkg of item.packages) {
      const pkgSlug = pkg.slug || toSlug(`${serviceSlug}-${pkg.name}`);

      await Package.findOneAndUpdate(
        { service: serviceDoc._id, name: pkg.name },
        {
          $set: {
            ...pkg,
            slug: pkgSlug,
            service: serviceDoc._id,
            activeStatus: true,
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true }
      );
    }
  }

  console.log('Seeded PetJeeva Services and Packages successfully.');
};

seedCatalog()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Catalog seed error:', err.message);
    await mongoose.connection.close();
    process.exit(1);
  });