import { create } from 'zustand';
import { apiClient } from '../api/client';
import { ProfessionalProfileData } from '../types/models';

interface ProfessionalState {
  professionals: ProfessionalProfileData[];
  selectedProfessional: ProfessionalProfileData | null;
  selectedReviews: any[];
  myProfessionalProfile: ProfessionalProfileData | null;
  isLoading: boolean;
  fetchProfessionals: (role?: string) => Promise<void>;
  fetchProfessionalById: (id: string) => Promise<void>;
  fetchMyProfessionalProfile: () => Promise<void>;
}

export const useProfessionalStore = create<ProfessionalState>((set) => ({
  professionals: [],
  selectedProfessional: null,
  selectedReviews: [],
  myProfessionalProfile: null,
  isLoading: false,

  fetchProfessionals: async (role) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get('/professionals', {
        params: role ? { role } : undefined,
      });
      set({ professionals: res.data.data.professionals || [], isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  fetchProfessionalById: async (id) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get(`/professionals/${id}`);
      set({
        selectedProfessional: res.data.data.professional,
        selectedReviews: res.data.data.recentReviews || [],
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  fetchMyProfessionalProfile: async () => {
    const res = await apiClient.get('/users/me');
    set({ myProfessionalProfile: res.data.data.professionalProfile || null });
  },
}));