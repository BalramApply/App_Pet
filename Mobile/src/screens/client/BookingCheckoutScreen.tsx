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
import { Wallet, CheckCircle2, AlertCircle, MapPin, Calendar, Clock, Repeat } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useWalletStore } from '../../store/useWalletStore';
import { usePetStore } from '../../store/usePetStore';
import { useBookingStore } from '../../store/useBookingStore';
import { useAuthStore } from '../../store/useAuthStore';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingCheckout'>;

const TIME_SLOTS = [
  '07:30 AM - 08:30 AM',
  '10:00 AM - 11:00 AM',
  '04:00 PM - 05:00 PM',
  '06:30 PM - 07:30 PM',
];

export const BookingCheckoutScreen: React.FC<Props> = ({ navigation, route }) => {
  const { packageItem, petId } = route.params;
  const { balance, fetchBalance } = useWalletStore();
  const { pets, activePetId, fetchPets } = usePetStore();
  const { createBooking } = useBookingStore();
  const { user } = useAuthStore();

  const [selectedPetId, setSelectedPetId] = useState<string>(petId || activePetId || '');
  const [dateOffsetDays, setDateOffsetDays] = useState<number>(1);
  const [selectedSlot, setSelectedSlot] = useState<string>(TIME_SLOTS[0]);
  const [isRecurring, setIsRecurring] = useState<boolean>(packageItem.sessionCount > 1);
  const [addressLine, setAddressLine] = useState<string>(
    user?.addresses?.[0]?.line1 || 'Sector 29, Gurugram, Haryana'
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBalance().catch(() => {});
    if (pets.length === 0) {
      fetchPets().catch(() => {});
    }
  }, [fetchBalance, pets.length, fetchPets]);

  useEffect(() => {
    if (!selectedPetId) {
      setSelectedPetId(petId || activePetId || pets[0]?._id || '');
    }
  }, [selectedPetId, petId, activePetId, pets]);

  const currentBalance = Number(balance ?? user?.walletBalance ?? 0);
  const requiredAmount = Number(packageItem.price || 0);
  const hasSufficientBalance = currentBalance >= requiredAmount;
  const perSessionAmount =
    packageItem.sessionCount > 0 ? (requiredAmount / packageItem.sessionCount).toFixed(2) : '0.00';

  const scheduledDateObj = new Date(Date.now() + dateOffsetDays * 24 * 60 * 60 * 1000);

  const handleConfirmBooking = async () => {
    if (!selectedPetId) {
      Alert.alert('Select a Pet', 'Please choose a pet for this booking.');
      return;
    }

    if (!hasSufficientBalance) {
      Alert.alert(
        'Insufficient Internal Wallet Balance',
        `Required: ₹${requiredAmount.toLocaleString('en-IN')}\nAvailable: ₹${currentBalance.toLocaleString(
          'en-IN'
        )}\n\nPlease contact PetJeeva Admin/Support to add wallet balance before confirming this booking.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const booking = await createBooking({
        petId: selectedPetId,
        packageId: packageItem._id,
        scheduledDate: scheduledDateObj.toISOString(),
        timeSlot: selectedSlot,
        isRecurring,
      });
      navigation.replace('BookingConfirmation', { booking });
    } catch (err: any) {
      Alert.alert(
        'Checkout Failed',
        err?.response?.data?.message || 'Unable to confirm booking.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Package & Settlement Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.pkgName}>{packageItem.name}</Text>
        <Text style={styles.pkgMeta}>
          {packageItem.sessionCount} {packageItem.sessionCount === 1 ? 'Session' : 'Sessions'} •{' '}
          {packageItem.sessionDuration} mins per session
        </Text>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Package Total</Text>
          <Text style={styles.rowValue}>₹{requiredAmount.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Per-Session Settlement</Text>
          <Text style={styles.rowSubValue}>₹{perSessionAmount} / session on completion</Text>
        </View>
      </View>

      {/* Internal Wallet Balance Check */}
      <View
        style={[
          styles.walletCard,
          hasSufficientBalance ? styles.walletOk : styles.walletInsufficient,
        ]}
      >
        <View style={styles.walletHeader}>
          <Wallet
            size={20}
            color={hasSufficientBalance ? Colors.mintDark : Colors.danger}
          />
          <Text
            style={[
              styles.walletTitle,
              { color: hasSufficientBalance ? Colors.mintDark : Colors.danger },
            ]}
          >
            Internal Wallet Balance: ₹{currentBalance.toLocaleString('en-IN')}
          </Text>
        </View>

        {hasSufficientBalance ? (
          <View style={styles.statusRow}>
            <CheckCircle2 size={15} color={Colors.mintDark} />
            <Text style={styles.walletOkText}>
              Sufficient balance available. Amount is deducted atomically per completed session.
            </Text>
          </View>
        ) : (
          <View style={styles.statusRow}>
            <AlertCircle size={15} color={Colors.danger} />
            <Text style={styles.walletErrText}>
              Shortfall of ₹{(requiredAmount - currentBalance).toLocaleString('en-IN')}. Contact
              Admin/Support for wallet top-up.
            </Text>
          </View>
        )}
      </View>

      {/* Pet Selection */}
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

      {/* Date Selection */}
      <Text style={styles.label}>Start Date</Text>
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

      {/* Time Slot */}
      <Text style={styles.label}>Preferred Time Slot</Text>
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

      {/* Recurring Toggle */}
      {packageItem.sessionCount > 1 && (
        <TouchableOpacity
          style={styles.recurringRow}
          onPress={() => setIsRecurring((prev) => !prev)}
        >
          <Repeat size={18} color={Colors.primary} />
          <Text style={styles.recurringText}>
            Recurring Daily Cadence ({isRecurring ? 'Enabled' : 'Manual Scheduling'})
          </Text>
        </TouchableOpacity>
      )}

      {/* Address */}
      <Text style={styles.label}>Service Address</Text>
      <View style={styles.inputBox}>
        <MapPin size={18} color={Colors.primary} />
        <TextInput
          style={styles.input}
          value={addressLine}
          onChangeText={setAddressLine}
          placeholder="Address"
          placeholderTextColor={Colors.slateMuted}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (!hasSufficientBalance || submitting) && styles.disabledBtn,
        ]}
        onPress={handleConfirmBooking}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.primaryBtnText}>
            {hasSufficientBalance
              ? 'Confirm Booking with Wallet'
              : 'Insufficient Wallet Balance'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  pkgName: { ...Typography.h2, fontSize: 18 },
  pkgMeta: { ...Typography.caption, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rowLabel: { ...Typography.body, fontWeight: '600' },
  rowValue: { fontSize: 18, fontWeight: '800', color: Colors.slateDark },
  rowSubValue: { ...Typography.caption, color: Colors.mintDark, fontWeight: '700' },
  walletCard: {
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  walletOk: { backgroundColor: Colors.mint, borderColor: '#C8E6C9' },
  walletInsufficient: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  walletHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  walletTitle: { fontWeight: '800', fontSize: 15 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  walletOkText: { flex: 1, fontSize: 12, color: Colors.mintDark, fontWeight: '600' },
  walletErrText: { flex: 1, fontSize: 12, color: Colors.danger, fontWeight: '600' },
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
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    marginBottom: Spacing.md,
  },
  recurringText: { fontWeight: '700', color: Colors.slateDark, fontSize: 13 },
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
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});