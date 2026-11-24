import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Navigation, FileText, UserCheck, Receipt, XCircle } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { BookingItem, SessionItem, WalletTransaction } from '../../types/models';
import { CancellationModal } from '../../components/CancellationModal';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingDetail'>;

const PRO_ROLES = [
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

const fmtTime12 = (dateObj: Date) => {
  if (Number.isNaN(dateObj.getTime())) return '';
  let hours = dateObj.getHours();
  const minutes = pad2(dateObj.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${pad2(hours)}:${minutes} ${ampm}`;
};

const formatSessionScheduleLine = (
  sessionStart?: string | Date | null,
  endOrDurationInput?: string | Date | number | null,
  fallbackSlot?: string
) => {
  if (!sessionStart) return fallbackSlot || '-';
  const start = new Date(sessionStart);
  if (Number.isNaN(start.getTime())) return fallbackSlot || '-';

  const dayPart = start
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
    .replace(/,/g, '');

  const startTime = fmtTime12(start);

  let endDate: Date | null = null;
  if (typeof endOrDurationInput === 'number' && Number.isFinite(endOrDurationInput) && endOrDurationInput > 0) {
    endDate = new Date(start.getTime() + endOrDurationInput * 60 * 1000);
  } else if (endOrDurationInput) {
    const parsed = new Date(endOrDurationInput);
    if (!Number.isNaN(parsed.getTime())) endDate = parsed;
  }

  if (endDate) {
    return `${dayPart} • ${startTime} - ${fmtTime12(endDate)}`;
  }

  return fallbackSlot ? `${dayPart} • ${fallbackSlot}` : `${dayPart} • ${startTime}`;
};

const isSameCalendarDay = (dateInput?: string | Date | null, referenceDate = new Date()) => {
  if (!dateInput) return false;
  const target = new Date(dateInput);
  if (Number.isNaN(target.getTime())) return false;

  return (
    target.getFullYear() === referenceDate.getFullYear() &&
    target.getMonth() === referenceDate.getMonth() &&
    target.getDate() === referenceDate.getDate()
  );
};

export const BookingDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const { user } = useAuthStore();
  const [booking, setBooking] = useState<BookingItem | null>(null);
  const [settlements, setSettlements] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelVisible, setCancelVisible] = useState(false);

  const isPro = user ? PRO_ROLES.includes(user.role) : false;

  const loadBooking = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/bookings/${bookingId}`);
      setBooking(res.data.data.booking);
      setSettlements(res.data.data.settlementTransactions || []);
    } catch {
      // Handled by empty state
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      loadBooking();
    }, [loadBooking])
  );

  if (loading && !booking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Booking not found.</Text>
      </View>
    );
  }

  const sessions: SessionItem[] = booking.sessionIds || [];
  const primarySession: any =
    sessions.find((s) => s.status !== 'completed' && s.status !== 'cancelled') || sessions[0];

  const bookingHeaderDate = primarySession?.scheduledDate || booking.scheduledDate;
  const bookingHeaderEndOrDuration =
    (primarySession as any)?.scheduledEndAt ||
    primarySession?.scheduledDurationMinutes ||
    booking.package?.sessionDuration ||
    booking.service?.sessionDuration ||
    null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadBooking} tintColor={Colors.primary} />}
    >
      <View style={styles.card}>
        <Text style={styles.badge}>
          {booking.service?.type} • {booking.status.toUpperCase()}
        </Text>
        <Text style={styles.title}>{booking.package?.name}</Text>
        <Text style={styles.meta}>
          Pet: {booking.pet?.name} ({booking.pet?.breed}) •{' '}
          {formatSessionScheduleLine(
            bookingHeaderDate,
            bookingHeaderEndOrDuration,
            booking.timeSlot
          )}
        </Text>
        <Text style={styles.meta}>
          Address: {booking.addressSnapshot?.line1}, {booking.addressSnapshot?.city}
        </Text>
      </View>

      {/* Assigned Professional Card */}
      {booking.assignedProfessional && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowGap}>
              <UserCheck size={18} color={Colors.primary} />
              <View>
                <Text style={styles.cardLabel}>Assigned Professional</Text>
                <Text style={styles.cardValue}>{booking.assignedProfessional.name}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() =>
                navigation.navigate('ProfessionalProfile', {
                  professionalId: booking.assignedProfessional!._id,
                })
              }
            >
              <Text style={styles.linkBtnText}>Profile & Creds</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Per-Session Lifecycle */}
      <Text style={styles.sectionHeading}>
        Sessions ({booking.completedSessionCount}/{booking.totalSessionCount} Completed)
      </Text>
      {sessions.map((s: any) => {
        const effectiveSessionDate = s.scheduledDate || booking.scheduledDate;
        const sessionDateLine = formatSessionScheduleLine(
          effectiveSessionDate,
          s.scheduledEndAt || s.scheduledDurationMinutes,
          booking.timeSlot
        );
        const canOpenConsole = isSameCalendarDay(effectiveSessionDate);

        return (
          <View key={s._id} style={styles.sessionCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.sessionTitle}>
                Session #{s.sessionNumber} • {s.scheduledDurationMinutes} mins
              </Text>
              <Text style={styles.sessionStatus}>{s.status.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>

            <Text style={styles.sessionMeta}>{sessionDateLine}</Text>

            <Text style={styles.sessionMeta}>
              Fee: ₹{s.sessionAmount} • Payout: ₹{s.professionalPayoutAmount} • Settled:{' '}
              {s.walletSettled ? 'Yes' : 'Pending'}
            </Text>

            <View style={styles.sessionActions}>
              {isPro && s.status !== 'completed' && s.status !== 'cancelled' && (
                <TouchableOpacity
                  style={[styles.primarySmallBtn, !canOpenConsole && styles.disabledSmallBtn]}
                  disabled={!canOpenConsole}
                  onPress={() =>
                    navigation.navigate('ProfessionalSession', {
                      sessionId: s._id,
                      bookingId: booking._id,
                    })
                  }
                >
                  <Text style={styles.primarySmallText}>
                    {canOpenConsole ? 'Session Console' : 'Locked (Scheduled Day Only)'}
                  </Text>
                </TouchableOpacity>
              )}

              {!isPro &&
                ['professional_arrived', 'in_progress', 'duration_completed'].includes(s.status) && (
                  <>
                    <TouchableOpacity
                      style={styles.primarySmallBtn}
                      onPress={() =>
                        navigation.navigate('LiveTracking', {
                          sessionId: s._id,
                          bookingId: booking._id,
                        })
                      }
                    >
                      <Navigation size={13} color={Colors.white} />
                      <Text style={styles.primarySmallText}>Leaflet GPS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondarySmallBtn}
                      onPress={() =>
                        navigation.navigate('CustomerActiveSession', {
                          sessionId: s._id,
                          bookingId: booking._id,
                        })
                      }
                    >
                      <Text style={styles.secondarySmallText}>Live Timer</Text>
                    </TouchableOpacity>
                  </>
                )}

              {s.status === 'completed' && (
                <TouchableOpacity
                  style={styles.reportSmallBtn}
                  onPress={() => navigation.navigate('SessionReport', { sessionId: s._id })}
                >
                  <FileText size={13} color={Colors.mintDark} />
                  <Text style={styles.reportSmallText}>Report & Review</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {/* Wallet Settlement Receipts */}
      {settlements.length > 0 && (
        <View style={styles.card}>
          <View style={styles.rowGap}>
            <Receipt size={18} color={Colors.mintDark} />
            <Text style={styles.sectionTitleInline}>Wallet Settlement Ledger Entries</Text>
          </View>
          {settlements.map((tx) => (
            <View key={tx._id} style={styles.txRow}>
              <Text style={styles.txDesc}>{tx.description}</Text>
              <Text
                style={[
                  styles.txAmt,
                  { color: tx.type === 'credit' ? Colors.mintDark : Colors.danger },
                ]}
              >
                {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
              </Text>
            </View>
          ))}
        </View>
      )}

      {booking.status !== 'completed' && booking.status !== 'cancelled' && (
        <TouchableOpacity style={styles.cancelBookingBtn} onPress={() => setCancelVisible(true)}>
          <XCircle size={18} color={Colors.danger} />
          <Text style={styles.cancelBookingText}>Cancel Booking</Text>
        </TouchableOpacity>
      )}

      <CancellationModal
        visible={cancelVisible}
        bookingId={booking._id}
        onClose={() => setCancelVisible(false)}
        onCancelled={loadBooking}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...Typography.caption },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  badge: { fontSize: 11, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  title: { ...Typography.h2, fontSize: 18 },
  meta: { ...Typography.caption, marginTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardLabel: { ...Typography.caption, fontSize: 11 },
  cardValue: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  linkBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  linkBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  sectionHeading: { ...Typography.h3, marginBottom: Spacing.sm },
  sectionTitleInline: { ...Typography.h3, fontSize: 15 },
  sessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  sessionTitle: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  sessionStatus: { fontSize: 11, fontWeight: '800', color: Colors.info },
  sessionMeta: { ...Typography.caption, marginTop: 4 },
  sessionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  primarySmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
    gap: 5,
  },
  disabledSmallBtn: {
    opacity: 0.45,
  },
  primarySmallText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  secondarySmallBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  secondarySmallText: { color: Colors.slateDark, fontWeight: '700', fontSize: 12 },
  reportSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.mint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
    gap: 5,
  },
  reportSmallText: { color: Colors.mintDark, fontWeight: '700', fontSize: 12 },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  txDesc: { flex: 1, fontSize: 12, color: Colors.slateDark, paddingRight: 8 },
  txAmt: { fontWeight: '800', fontSize: 13 },
  cancelBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 13,
    borderRadius: Radii.md,
    gap: 8,
    marginTop: Spacing.xs,
  },
  cancelBookingText: { color: Colors.danger, fontWeight: '700', fontSize: 14 },
});