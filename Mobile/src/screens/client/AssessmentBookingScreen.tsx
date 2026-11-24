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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Calendar, Clock, MapPin, Sparkles } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { usePetStore } from '../../store/usePetStore';
import { useBookingStore } from '../../store/useBookingStore';
import { useAuthStore } from '../../store/useAuthStore';

type Props = NativeStackScreenProps<RootStackParamList, 'AssessmentBooking'>;

const TIME_SLOTS = [
  '08:00 AM - 09:00 AM',
  '10:30 AM - 11:30 AM',
  '04:30 PM - 05:30 PM',
  '06:00 PM - 07:00 PM',
];

export const AssessmentBookingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { packageItem, petId } = route.params || {};
  const { pets, activePetId, fetchPets } = usePetStore();
  const { bookAssessment } = useBookingStore();
  const { user } = useAuthStore();

  const [selectedPetId, setSelectedPetId] = useState<string>(petId || activePetId || '');
  const [selectedSlot, setSelectedSlot] = useState<string>(TIME_SLOTS[1]);
  const [dateOffsetDays, setDateOffsetDays] = useState<number>(1);
  const [addressLine, setAddressLine] = useState<string>(
    user?.addresses?.[0]?.line1 || 'Sector 29, Gurugram, Haryana'
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (pets.length === 0) {
      fetchPets().catch(() => {});
    }
  }, [pets.length, fetchPets]);

  useEffect(() => {
    if (!selectedPetId) {
      setSelectedPetId(petId || activePetId || pets[0]?._id || '');
    }
  }, [selectedPetId, petId, activePetId, pets]);

  const scheduledDateObj = new Date(Date.now() + dateOffsetDays * 24 * 60 * 60 * 1000);

  const handleConfirmAssessment = async () => {
    if (!selectedPetId) {
      Alert.alert('Select a Pet', 'Please select or add a pet first.');
      return;
    }
    setSubmitting(true);
    try {
      const booking = await bookAssessment({
        petId: selectedPetId,
        packageId: packageItem?._id,
        scheduledDate: scheduledDateObj.toISOString(),
        timeSlot: selectedSlot,
        addressInput: {
          label: 'Home',
          line1: addressLine.trim() || 'Sector 29, Gurugram',
          city: 'Gurugram',
          state: 'Haryana',
          pincode: '122001',
        },
      });
      navigation.replace('BookingConfirmation', { booking });
    } catch (err: any) {
      Alert.alert(
        'Booking Failed',
        err?.response?.data?.message || 'Unable to schedule assessment.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Sparkles size={20} color={Colors.mintDark} />
        <View style={styles.bannerBody}>
          <Text style={styles.bannerTitle}>Free Assessment & Behaviour Demo</Text>
          <Text style={styles.bannerSub}>
            Includes a counsellor & trainer evaluation with zero upfront wallet deduction.
          </Text>
        </View>
      </View>

      <Text style={styles.label}>Select Pet</Text>
      <View style={styles.petRow}>
        {pets.map((p) => {
          const active = p._id === selectedPetId;
          return (
            <TouchableOpacity
              key={p._id}
              style={[styles.petChip, active && styles.petChipActive]}
              onPress={() => setSelectedPetId(p._id)}
            >
              <Text style={[styles.petChipText, active && styles.petChipTextActive]}>
                {p.name} ({p.species})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Select Day</Text>
      <View style={styles.dayRow}>
        {[1, 2, 3].map((offset) => {
          const d = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
          const selected = dateOffsetDays === offset;
          return (
            <TouchableOpacity
              key={offset}
              style={[styles.dayBtn, selected && styles.dayBtnActive]}
              onPress={() => setDateOffsetDays(offset)}
            >
              <Calendar size={14} color={selected ? Colors.white : Colors.slateDark} />
              <Text style={[styles.dayText, selected && styles.dayTextActive]}>
                {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Select Time Slot</Text>
      <View style={styles.slotsGrid}>
        {TIME_SLOTS.map((slot) => {
          const active = slot === selectedSlot;
          return (
            <TouchableOpacity
              key={slot}
              style={[styles.slotChip, active && styles.slotChipActive]}
              onPress={() => setSelectedSlot(slot)}
            >
              <Clock size={14} color={active ? Colors.white : Colors.slateDark} />
              <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Service Address</Text>
      <View style={styles.inputBox}>
        <MapPin size={18} color={Colors.primary} />
        <TextInput
          style={styles.input}
          value={addressLine}
          onChangeText={setAddressLine}
          placeholder="Street / Sector / Landmark"
          placeholderTextColor={Colors.slateMuted}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.disabledBtn]}
        onPress={handleConfirmAssessment}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.primaryBtnText}>Confirm Free Assessment</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  banner: {
    flexDirection: 'row',
    backgroundColor: Colors.mint,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  bannerBody: { flex: 1 },
  bannerTitle: { fontWeight: '700', color: Colors.mintDark, fontSize: 15 },
  bannerSub: { ...Typography.caption, color: Colors.mintDark, marginTop: 2 },
  label: { ...Typography.h3, fontSize: 14, marginBottom: Spacing.sm },
  petRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  petChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  petChipActive: { backgroundColor: Colors.slateDark, borderColor: Colors.slateDark },
  petChipText: { fontWeight: '700', color: Colors.slateDark, fontSize: 13 },
  petChipTextActive: { color: Colors.white },
  dayRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  dayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
  },
  dayBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontWeight: '700', color: Colors.slateDark, fontSize: 12 },
  dayTextActive: { color: Colors.white },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  slotChip: {
    width: '48.5%',
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
  slotChipActive: { backgroundColor: Colors.slateDark, borderColor: Colors.slateDark },
  slotText: { fontWeight: '700', color: Colors.slateDark, fontSize: 12 },
  slotTextActive: { color: Colors.white },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: 8,
    marginBottom: Spacing.lg,
  },
  input: { flex: 1, color: Colors.slateDark, fontSize: 14 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.7 },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});