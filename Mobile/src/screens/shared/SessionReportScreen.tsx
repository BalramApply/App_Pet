import React, { useCallback, useEffect, useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Star, Wallet, FileText } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { SessionItem } from '../../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionReport'>;

export const SessionReportScreen: React.FC<Props> = ({ route }) => {
  const { sessionId } = route.params;
  const { user } = useAuthStore();
  const [session, setSession] = useState<SessionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiClient.get(`/sessions/${sessionId}`);
      setSession(res.data.data.session);
    } catch (err: any) {
      // Show the real reason instead of a generic message
      setLoadError(err?.response?.data?.message || err?.message || 'Could not load the session report.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      await apiClient.post(`/sessions/${sessionId}/review`, {
        rating,
        criteria: { punctuality: rating, petCare: rating, communication: rating },
        reviewText: reviewText.trim(),
      });
      Alert.alert('Review Submitted', 'Thank you for rating your PetJeeva session.');
      setSession((prev) => (prev ? { ...prev, reviewEligible: false, review: 'submitted' } : null));
    } catch (err: any) {
      Alert.alert('Review Error', err?.response?.data?.message || 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Session report unavailable.</Text>
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
        <TouchableOpacity style={styles.retryBtn} onPress={loadSession}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCustomer = user?.role === 'pet_parent';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.rowGap}>
          <FileText size={20} color={Colors.primary} />
          <Text style={styles.title}>Session #{session.sessionNumber} Report</Text>
        </View>
        <Text style={styles.meta}>
          Status: {session.status.toUpperCase()} • Duration: {Math.floor((session.actualDurationSeconds || 0) / 60)}m{' '}
          {(session.actualDurationSeconds || 0) % 60}s • Distance: {(session.distanceCovered || 0).toFixed(2)} km
        </Text>
        <Text style={styles.bodyText}>
          {session.reportNotes || session.completionNotes || 'Session completed successfully.'}
        </Text>
      </View>

      {/* Wallet Settlement Receipt */}
      <View style={styles.settlementCard}>
        <View style={styles.rowGap}>
          <Wallet size={18} color={Colors.mintDark} />
          <Text style={styles.settlementTitle}>Atomic Wallet Settlement</Text>
        </View>
        <Text style={styles.settlementLine}>
          Client Session Deduction: ₹{Number(session.sessionAmount || 0).toLocaleString('en-IN')}
        </Text>
        <Text style={styles.settlementLine}>
          Professional Payout Credited: ₹
          {Number(session.professionalPayoutAmount || 0).toLocaleString('en-IN')}
        </Text>
        <Text style={styles.settlementStatus}>
          Settlement Status: {session.walletSettled ? 'SETTLED & LEDGERED' : 'PENDING'}
        </Text>
      </View>

      {/* Customer Review Form */}
      {isCustomer && session.status === 'completed' && !session.review && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rate This Session</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)}>
                <Star
                  size={28}
                  color={n <= rating ? Colors.warning : Colors.border}
                  fill={n <= rating ? Colors.warning : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Share feedback on punctuality, pet care & communication..."
            placeholderTextColor={Colors.slateMuted}
            value={reviewText}
            onChangeText={setReviewText}
            multiline
          />

          <TouchableOpacity
            style={[styles.primaryBtn, submittingReview && styles.disabledBtn]}
            onPress={handleSubmitReview}
            disabled={submittingReview}
          >
            {submittingReview ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Submit Session Review</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  muted: { ...Typography.caption },
  errorText: { ...Typography.caption, color: Colors.danger, textAlign: 'center', marginTop: 6 },
  retryBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  retryText: { color: Colors.white, fontWeight: '700' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { ...Typography.h2, fontSize: 18 },
  meta: { ...Typography.caption, marginBottom: Spacing.sm },
  bodyText: { ...Typography.body, lineHeight: 20 },
  settlementCard: {
    backgroundColor: Colors.mint,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    marginBottom: Spacing.md,
  },
  settlementTitle: { fontWeight: '800', color: Colors.mintDark, fontSize: 15 },
  settlementLine: { fontWeight: '600', color: Colors.slateDark, fontSize: 13, marginTop: 4 },
  settlementStatus: { fontWeight: '800', color: Colors.mintDark, fontSize: 12, marginTop: 6 },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: 76,
    color: Colors.slateDark,
    marginBottom: Spacing.md,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  disabledBtn: { opacity: 0.7 },
});