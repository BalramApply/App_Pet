// Mobile/src/store/useAuthStore.ts
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { apiClient, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../api/client';
import {
  Address,
  ProfessionalProfileData,
  SupportContact,
  User,
} from '../types/models';

interface PendingRegistrationState {
  tempUserId: string;
  phone: string;
  verificationCode: string;
  expiresInMinutes: number;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  profile?: {
    avatarUrl?: string;
    bio?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    notificationPreferences?: {
      pushEnabled: boolean;
      sessionAlerts: boolean;
      walletAlerts: boolean;
      vaccinationReminders: boolean;
    };
    privacySettings?: {
      shareLiveLocationWithRm: boolean;
      showPhoneToAssignedPro: boolean;
    };
  };
}

interface AuthState {
  user: User | null;
  professionalProfile: ProfessionalProfileData | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoading: boolean;
  pendingRegistration: PendingRegistrationState | null;
  supportContact: SupportContact | null;
  bootstrapSession: () => Promise<void>;
  registerInit: (payload: {
    name: string;
    phone: string;
    password: string;
    email?: string;
  }) => Promise<PendingRegistrationState>;
  verifyRegistration: (phone: string, otp: string) => Promise<void>;
  clearPendingRegistration: () => void;
  login: (phone: string, password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>;
  addAddress: (payload: Address) => Promise<Address[]>;
  updateAddress: (addressId: string, payload: Partial<Address>) => Promise<Address[]>;
  deleteAddress: (addressId: string) => Promise<Address[]>;
  fetchSupportContact: () => Promise<SupportContact>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setWalletBalanceLocal: (newBalance: number) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  professionalProfile: null,
  isAuthenticated: false,
  isBootstrapping: true,
  isLoading: false,
  pendingRegistration: null,
  supportContact: null,

  bootstrapSession: async () => {
    set({ isBootstrapping: true });
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (!token) {
        set({
          user: null,
          professionalProfile: null,
          isAuthenticated: false,
          isBootstrapping: false,
        });
        return;
      }
      const res = await apiClient.get('/users/me');
      set({
        user: res.data.data.user,
        professionalProfile: res.data.data.professionalProfile ?? null,
        isAuthenticated: true,
        isBootstrapping: false,
      });
    } catch {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      set({
        user: null,
        professionalProfile: null,
        isAuthenticated: false,
        isBootstrapping: false,
      });
    }
  },

  registerInit: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/auth/register-init', payload);
      const pending: PendingRegistrationState = {
        tempUserId: res.data.data.tempUserId,
        phone: res.data.data.phone,
        verificationCode: res.data.data.verificationCode,
        expiresInMinutes: res.data.data.expiresInMinutes,
      };
      set({ pendingRegistration: pending, isLoading: false });
      return pending;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  verifyRegistration: async (phone, otp) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/auth/verify-registration', { phone, otp });
      const { user, accessToken, refreshToken } = res.data.data;
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      set({
        user,
        isAuthenticated: true,
        pendingRegistration: null,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  clearPendingRegistration: () => set({ pendingRegistration: null }),

  login: async (phone, password) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/auth/login', { phone, password });
      const { user, accessToken, refreshToken } = res.data.data;
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  refreshProfile: async () => {
    const res = await apiClient.get('/users/me');
    set({
      user: res.data.data.user,
      professionalProfile: res.data.data.professionalProfile ?? null,
    });
  },

  updateProfile: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.put('/users/me', payload);
      const updatedUser: User = res.data.data.user;
      set({ user: updatedUser, isLoading: false });
      return updatedUser;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  addAddress: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/users/me/addresses', payload);
      const addresses: Address[] = res.data.data.addresses ?? [];
      const current = get().user;
      set({
        user: current ? { ...current, addresses } : null,
        isLoading: false,
      });
      return addresses;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  updateAddress: async (addressId, payload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.put(`/users/me/addresses/${addressId}`, payload);
      const addresses: Address[] = res.data.data.addresses ?? [];
      const current = get().user;
      set({
        user: current ? { ...current, addresses } : null,
        isLoading: false,
      });
      return addresses;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  deleteAddress: async (addressId) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.delete(`/users/me/addresses/${addressId}`);
      const addresses: Address[] = res.data.data.addresses ?? [];
      const current = get().user;
      set({
        user: current ? { ...current, addresses } : null,
        isLoading: false,
      });
      return addresses;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  fetchSupportContact: async () => {
    const res = await apiClient.get('/config/support-contact');
    const contact: SupportContact = res.data.data.supportContact;
    set({ supportContact: contact });
    return contact;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Proceed with local cleanup even if token already expired
    }
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({
      user: null,
      professionalProfile: null,
      isAuthenticated: false,
      pendingRegistration: null,
    });
  },

  deleteAccount: async () => {
    await apiClient.delete('/auth/account');
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({
      user: null,
      professionalProfile: null,
      isAuthenticated: false,
      pendingRegistration: null,
    });
  },

  setWalletBalanceLocal: (newBalance: number) => {
    const current = get().user;
    if (current) {
      set({ user: { ...current, walletBalance: newBalance } });
    }
  },
}));