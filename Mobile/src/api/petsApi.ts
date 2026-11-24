// Mobile/src/api/petsApi.ts
import { apiClient } from './client';
import { Pet } from '../types/models';

export interface UpsertPetPayload {
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
  };
}

export const petsApi = {
  async list(): Promise<Pet[]> {
    const res = await apiClient.get('/pets');
    return res.data.data.pets ?? [];
  },

  async create(payload: UpsertPetPayload): Promise<Pet> {
    const res = await apiClient.post('/pets', payload);
    return res.data.data.pet;
  },

  async update(petId: string, payload: Partial<UpsertPetPayload>): Promise<Pet> {
    const res = await apiClient.put(`/pets/${petId}`, payload);
    return res.data.data.pet;
  },

  async remove(petId: string): Promise<void> {
    await apiClient.delete(`/pets/${petId}`);
  },
};