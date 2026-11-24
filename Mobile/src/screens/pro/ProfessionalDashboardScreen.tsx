import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Wallet, Briefcase, CheckCircle2, PlayCircle, Calendar } from 'lucide-react-native';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useWalletStore } from '../../store/useWalletStore';
import { useBookingStore } from '../../store/useBookingStore';
import { useProfessionalStore } from '../../store/useProfessionalStore';
import { RootStackParamList } from '../../types/navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

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
  if (
    typeof endOrDurationInput === 'number' &&
    Number.isFinite(endOrDurationInput) &&
    endOrDurationInput > 0
  ) {
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

export const ProfessionalDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { user, refreshProfile } = useAuthStore();
  const { balance, fetchBalance } = useWalletStore();
  const { bookings, fetchBookings } = useBookingStore();
  const { myProfessionalProfile, fetchMyProfessionalProfile } = useProfessionalStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadProDesk = useCallback(async () => {
    await Promise.allSettled([
      refreshProfile(),
      fetchBalance(),
      fetchBookings(),
      fetchMyProfessionalProfile(),
    ]);
  }, [refreshProfile, fetchBalance, fetchBookings, fetchMyProfessionalProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProDesk();
    }, [loadProDesk])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProDesk();
    setRefreshing(false);
  };

  const activeBookings = bookings.filter((b) => b.status === 'active');
  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');
  const completedBookings = bookings.filter((b) => b.status === 'completed');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.caption}>Professional Desk • {user?.role?.toUpperCase()}</Text>
          <Text style={styles.title}>{user?.name || 'PetJeeva Pro'}</Text>
        </View>
        <TouchableOpacity
          style={styles.walletPill}
          onPress={() => navigation.navigate('MainTabs', { screen: 'WalletTab' } as any)}
        >
          <Wallet size={16} color={Colors.mintDark} />
          <Text style={styles.walletText}>₹{Number(balance ?? 0).toLocaleString('en-IN')}</Text>
        </TouchableOpacity>
      </View>

      {/* Performance Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Briefcase size={18} color={Colors.primary} />
          <Text style={styles.statNum}>
            {myProfessionalProfile?.totalAssignedSessions ?? bookings.length}
          </Text>
          <Text style={styles.statLbl}>Assigned</Text>
        </View>
        <View style={styles.statCard}>
          <CheckCircle2 size={18} color={Colors.mintDark} />
          <Text style={styles.statNum}>
            {myProfessionalProfile?.totalCompletedSessions ?? completedBookings.length}
          </Text>
          <Text style={styles.statLbl}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>
            {myProfessionalProfile?.completionPercentage ?? 0}%
          </Text>
          <Text style={styles.statLbl}>Rate</Text>
        </View>
      </View>

      {/* Active & Assigned Sessions */}
      <Text style={styles.sectionHeading}>Active &amp; Scheduled Assignments</Text>
      {[...activeBookings, ...upcomingBookings].map((b) => {
        const nextSession: any =
          b.sessionIds?.find((s) => s.status !== 'completed' && s.status !== 'cancelled') ||
          b.sessionIds?.[0];

        const sessionDate = nextSession?.scheduledDate || b.scheduledDate;
        const endOrDuration =
          nextSession?.scheduledEndAt ||
          nextSession?.scheduledDurationMinutes ||
          b.package?.sessionDuration ||
          b.service?.sessionDuration ||
          null;

        const scheduleLabel = formatSessionScheduleLine(
          sessionDate,
          endOrDuration,
          b.timeSlot
        );

        const canOpenConsole = nextSession ? isSameCalendarDay(sessionDate) : false;

        return (
          <View key={b._id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.badge}>
                {b.service?.type} • {b.status.toUpperCase()}
              </Text>
              <Text style={styles.payoutText}>
                Payout: ₹{b.perSessionPayoutAmount}/session
              </Text>
            </View>
            <Text style={styles.cardTitle}>
              Pet: {b.pet?.name} ({b.pet?.breed})
            </Text>
            <View style={styles.scheduleRow}>
              <Calendar size={14} color={Colors.slateMuted} />
              <Text style={styles.meta}>{scheduleLabel}</Text>
            </View>
            <Text style={styles.meta}>
              Client: {(b.user as any)?.name || 'Pet Parent'} • {b.addressSnapshot?.line1}
            </Text>

            {nextSession && (
              <TouchableOpacity
                style={[styles.consoleBtn, !canOpenConsole && styles.consoleBtnLocked]}
                disabled={!canOpenConsole}
                onPress={() =>
                  navigation.navigate('ProfessionalSession', {
                    sessionId: nextSession._id,
                    bookingId: b._id,
                  })
                }
              >
                <PlayCircle size={16} color={Colors.white} />
                <Text style={styles.consoleBtnText}>
                  {canOpenConsole
                    ? `Open Session #${nextSession.sessionNumber} Console (${nextSession.status})`
                    : `Locked • Session #${nextSession.sessionNumber} Scheduled Day Only`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  caption: { ...Typography.caption },
  title: { ...Typography.h1 },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.mint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    gap: 6,
  },
  walletText: { fontWeight: '800', color: Colors.mintDark, fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.slateDark, marginTop: 4 },
  statLbl: { ...Typography.caption, marginTop: 2 },
  sectionHeading: { ...Typography.h3, marginBottom: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  payoutText: { fontSize: 12, fontWeight: '800', color: Colors.mintDark },
  cardTitle: { fontWeight: '700', color: Colors.slateDark, fontSize: 15, marginTop: 4 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { ...Typography.caption, marginTop: 2 },
  consoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.slateDark,
    paddingVertical: 11,
    borderRadius: Radii.md,
    gap: 8,
    marginTop: Spacing.sm,
  },
  consoleBtnLocked: {
    opacity: 0.45,
  },
  consoleBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});