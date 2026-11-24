import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MapPinCheck, Play, CheckCircle2, Clock } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useSessionStore } from '../../store/useSessionStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfessionalSession'>;

const formatSeconds = (sec: number) => {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

export const ProfessionalSessionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { sessionId } = route.params;
  const {
    activeSession,
    remainingSeconds,
    elapsedSeconds,
    distanceCovered,
    fetchSessionById,
    connectToSessionRoom,
    disconnectSocket,
    emitLocationUpdate,
    markArrived,
    startSession,
    completeSession,
    tickTimer,
  } = useSessionStore();

  const [reportNotes, setReportNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [behaviorScore, setBehaviorScore] = useState('8');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSessionById(sessionId).catch(() => {});
    connectToSessionRoom(sessionId).catch(() => {});

    const timerInterval = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => {
      clearInterval(timerInterval);
      disconnectSocket();
    };
  }, [sessionId, fetchSessionById, connectToSessionRoom, disconnectSocket, tickTimer]);

  // Stream live GPS coordinates over Socket.io during active sessions
  useEffect(() => {
    if (
      !activeSession ||
      !['professional_arrived', 'in_progress'].includes(activeSession.status)
    ) {
      return;
    }

    let watchSub: Location.LocationSubscription | null = null;
    let active = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) return;

      watchSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 5,
        },
        (loc) => {
          emitLocationUpdate(
            sessionId,
            loc.coords.latitude,
            loc.coords.longitude,
            loc.coords.accuracy ?? undefined
          );
        }
      );
    })();

    return () => {
      active = false;
      if (watchSub) {
        watchSub.remove();
      }
    };
  }, [activeSession?.status, sessionId, emitLocationUpdate]);

  const handleArrive = async () => {
    setSubmitting(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = current.coords.latitude;
        lng = current.coords.longitude;
      }
      await markArrived(sessionId, lat, lng);
      Alert.alert('Arrival Verified', 'Arrival recorded. You can now tap Start Session.');
    } catch (err: any) {
      Alert.alert('Arrival Error', err?.response?.data?.message || 'Unable to mark arrival.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async () => {
    setSubmitting(true);
    try {
      await startSession(sessionId);
      Alert.alert('Session Started', 'Server-authoritative timer is now running.');
    } catch (err: any) {
      Alert.alert('Start Failed', err?.response?.data?.message || 'Unable to start session.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!completionNotes.trim() && !reportNotes.trim()) {
      Alert.alert(
        'Completion Notes Required',
        'Please enter session report/completion notes before completing the session.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const numericScore = Math.min(10, Math.max(1, Number(behaviorScore) || 8));
      const { settlement } = await completeSession(sessionId, {
        reportNotes: reportNotes.trim() || completionNotes.trim(),
        completionNotes: completionNotes.trim() || reportNotes.trim(),
        checklist: [{ label: 'Session protocol & safety check completed', completed: true }],
        behaviorScores: {
          obedience: numericScore,
          leashControl: numericScore,
          socialization: numericScore,
          calmness: numericScore,
          overallProgressScore: numericScore * 10,
        },
      });

      Alert.alert(
        'Session Completed & Settled',
        `Payout credited to your wallet: ₹${Number(
          settlement?.professionalPayoutAmount || activeSession?.professionalPayoutAmount || 0
        ).toLocaleString('en-IN')}.`,
        [{ text: 'View Report', onPress: () => navigation.replace('SessionReport', { sessionId }) }]
      );
    } catch (err: any) {
      Alert.alert(
        'Completion Failed',
        err?.response?.data?.message || 'Unable to complete and settle session.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const status = activeSession?.status || 'scheduled';
  const timerExpired = status === 'in_progress' && remainingSeconds <= 0 && elapsedSeconds > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>SESSION STATUS</Text>
        <Text style={styles.statusValue}>{status.replace(/_/g, ' ').toUpperCase()}</Text>
        <Text style={styles.metaLine}>
          Arrival Status: {activeSession?.arrivalVerificationStatus || 'pending'} • Distance:{' '}
          {distanceCovered.toFixed(2)} km
        </Text>
        {timerExpired && (
          <Text style={styles.awaitingNotice}>
            Scheduled timer reached zero — awaiting professional completion confirmation.
          </Text>
        )}
      </View>

      <View style={styles.timerGrid}>
        <View style={styles.timerCard}>
          <Clock size={16} color={Colors.slateDark} />
          <Text style={styles.timerCaption}>Elapsed</Text>
          <Text style={styles.timerNum}>{formatSeconds(elapsedSeconds)}</Text>
        </View>
        <View style={styles.timerCard}>
          <Clock size={16} color={Colors.primary} />
          <Text style={styles.timerCaption}>Remaining</Text>
          <Text style={[styles.timerNum, { color: Colors.primary }]}>
            {formatSeconds(remainingSeconds)}
          </Text>
        </View>
      </View>

      {/* Step 1: Arrive */}
      {status === 'scheduled' && (
        <TouchableOpacity
          style={[styles.arriveBtn, submitting && styles.disabledBtn]}
          onPress={handleArrive}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <MapPinCheck size={18} color={Colors.white} />
              <Text style={styles.btnText}>I&apos;ve Arrived &amp; Verify</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Step 2: Start Session */}
      {status === 'professional_arrived' && (
        <TouchableOpacity
          style={[styles.startBtn, submitting && styles.disabledBtn]}
          onPress={handleStart}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Play size={18} color={Colors.white} />
              <Text style={styles.btnText}>Start Session</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Step 3: Completion Report & Atomic Settlement */}
      {['professional_arrived', 'in_progress', 'duration_completed'].includes(status) && (
        <View style={styles.reportCard}>
          <Text style={styles.cardTitle}>Session Report &amp; Completion</Text>

          <Text style={styles.inputLabel}>Completion Notes</Text>
          <TextInput
            style={styles.input}
            placeholder="Summarize session execution, pet response, and next steps..."
            placeholderTextColor={Colors.slateMuted}
            value={completionNotes}
            onChangeText={setCompletionNotes}
            multiline
          />

          <Text style={styles.inputLabel}>Trainer / Care Feedback</Text>
          <TextInput
            style={styles.input}
            placeholder="Detailed feedback for pet parent & progress record..."
            placeholderTextColor={Colors.slateMuted}
            value={reportNotes}
            onChangeText={setReportNotes}
            multiline
          />

          <Text style={styles.inputLabel}>Behaviour / Care Score (1-10)</Text>
          <TextInput
            style={styles.smallInput}
            keyboardType="number-pad"
            maxLength={2}
            value={behaviorScore}
            onChangeText={setBehaviorScore}
          />

          <TouchableOpacity
            style={[styles.completeBtn, submitting && styles.disabledBtn]}
            onPress={handleComplete}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <CheckCircle2 size={18} color={Colors.white} />
                <Text style={styles.btnText}>
                  Complete Session &amp; Settle Wallet (₹{activeSession?.professionalPayoutAmount ?? 0})
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  statusLabel: { fontSize: 11, fontWeight: '700', color: Colors.slateMuted },
  statusValue: { fontSize: 20, fontWeight: '800', color: Colors.slateDark, marginTop: 2 },
  metaLine: { ...Typography.caption, marginTop: 4 },
  awaitingNotice: {
    marginTop: 8,
    color: Colors.warning,
    fontWeight: '700',
    fontSize: 12,
  },
  timerGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  timerCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  timerCaption: { ...Typography.caption, marginTop: 4 },
  timerNum: { fontSize: 22, fontWeight: '800', color: Colors.slateDark, marginTop: 2 },
  arriveBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.info,
    paddingVertical: 14,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  startBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.mintDark,
    paddingVertical: 14,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  completeBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  disabledBtn: { opacity: 0.65 },
  reportCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  inputLabel: { ...Typography.caption, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: 74,
    color: Colors.slateDark,
    textAlignVertical: 'top',
  },
  smallInput: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    width: 90,
    color: Colors.slateDark,
    fontWeight: '700',
  },
});