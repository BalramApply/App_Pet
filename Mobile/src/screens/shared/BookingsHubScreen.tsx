import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Navigation, Calendar, PawPrint, ChevronRight } from 'lucide-react-native';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useBookingStore } from '../../store/useBookingStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BookingItem } from '../../types/models';
import { RootStackParamList } from '../../types/navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

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

export const BookingsHubScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { bookings, isLoading, fetchBookings } = useBookingStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'active' | 'completed'>('upcoming');

  const isPro = user ? PRO_ROLES.includes(user.role) : false;

  useFocusEffect(
    useCallback(() => {
      fetchBookings().catch(() => {});
    }, [fetchBookings])
  );

  const filtered = bookings.filter((b) => {
    if (activeTab === 'upcoming') return b.status === 'upcoming';
    if (activeTab === 'active') return b.status === 'active';
    return b.status === 'completed' || b.status === 'cancelled';
  });

  const renderBooking = ({ item }: { item: BookingItem }) => {
    const primarySession: any =
      item.sessionIds?.find((s) => s.status !== 'completed' && s.status !== 'cancelled') ||
      item.sessionIds?.[0];

    const sessionDate = primarySession?.scheduledDate || item.scheduledDate;
    const endOrDuration =
      primarySession?.scheduledEndAt ||
      primarySession?.scheduledDurationMinutes ||
      item.package?.sessionDuration ||
      item.service?.sessionDuration ||
      null;

    const scheduleLabel = formatSessionScheduleLine(
      sessionDate,
      endOrDuration,
      item.timeSlot
    );

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
      >
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.serviceBadge}>{item.service?.type || 'Service'}</Text>
            <Text style={styles.pkgTitle}>{item.package?.name || 'Package'}</Text>
          </View>
          <View style={[styles.statusPill, item.status === 'active' && styles.activePill]}>
            <Text style={[styles.statusText, item.status === 'active' && styles.activeStatusText]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <PawPrint size={14} color={Colors.slateMuted} />
          <Text style={styles.metaText}>
            {item.pet?.name || 'Pet'} ({item.pet?.species || ''}) • Sessions:{' '}
            {item.completedSessionCount}/{item.totalSessionCount}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Calendar size={14} color={Colors.slateMuted} />
          <Text style={styles.metaText}>{scheduleLabel}</Text>
        </View>

        <Text style={styles.proLine}>
          {isPro
            ? `Client: ${(item.user as any)?.name || 'Pet Parent'}`
            : `Assigned Pro: ${item.assignedProfessional?.name || 'Pending Assignment'}`}
        </Text>

        <View style={styles.cardFooter}>
          {item.status === 'active' && primarySession ? (
            <View style={styles.quickButtons}>
              {!isPro && (
                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={() =>
                    navigation.navigate('LiveTracking', {
                      sessionId: primarySession._id,
                      bookingId: item._id,
                    })
                  }
                >
                  <Navigation size={13} color={Colors.white} />
                  <Text style={styles.mapBtnText}>Leaflet GPS</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.consoleBtn}
                onPress={() =>
                  navigation.navigate(
                    isPro ? 'ProfessionalSession' : 'CustomerActiveSession',
                    {
                      sessionId: primarySession._id,
                      bookingId: item._id,
                    }
                  )
                }
              >
                <Text style={styles.consoleBtnText}>
                  {isPro ? 'Open Session Console' : 'Active Session'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.detailPrompt}>
              <Text style={styles.detailPromptText}>Inspect Sessions & Receipts</Text>
              <ChevronRight size={16} color={Colors.primary} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings Hub</Text>
      </View>

      <View style={styles.tabsRow}>
        {(['upcoming', 'active', 'completed'] as const).map((tab) => {
          const selected = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, selected && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        renderItem={renderBooking}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchBookings} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No {activeTab} bookings found.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { ...Typography.h2 },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    marginBottom: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontWeight: '700', color: Colors.slateDark, fontSize: 13 },
  tabTextActive: { color: Colors.white },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  serviceBadge: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  pkgTitle: { fontSize: 16, fontWeight: '700', color: Colors.slateDark, marginTop: 2 },
  statusPill: {
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  activePill: { backgroundColor: Colors.mint },
  statusText: { fontSize: 11, fontWeight: '800', color: Colors.slateMuted },
  activeStatusText: { color: Colors.mintDark },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { ...Typography.caption },
  proLine: { fontSize: 12, fontWeight: '700', color: Colors.slateDark, marginTop: 4 },
  cardFooter: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  quickButtons: { flexDirection: 'row', gap: 8 },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
    gap: 5,
  },
  mapBtnText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  consoleBtn: {
    flex: 1,
    backgroundColor: Colors.slateDark,
    paddingVertical: 8,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  consoleBtnText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  detailPrompt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailPromptText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  emptyBox: { paddingVertical: Spacing.xl, alignItems: 'center' },
  emptyText: { ...Typography.caption },
});