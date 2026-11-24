import { ServiceItem, PackageItem, BookingItem } from './models';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type ClientTabParamList = {
  HomeTab: undefined;
  BookingsTab: undefined;
  WalletTab: undefined;
  VaultTab: undefined;
  SupportTab: undefined;
  ProfileTab: undefined;
};

export type ProTabParamList = {
  ProDashboardTab: undefined;
  BookingsTab: undefined;
  WalletTab: undefined;
  SupportTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  ServiceCatalog: { initialServiceType?: 'Training' | 'Walking' | 'Grooming' | 'Vaccination'; speciesFilter?: 'dog' | 'cat' };
  ServiceDetail: { service: ServiceItem; packages: PackageItem[]; species?: 'dog' | 'cat' };
  AssessmentBooking: { packageItem?: PackageItem; petId?: string };
  BookingCheckout: { packageItem: PackageItem; serviceItem?: ServiceItem; petId?: string };
  BookingConfirmation: { booking: BookingItem };
  BookingDetail: { bookingId: string };
  LiveTracking: { sessionId: string; bookingId?: string };
  ProfessionalSession: { sessionId: string; bookingId?: string };
  CustomerActiveSession: { sessionId: string; bookingId?: string };
  SessionReport: { sessionId: string };
  ProfessionalProfile: { professionalId: string };
  AddressEdit: undefined;
  PetEdit: undefined;
  TicketThread: { ticketId: string };
};