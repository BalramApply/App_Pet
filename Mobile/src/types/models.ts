export type UserRole =
  | 'pet_parent'
  | 'walker'
  | 'trainer'
  | 'groomer'
  | 'vet'
  | 'paravet'
  | 'counsellor'
  | 'relationship_manager'
  | 'admin';

export interface Address {
  _id?: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  coordinates?: {
    lat: number | null;
    lng: number | null;
  };
  isDefault?: boolean;
}

export interface User {
  _id: string;
  role: UserRole;
  name: string;
  phone: string;
  email?: string;
  walletBalance: number;
  isPhoneVerified: boolean;
  addresses: Address[];
  accountStatus: 'pending_verification' | 'active' | 'suspended' | 'deleted';
  profile?: {
    avatarUrl?: string;
    bio?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    assignedRelationshipManager?: {
      _id: string;
      name: string;
      phone: string;
      email?: string;
    } | null;
    notificationPreferences?: {
      pushEnabled: boolean;
      sessionAlerts: boolean;
      walletAlerts: boolean;
      vaccinationReminders: boolean;
    };
  };
}

export interface SupportContact {
  supportPhone: string;
  supportWhatsApp: string;
  supportEmail: string;
  supportHours: string;
  emergencyHelpline: string;
}

export interface WalletTransaction {
  _id: string;
  user: string;
  role: 'client' | 'professional';
  type: 'credit' | 'debit';
  category: 'admin_topup' | 'session_payment' | 'session_earning' | 'refund' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  booking?: {
    _id: string;
    bookingType: string;
    scheduledDate: string;
    timeSlot: string;
    status: string;
  } | null;
  session?: {
    _id: string;
    sessionNumber: number;
    status: string;
  } | null;
  description: string;
  metadata?: {
    petName?: string;
    serviceName?: string;
    note?: string;
  };
  referenceId: string;
  createdAt: string;
}

export interface Pet {
  _id: string;
  user: string;
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  age: {
    years: number;
    months: number;
    lifeStage: 'puppy_kitten' | 'adult' | 'senior';
  };
  gender: 'male' | 'female';
  weightKg?: number | null;
  neuteredOrSpayed?: boolean;
  medicalHistory?: {
    allergies?: string[];
    conditions?: string[];
    vetClinicName?: string;
    notes?: string;
  };
  behaviourSummary?: {
    temperament?: string;
    trainingLevel?: string;
    latestBehaviorScore?: number | null;
  };
  photos: string[];
}

export interface ServiceItem {
  _id: string;
  type: 'Training' | 'Walking' | 'Grooming' | 'Vaccination';
  code: string;
  title: string;
  targetSpecies: ('dog' | 'cat')[];
  description: string;
  syllabusOrInclusions: string[];
  features: string[];
  sessionDuration: number;
}

export interface PackageItem {
  _id: string;
  service: ServiceItem | string;
  name: string;
  categoryTag: string;
  species: ('dog' | 'cat')[];
  lifeStage: 'all' | 'puppy_kitten' | 'adult' | 'senior';
  sessionCount: number;
  sessionDuration: number;
  price: number;
  trainerPayoutPerSession: number;
  freeDemoEligible: boolean;
  inclusions: string[];
}

export interface CoordinatePoint {
  lat: number;
  lng: number;
  recordedAt?: string;
}

export interface SessionMediaItem {
  _id?: string;
  url: string;
  mediaType: 'photo' | 'video' | 'certificate';
  tag?: 'before' | 'after' | 'progress' | 'general';
  caption?: string;
}

export interface SessionChecklistItem {
  label: string;
  completed: boolean;
  notes?: string;
}

export interface SessionItem {
  _id: string;
  booking: string | BookingItem;
  sessionNumber: number;
  professional: User | string;
  customer: User | string;
  pet: Pet | string;
  sessionAmount: number;
  professionalPayoutAmount: number;
  walletSettled: boolean;
  scheduledDate: string;
  scheduledDurationMinutes: number;
  actualDurationSeconds: number;
  coordinates: CoordinatePoint[];
  latestLocation?: {
    lat: number | null;
    lng: number | null;
    updatedAt?: string | null;
  };
  distanceCovered: number;
  arrivalAt?: string | null;
  arrivalVerificationStatus: 'pending' | 'arrived' | 'verified';
  startedAt?: string | null;
  scheduledEndAt?: string | null;
  endedAt?: string | null;
  status:
    | 'scheduled'
    | 'professional_arrived'
    | 'in_progress'
    | 'duration_completed'
    | 'completed'
    | 'interrupted'
    | 'disputed'
    | 'cancelled';
  reportNotes: string;
  completionNotes: string;
  media: SessionMediaItem[];
  checklist: SessionChecklistItem[];
  behaviorScores?: {
    obedience?: number | null;
    leashControl?: number | null;
    socialization?: number | null;
    calmness?: number | null;
    overallProgressScore?: number | null;
  };
  reviewEligible: boolean;
  review?: string | null;
}

export interface BookingItem {
  _id: string;
  user: User | string;
  pet: Pet;
  service: ServiceItem;
  package: PackageItem;
  assignedProfessional?: User | null;
  assignedCounsellor?: User | null;
  bookingType: 'free_assessment' | 'single_session' | 'multi_session_package' | 'replacement_session';
  totalAmount: number;
  perSessionAmount: number;
  perSessionPayoutAmount: number;
  addressSnapshot: Address;
  scheduledDate: string;
  timeSlot: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  arrivalStatus: 'pending' | 'arrived' | 'verified';
  serviceCompletionStatus: 'not_started' | 'in_progress' | 'partial' | 'completed';
  sessionIds: SessionItem[];
  completedSessionCount: number;
  totalSessionCount: number;
}

export interface ProfessionalProfileData {
  _id: string;
  user: { _id: string; name: string; role: UserRole };
  professionalRole: UserRole;
  profilePhoto: string;
  bio: string;
  experienceYears: number;
  specializations: string[];
  qualifications: string[];
  credentials: {
    _id?: string;
    title: string;
    issuingBody: string;
    verified: boolean;
  }[];
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'expired';
  serviceAreas: { city: string; locality?: string; pincode?: string }[];
  averageRating: number;
  totalEligibleReviews: number;
  totalAssignedSessions: number;
  totalCompletedSessions: number;
  completionPercentage: number;
  isAvailable: boolean;
}

export interface VaccinationRecordItem {
  _id: string;
  pet: string;
  vaccineName: string;
  doseNumber: number;
  batchNumber?: string;
  administeredDate: string;
  nextDueDate?: string | null;
  certificateUrl?: string;
  administeredBy?: { name: string; role: string } | null;
  clinicOrHomeNotes?: string;
}