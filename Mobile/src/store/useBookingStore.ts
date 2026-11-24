import { create } from 'zustand';
import { apiClient } from '../api/client';
import { BookingItem, PackageItem, ServiceItem } from '../types/models';

interface BookingState {
  services: ServiceItem[];
  packages: PackageItem[];
  bookings: BookingItem[];
  isLoading: boolean;
  fetchCatalog: () => Promise<void>;
  fetchBookings: () => Promise<void>;
  createBooking: (payload: {
    petId: string;
    packageId: string;
    scheduledDate: string;
    timeSlot: string;
    addressId?: string;
    isRecurring?: boolean;
  }) => Promise<BookingItem>;
  bookAssessment: (payload: {
  petId: string;
  packageId?: string;
  scheduledDate: string;
  timeSlot: string;
  addressId?: string;
  addressInput?: {
    label: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
}) => Promise<BookingItem>;
  cancelBooking: (bookingId: string, reason: string, noShowType?: string) => Promise<void>;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  services: [],
  packages: [],
  bookings: [],
  isLoading: false,

  fetchCatalog: async () => {
    const [svcRes, pkgRes] = await Promise.all([
      apiClient.get('/services'),
      apiClient.get('/packages'),
    ]);
    set({
      services: svcRes.data.data.services || [],
      packages: pkgRes.data.data.packages || [],
    });
  },

  fetchBookings: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get('/bookings');
      set({ bookings: res.data.data.bookings || [], isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  createBooking: async (payload) => {
    const res = await apiClient.post('/bookings/create', payload);
    const created: BookingItem = res.data.data.booking;
    await get().fetchBookings();
    return created;
  },

  bookAssessment: async (payload) => {
    const res = await apiClient.post('/bookings/assessment', payload);
    const created: BookingItem = res.data.data.booking;
    await get().fetchBookings();
    return created;
  },

  cancelBooking: async (bookingId, reason, noShowType = 'none') => {
    await apiClient.post(`/bookings/${bookingId}/cancel`, { reason, noShowType });
    await get().fetchBookings();
  },
}));