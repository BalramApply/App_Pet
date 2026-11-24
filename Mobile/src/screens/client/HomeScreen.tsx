import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Wallet,
  Dog,
  Cat,
  GraduationCap,
  Footprints,
  Sparkles,
  Syringe,
  Navigation,
  PhoneCall,
  AlertTriangle,
  Plus,
  ChevronRight,
  Activity,
  TrendingUp,
  Clock,
} from 'lucide-react-native';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useWalletStore } from '../../store/useWalletStore';
import { usePetStore } from '../../store/usePetStore';
import { useBookingStore } from '../../store/useBookingStore';
import { RootStackParamList } from '../../types/navigation';
import { apiClient } from '../../api/client';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PROMO_BANNERS = [
  {
    id: 'p1',
    badge: 'FREE DEMO',
    title: 'Free Behaviour & Obedience Assessment',
    subtitle: 'Meet a PetJeeva counsellor & certified trainer for your dog or cat.',
    serviceType: 'Training' as const,
  },
  {
    id: 'p2',
    badge: 'LIVE LEAFLET GPS',
    title: 'Real-Time Route & Distance Walk Logs',
    subtitle: 'Track every step on an interactive OpenStreetMap Leaflet view.',
    serviceType: 'Walking' as const,
  },
  {
    id: 'p3',
    badge: 'HOME CARE',
    title: 'Doorstep Grooming & Vaccination Vault',
    subtitle: 'Verified pros at your home with digital certificates & reminders.',
    serviceType: 'Vaccination' as const,
  },
];

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { user, refreshProfile } = useAuthStore();
  const { balance, fetchBalance } = useWalletStore();
  const { pets, activePetId, fetchPets, setActivePetId, addPet } = usePetStore();
  const { bookings, fetchCatalog, fetchBookings } = useBookingStore();

  const [refreshing, setRefreshing] = useState(false);
  const [petModalVisible, setPetModalVisible] = useState(false);
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState<'dog' | 'cat'>('dog');
  const [petBreed, setPetBreed] = useState('');
  const [petGender, setPetGender] = useState<'male' | 'female'>('male');
  const [savingPet, setSavingPet] = useState(false);

  const loadAll = useCallback(async () => {
    await Promise.allSettled([
      refreshProfile(),
      fetchBalance(),
      fetchPets(),
      fetchCatalog(),
      fetchBookings(),
    ]);
  }, [refreshProfile, fetchBalance, fetchPets, fetchCatalog, fetchBookings]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const activePet = pets.find((p) => p._id === activePetId) || pets[0] || null;
  const displayBalance = Number(balance ?? user?.walletBalance ?? 0);

  const activeBooking = bookings.find((b) => b.status === 'active') || null;
  const upcomingBooking = bookings.find((b) => b.status === 'upcoming') || null;
  const completedBooking = bookings.find((b) => b.status === 'completed') || null;

  const activeSession =
    activeBooking?.sessionIds?.find((s) =>
      ['professional_arrived', 'in_progress', 'duration_completed'].includes(s.status)
    ) ||
    activeBooking?.sessionIds?.[0] ||
    null;

  const handleQuickPetCreate = async () => {
    if (!petName.trim() || !petBreed.trim()) {
      Alert.alert('Missing Details', 'Please enter pet name and breed.');
      return;
    }
    setSavingPet(true);
    try {
      await addPet({
        name: petName.trim(),
        species: petSpecies,
        breed: petBreed.trim(),
        gender: petGender,
        age: { years: 1, months: 0, lifeStage: 'adult' },
      });
      setPetName('');
      setPetBreed('');
      setPetModalVisible(false);
    } catch (err: any) {
      Alert.alert('Could Not Add Pet', err?.response?.data?.message || 'Try again.');
    } finally {
      setSavingPet(false);
    }
  };

  const handleEmergencySos = async () => {
    Alert.alert(
      'Emergency SOS Alert',
      'Send an immediate critical SOS ticket to PetJeeva Emergency Desk & your Relationship Manager?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiClient.post('/support/tickets', {
                type: 'emergency_sos',
                priority: 'critical',
                subject: `Emergency SOS for ${activePet?.name || 'Pet'}`,
                notes: `Urgent assistance requested from Home screen for pet ${
                  activePet?.name || 'N/A'
                } (${user?.name || 'Pet Parent'}).`,
                bookingId: activeBooking?._id || upcomingBooking?._id || null,
                sessionId: activeSession?._id || null,
              });
              Alert.alert(
                'SOS Logged',
                `Ticket #${res.data.data.ticket.ticketNumber} created. Our emergency team is notified.`
              );
            } catch (err: any) {
              Alert.alert('SOS Error', err?.response?.data?.message || 'Unable to log SOS.');
            }
          },
        },
      ]
    );
  };

  const handleRmShortcut = () => {
    const rm = user?.profile?.assignedRelationshipManager;
    Alert.alert(
      'Dedicated Relationship Manager',
      rm
        ? `RM: ${rm.name}\nPhone: ${rm.phone}\n${rm.email || 'PetJeeva Priority Desk'}`
        : 'Your account is supported by the PetJeeva Relationship Desk (+91-124-400-0100 / support@petjeeva.com).',
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Open Support Hub',
          onPress: () => navigation.navigate('MainTabs', { screen: 'SupportTab' } as any),
        },
      ]
    );
  };

  const coreServices: Array<{
    type: 'Training' | 'Walking' | 'Grooming' | 'Vaccination';
    label: string;
    sub: string;
    bg: string;
    icon: React.ReactNode;
  }> = [
    {
      type: 'Training',
      label: 'Training',
      sub: 'Obedience & Demo',
      bg: '#FFF1F2',
      icon: <GraduationCap size={24} color={Colors.primary} />,
    },
    {
      type: 'Walking',
      label: 'Walking',
      sub: 'Leaflet Live GPS',
      bg: Colors.mint,
      icon: <Footprints size={24} color={Colors.mintDark} />,
    },
    {
      type: 'Grooming',
      label: 'Grooming',
      sub: 'Doorstep Spa',
      bg: '#EFF6FF',
      icon: <Sparkles size={24} color={Colors.info} />,
    },
    {
      type: 'Vaccination',
      label: 'Vaccination',
      sub: 'Vet & Certs',
      bg: '#FEF3C7',
      icon: <Syringe size={24} color={Colors.warning} />,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Greeting + Wallet Balance Pill */}
      <View style={styles.topBar}>
        <View style={styles.greetingBox}>
          <Text style={styles.greetingSub}>Hello, Pet Parent</Text>
          <Text style={styles.greetingName} numberOfLines={1}>
            {user?.name || 'Ballu'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.walletPill}
          onPress={() => navigation.navigate('MainTabs', { screen: 'WalletTab' } as any)}
        >
          <Wallet size={16} color={Colors.mintDark} />
          <Text style={styles.walletText}>₹{displayBalance.toLocaleString('en-IN')}</Text>
        </TouchableOpacity>
      </View>

      {/* Active Pet Selector & Profile Summary */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Active Pet</Text>
          <TouchableOpacity style={styles.addPetBtn} onPress={() => setPetModalVisible(true)}>
            <Plus size={14} color={Colors.primary} />
            <Text style={styles.addPetText}>Add Pet</Text>
          </TouchableOpacity>
        </View>

        {pets.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petChipsRow}>
              {pets.map((p) => {
                const selected = activePet?._id === p._id;
                return (
                  <TouchableOpacity
                    key={p._id}
                    style={[styles.petChip, selected && styles.petChipActive]}
                    onPress={() => setActivePetId(p._id)}
                  >
                    {p.species === 'cat' ? (
                      <Cat size={15} color={selected ? Colors.white : Colors.slateDark} />
                    ) : (
                      <Dog size={15} color={selected ? Colors.white : Colors.slateDark} />
                    )}
                    <Text style={[styles.petChipText, selected && styles.petChipTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activePet && (
              <View style={styles.petSummaryBox}>
                <View style={styles.petSummaryMain}>
                  <Text style={styles.petSummaryTitle}>
                    {activePet.name} • {activePet.breed}
                  </Text>
                  <Text style={styles.petSummaryMeta}>
                    {activePet.species.toUpperCase()} • {activePet.gender} •{' '}
                    {activePet.age?.years || 0}y {activePet.age?.months || 0}m
                  </Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  <Text style={styles.scoreValue}>
                    {activePet.behaviourSummary?.latestBehaviorScore ?? '--'}
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <TouchableOpacity style={styles.emptyPetBox} onPress={() => setPetModalVisible(true)}>
            <Text style={styles.emptyPetText}>
              No pet added yet. Tap to add your Dog or Cat for bookings & health records.
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active Session Banner + Live Leaflet Tracking Shortcut */}
      {activeSession && (
        <View style={styles.activeSessionCard}>
          <View style={styles.activeSessionTop}>
            <View style={styles.liveDotRow}>
              <View style={styles.liveDot} />
              <Text style={styles.activeSessionBadge}>
                ACTIVE SESSION • {activeSession.status.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
            <Activity size={18} color={Colors.primary} />
          </View>
          <Text style={styles.activeSessionTitle}>
            Session #{activeSession.sessionNumber} • {activeBooking?.service?.type || 'Service'}
          </Text>
          <Text style={styles.activeSessionSub}>
            Professional: {activeBooking?.assignedProfessional?.name || 'Assigned Pro'} • Distance:{' '}
            {(activeSession.distanceCovered || 0).toFixed(2)} km
          </Text>
          <View style={styles.activeActionsRow}>
            <TouchableOpacity
              style={styles.leafletBtn}
              onPress={() =>
                navigation.navigate('LiveTracking', {
                  sessionId: activeSession._id,
                  bookingId: activeBooking?._id,
                })
              }
            >
              <Navigation size={15} color={Colors.white} />
              <Text style={styles.leafletBtnText}>Live Leaflet Map</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sessionViewBtn}
              onPress={() =>
                navigation.navigate('CustomerActiveSession', {
                  sessionId: activeSession._id,
                  bookingId: activeBooking?._id,
                })
              }
            >
              <Text style={styles.sessionViewBtnText}>Session Status</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Four Core Services */}
      <Text style={styles.blockHeading}>Core Pet Care Services</Text>
      <View style={styles.servicesGrid}>
        {coreServices.map((svc) => (
          <TouchableOpacity
            key={svc.type}
            style={styles.serviceCard}
            onPress={() =>
              navigation.navigate('ServiceCatalog', {
                initialServiceType: svc.type,
                speciesFilter: activePet?.species,
              })
            }
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: svc.bg }]}>{svc.icon}</View>
            <Text style={styles.serviceLabel}>{svc.label}</Text>
            <Text style={styles.serviceSub}>{svc.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Promo Carousel */}
      <Text style={styles.blockHeading}>Featured Highlights</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promoScroll}>
        {PROMO_BANNERS.map((banner) => (
          <TouchableOpacity
            key={banner.id}
            style={styles.promoCard}
            onPress={() =>
              navigation.navigate('ServiceCatalog', {
                initialServiceType: banner.serviceType,
                speciesFilter: activePet?.species,
              })
            }
          >
            <Text style={styles.promoBadge}>{banner.badge}</Text>
            <Text style={styles.promoTitle}>{banner.title}</Text>
            <Text style={styles.promoSub}>{banner.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Quick Shortcuts: RM, SOS, Progress, Upcoming & Recent Session */}
      <View style={styles.shortcutsRow}>
        <TouchableOpacity style={styles.shortcutBtn} onPress={handleRmShortcut}>
          <PhoneCall size={18} color={Colors.info} />
          <Text style={styles.shortcutText}>RM Desk</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shortcutBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'VaultTab' } as any)}
        >
          <TrendingUp size={18} color={Colors.mintDark} />
          <Text style={styles.shortcutText}>Pet Progress</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.shortcutBtn, styles.sosBtn]} onPress={handleEmergencySos}>
          <AlertTriangle size={18} color={Colors.danger} />
          <Text style={[styles.shortcutText, styles.sosText]}>Emergency SOS</Text>
        </TouchableOpacity>
      </View>

      {/* Upcoming Booking Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <View style={styles.infoTitleRow}>
            <Clock size={17} color={Colors.primary} />
            <Text style={styles.infoCardTitle}>Upcoming Booking</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'BookingsTab' } as any)}
          >
            <ChevronRight size={18} color={Colors.slateMuted} />
          </TouchableOpacity>
        </View>
        {upcomingBooking ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('BookingDetail', { bookingId: upcomingBooking._id })}
          >
            <Text style={styles.infoMainText}>
              {upcomingBooking.service?.type} • {upcomingBooking.pet?.name}
            </Text>
            <Text style={styles.infoMetaText}>
              {new Date(upcomingBooking.scheduledDate).toDateString()} ({upcomingBooking.timeSlot}) •{' '}
              Pro: {upcomingBooking.assignedProfessional?.name || 'Pending Assignment'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.infoMetaText}>No upcoming bookings scheduled.</Text>
        )}
      </View>

      {/* Recent Completed Session Summary */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <Text style={styles.infoCardTitle}>Recent Session Summary</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'VaultTab' } as any)}
          >
            <Text style={styles.viewAllLink}>Vault</Text>
          </TouchableOpacity>
        </View>
        {completedBooking ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('BookingDetail', { bookingId: completedBooking._id })}
          >
            <Text style={styles.infoMainText}>
              {completedBooking.service?.type} — {completedBooking.package?.name}
            </Text>
            <Text style={styles.infoMetaText}>
              Sessions Completed: {completedBooking.completedSessionCount}/
              {completedBooking.totalSessionCount} • Pet: {completedBooking.pet?.name}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.infoMetaText}>
            Completed session reports, media, and wallet receipts will appear here.
          </Text>
        )}
      </View>

      {/* Quick Add Pet Modal */}
      <Modal
        visible={petModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPetModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Pet Profile</Text>

            <View style={styles.speciesToggleRow}>
              <TouchableOpacity
                style={[styles.speciesOpt, petSpecies === 'dog' && styles.speciesOptSelected]}
                onPress={() => setPetSpecies('dog')}
              >
                <Text
                  style={[styles.speciesOptText, petSpecies === 'dog' && styles.speciesOptTextSelected]}
                >
                  Dog
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.speciesOpt, petSpecies === 'cat' && styles.speciesOptSelected]}
                onPress={() => setPetSpecies('cat')}
              >
                <Text
                  style={[styles.speciesOptText, petSpecies === 'cat' && styles.speciesOptTextSelected]}
                >
                  Cat
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Pet Name (e.g. Bruno)"
              placeholderTextColor={Colors.slateMuted}
              value={petName}
              onChangeText={setPetName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Breed (e.g. Golden Retriever / Indie)"
              placeholderTextColor={Colors.slateMuted}
              value={petBreed}
              onChangeText={setPetBreed}
            />

            <View style={styles.speciesToggleRow}>
              <TouchableOpacity
                style={[styles.speciesOpt, petGender === 'male' && styles.speciesOptSelected]}
                onPress={() => setPetGender('male')}
              >
                <Text
                  style={[styles.speciesOptText, petGender === 'male' && styles.speciesOptTextSelected]}
                >
                  Male
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.speciesOpt, petGender === 'female' && styles.speciesOptSelected]}
                onPress={() => setPetGender('female')}
              >
                <Text
                  style={[
                    styles.speciesOptText,
                    petGender === 'female' && styles.speciesOptTextSelected,
                  ]}
                >
                  Female
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPetModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleQuickPetCreate}
                disabled={savingPet}
              >
                <Text style={styles.modalSaveText}>{savingPet ? 'Saving...' : 'Save Pet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  greetingBox: { flex: 1, paddingRight: Spacing.sm },
  greetingSub: { ...Typography.caption },
  greetingName: { ...Typography.h1 },
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
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { ...Typography.h3 },
  addPetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    gap: 4,
  },
  addPetText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  petChipsRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    gap: 6,
  },
  petChipActive: { backgroundColor: Colors.slateDark, borderColor: Colors.slateDark },
  petChipText: { fontWeight: '600', color: Colors.slateDark, fontSize: 13 },
  petChipTextActive: { color: Colors.white },
  petSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: Radii.md,
  },
  petSummaryMain: { flex: 1 },
  petSummaryTitle: { fontWeight: '700', color: Colors.slateDark, fontSize: 15 },
  petSummaryMeta: { ...Typography.caption, marginTop: 2 },
  scoreBadge: {
    backgroundColor: Colors.mint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  scoreLabel: { fontSize: 10, fontWeight: '700', color: Colors.mintDark },
  scoreValue: { fontSize: 16, fontWeight: '800', color: Colors.slateDark },
  emptyPetBox: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyPetText: { ...Typography.caption, textAlign: 'center' },
  activeSessionCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  activeSessionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  activeSessionBadge: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  activeSessionTitle: { fontSize: 16, fontWeight: '700', color: Colors.slateDark },
  activeSessionSub: { ...Typography.caption, marginTop: 2, marginBottom: Spacing.sm },
  activeActionsRow: { flexDirection: 'row', gap: Spacing.sm },
  leafletBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: Radii.md,
    gap: 6,
  },
  leafletBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  sessionViewBtn: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionViewBtnText: { color: Colors.slateDark, fontWeight: '700', fontSize: 13 },
  blockHeading: { ...Typography.h3, marginBottom: Spacing.sm, marginTop: 4 },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  serviceCard: {
    width: '48.5%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  serviceIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  serviceLabel: { fontWeight: '700', fontSize: 15, color: Colors.slateDark },
  serviceSub: { ...Typography.caption, marginTop: 2 },
  promoScroll: { marginBottom: Spacing.md },
  promoCard: {
    width: 255,
    backgroundColor: Colors.slateDark,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginRight: Spacing.sm,
  },
  promoBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryLight,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  promoTitle: { color: Colors.white, fontWeight: '700', fontSize: 15, marginBottom: 4 },
  promoSub: { color: '#D1D5DB', fontSize: 12, lineHeight: 17 },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 11,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  shortcutText: { fontWeight: '700', fontSize: 12, color: Colors.slateDark },
  sosBtn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  sosText: { color: Colors.danger },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoCardTitle: { ...Typography.h3, fontSize: 15 },
  viewAllLink: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  infoMainText: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  infoMetaText: { ...Typography.caption, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,30,45,0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: { backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.lg },
  modalTitle: { ...Typography.h2, marginBottom: Spacing.md },
  speciesToggleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  speciesOpt: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  speciesOptSelected: { backgroundColor: Colors.slateDark, borderColor: Colors.slateDark },
  speciesOptText: { fontWeight: '700', color: Colors.slateDark },
  speciesOptTextSelected: { color: Colors.white },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 46,
    marginBottom: Spacing.md,
    color: Colors.slateDark,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontWeight: '700', color: Colors.slateDark },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSaveText: { fontWeight: '700', color: Colors.white },
});