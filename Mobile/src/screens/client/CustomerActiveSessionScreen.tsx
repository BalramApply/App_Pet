import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Navigation, Clock, FileCheck2 } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useSessionStore } from '../../store/useSessionStore';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerActiveSession'>;

const formatSeconds = (sec: number) => {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

export const CustomerActiveSessionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { sessionId, bookingId } = route.params;
  const {
    activeSession,
    remainingSeconds,
    elapsedSeconds,
    distanceCovered,
    fetchSessionById,
    connectToSessionRoom,
    disconnectSocket,
    tickTimer,
  } = useSessionStore();

  useEffect(() => {
    fetchSessionById(sessionId).catch(() => {});
    connectToSessionRoom(sessionId).catch(() => {});
    const iv = setInterval(() => tickTimer(), 1000);
    return () => {
      clearInterval(iv);
      disconnectSocket();
    };
  }, [sessionId, fetchSessionById, connectToSessionRoom, disconnectSocket, tickTimer]);

  const status = activeSession?.status || 'scheduled';
  const isCompleted = status === 'completed';
  const awaitingConfirm = status === 'in_progress' && remainingSeconds <= 0 && elapsedSeconds > 0;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.badge}>SESSION #{activeSession?.sessionNumber || 1}</Text>
        <Text style={styles.title}>
          {isCompleted
            ? 'Session Completed'
            : awaitingConfirm
            ? 'Awaiting Professional Confirmation'
            : status.replace(/_/g, ' ').toUpperCase()}
        </Text>
        <Text style={styles.sub}>
          Arrival Verification: {activeSession?.arrivalVerificationStatus || 'pending'} • Distance:{' '}
          {distanceCovered.toFixed(2)} km
        </Text>

        <View style={styles.timerBox}>
          <Clock size={20} color={Colors.primary} />
          <Text style={styles.timerText}>
            Elapsed {formatSeconds(elapsedSeconds)} • Remaining {formatSeconds(remainingSeconds)}
          </Text>
        </View>

        {!isCompleted ? (
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => navigation.navigate('LiveTracking', { sessionId, bookingId })}
          >
            <Navigation size={18} color={Colors.white} />
            <Text style={styles.mapBtnText}>Open Live Leaflet GPS Map</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => navigation.replace('SessionReport', { sessionId })}
          >
            <FileCheck2 size={18} color={Colors.white} />
            <Text style={styles.mapBtnText}>View Report &amp; Rate Session</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg, justifyContent: 'center' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badge: { fontSize: 11, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  title: { ...Typography.h2 },
  sub: { ...Typography.caption, marginTop: 4, marginBottom: Spacing.md },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: Radii.md,
    gap: 8,
    marginBottom: Spacing.lg,
  },
  timerText: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  mapBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.mintDark,
    paddingVertical: 14,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});