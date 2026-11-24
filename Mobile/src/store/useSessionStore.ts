import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { apiClient, ACCESS_TOKEN_KEY, SOCKET_BASE_URL } from '../api/client';
import { CoordinatePoint, SessionItem } from '../types/models';
import { useWalletStore } from './useWalletStore';

interface SessionState {
  activeSession: SessionItem | null;
  liveCoords: CoordinatePoint[];
  latestLocation: { lat: number; lng: number } | null;
  distanceCovered: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  socket: Socket | null;
  fetchSessionById: (sessionId: string) => Promise<SessionItem>;
  connectToSessionRoom: (sessionId: string) => Promise<void>;
  disconnectSocket: () => void;
  emitLocationUpdate: (sessionId: string, lat: number, lng: number, accuracy?: number) => void;
  markArrived: (sessionId: string, lat?: number, lng?: number) => Promise<SessionItem>;
  startSession: (sessionId: string) => Promise<SessionItem>;
  completeSession: (
    sessionId: string,
    payload: {
      reportNotes?: string;
      completionNotes?: string;
      media?: { url: string; mediaType: 'photo' | 'video'; tag?: string; caption?: string }[];
      checklist?: { label: string; completed: boolean }[];
      behaviorScores?: {
        obedience?: number;
        leashControl?: number;
        socialization?: number;
        calmness?: number;
        overallProgressScore?: number;
      };
    }
  ) => Promise<{ session: SessionItem; settlement: any }>;
  tickTimer: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  liveCoords: [],
  latestLocation: null,
  distanceCovered: 0,
  remainingSeconds: 0,
  elapsedSeconds: 0,
  socket: null,

  fetchSessionById: async (sessionId: string) => {
    const res = await apiClient.get(`/sessions/${sessionId}`);
    const { session, timer } = res.data.data;
    const latest =
      session.latestLocation?.lat && session.latestLocation?.lng
        ? { lat: session.latestLocation.lat, lng: session.latestLocation.lng }
        : null;

    set({
      activeSession: session,
      liveCoords: session.coordinates || [],
      latestLocation: latest,
      distanceCovered: Number(session.distanceCovered || 0),
      remainingSeconds: Number(timer?.remainingSeconds || 0),
      elapsedSeconds: Number(timer?.elapsedSeconds || 0),
    });
    return session;
  },

  connectToSessionRoom: async (sessionId: string) => {
    const existing = get().socket;
    if (existing) {
      existing.disconnect();
    }

    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (!token) return;

    const socket = io(SOCKET_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      socket.emit('join_session', { sessionId });
    });

    socket.on('session_state_sync', (data) => {
      set({
        remainingSeconds: Number(data.remainingSeconds || 0),
        elapsedSeconds: Number(data.elapsedSeconds || 0),
        distanceCovered: Number(data.distanceCovered || 0),
        latestLocation:
          data.latestLocation?.lat && data.latestLocation?.lng
            ? { lat: data.latestLocation.lat, lng: data.latestLocation.lng }
            : get().latestLocation,
      });
    });

    socket.on('location_update', (data) => {
      if (data.sessionId !== sessionId) return;
      const point: CoordinatePoint = {
        lat: data.lat,
        lng: data.lng,
        recordedAt: data.updatedAt,
      };
      set((state) => ({
        latestLocation: { lat: data.lat, lng: data.lng },
        liveCoords: [...state.liveCoords, point],
        distanceCovered: Number(data.distanceCovered ?? state.distanceCovered),
      }));
    });

    socket.on('session_status_changed', (data) => {
      if (data.sessionId !== sessionId) return;
      set((state) => ({
        activeSession: state.activeSession
          ? {
              ...state.activeSession,
              status: data.status,
              startedAt: data.startedAt || state.activeSession.startedAt,
              scheduledEndAt: data.scheduledEndAt || state.activeSession.scheduledEndAt,
            }
          : null,
        remainingSeconds:
          data.remainingSeconds !== undefined ? Number(data.remainingSeconds) : state.remainingSeconds,
      }));
    });

    socket.on('session_completed', async (data) => {
      if (data.sessionId !== sessionId) return;
      set((state) => ({
        activeSession: state.activeSession
          ? { ...state.activeSession, status: 'completed', walletSettled: true }
          : null,
        remainingSeconds: 0,
      }));
      await useWalletStore.getState().refreshWallet();
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const s = get().socket;
    if (s) {
      s.disconnect();
    }
    set({ socket: null });
  },

  emitLocationUpdate: (sessionId, lat, lng, accuracy) => {
    const s = get().socket;
    if (s && s.connected) {
      s.emit('location_update', { sessionId, lat, lng, accuracy });
    }
  },

  markArrived: async (sessionId, lat, lng) => {
    const res = await apiClient.post(`/sessions/${sessionId}/arrive`, {
      verifyArrival: true,
      lat,
      lng,
    });
    const session = res.data.data.session;
    set({ activeSession: session });
    return session;
  },

  startSession: async (sessionId) => {
    const res = await apiClient.post(`/sessions/${sessionId}/start`);
    const { session, remainingSeconds } = res.data.data;
    set({
      activeSession: session,
      remainingSeconds: Number(remainingSeconds || 0),
      elapsedSeconds: 0,
    });
    return session;
  },

  completeSession: async (sessionId, payload) => {
    const res = await apiClient.post(`/sessions/${sessionId}/complete`, payload);
    const { session, settlement } = res.data.data;
    set({ activeSession: session, remainingSeconds: 0 });
    await useWalletStore.getState().refreshWallet();
    return { session, settlement };
  },

  tickTimer: () => {
    const { activeSession, remainingSeconds, elapsedSeconds } = get();
    if (!activeSession || activeSession.status !== 'in_progress') return;
    set({
      remainingSeconds: Math.max(0, remainingSeconds - 1),
      elapsedSeconds: elapsedSeconds + 1,
    });
  },
}));