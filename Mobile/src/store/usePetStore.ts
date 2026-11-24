import { create } from 'zustand';
import { apiClient } from '../api/client';
import { Pet } from '../types/models';

interface PetState {
  pets: Pet[];
  activePetId: string | null;
  isLoading: boolean;
  fetchPets: () => Promise<void>;
  setActivePetId: (petId: string) => void;
  addPet: (payload: Partial<Pet>) => Promise<Pet>;
  updatePet: (petId: string, payload: Partial<Pet>) => Promise<Pet>;
  removePet: (petId: string) => Promise<void>;
}

export const usePetStore = create<PetState>((set, get) => ({
  pets: [],
  activePetId: null,
  isLoading: false,

  fetchPets: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get('/pets');
      const list: Pet[] = res.data.data.pets || [];
      const currentActive = get().activePetId;
      const validActive =
        list.find((p) => p._id === currentActive)?._id || (list.length > 0 ? list[0]._id : null);
      set({ pets: list, activePetId: validActive, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  setActivePetId: (petId: string) => set({ activePetId: petId }),

  addPet: async (payload) => {
    const res = await apiClient.post('/pets', payload);
    const created: Pet = res.data.data.pet;
    const updated = [created, ...get().pets];
    set({ pets: updated, activePetId: created._id });
    return created;
  },

  updatePet: async (petId, payload) => {
    const res = await apiClient.put(`/pets/${petId}`, payload);
    const updatedPet: Pet = res.data.data.pet;
    set({
      pets: get().pets.map((p) => (p._id === petId ? updatedPet : p)),
    });
    return updatedPet;
  },

  removePet: async (petId) => {
    await apiClient.delete(`/pets/${petId}`);
    const remaining = get().pets.filter((p) => p._id !== petId);
    set({
      pets: remaining,
      activePetId: remaining.length > 0 ? remaining[0]._id : null,
    });
  },
}));