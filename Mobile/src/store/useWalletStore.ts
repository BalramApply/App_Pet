import { create } from 'zustand';
import { apiClient } from '../api/client';
import { WalletTransaction } from '../types/models';
import { useAuthStore } from './useAuthStore';

interface WalletState {
  balance: number;
  transactions: WalletTransaction[];
  isLoading: boolean;
  fetchBalance: () => Promise<number>;
  fetchTransactions: (filterType?: 'all' | 'credit' | 'debit') => Promise<void>;
  refreshWallet: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: 0,
  transactions: [],
  isLoading: false,

  fetchBalance: async () => {
    const res = await apiClient.get('/wallet/balance');
    const bal = Number(res.data.data.walletBalance || 0);
    set({ balance: bal });
    useAuthStore.getState().setWalletBalanceLocal(bal);
    return bal;
  },

  fetchTransactions: async (filterType = 'all') => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number> = { limit: 50 };
      if (filterType !== 'all') {
        params.type = filterType;
      }
      const res = await apiClient.get('/wallet/transactions', { params });
      set({
        transactions: res.data.data.transactions || [],
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  refreshWallet: async () => {
    await Promise.all([get().fetchBalance(), get().fetchTransactions('all')]);
  },
}));