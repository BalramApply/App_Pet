import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { Colors, Radii, Spacing, Typography } from '../theme/theme';
import { useBookingStore } from '../store/useBookingStore';

interface CancellationModalProps {
  visible: boolean;
  bookingId: string;
  onClose: () => void;
  onCancelled: () => void;
}

export const CancellationModal: React.FC<CancellationModalProps> = ({
  visible,
  bookingId,
  onClose,
  onCancelled,
}) => {
  const { cancelBooking } = useBookingStore();
  const [reason, setReason] = useState('');
  const [noShowType, setNoShowType] = useState<'none' | 'customer_no_show' | 'professional_no_show'>('none');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmCancel = async () => {
    setSubmitting(true);
    try {
      await cancelBooking(bookingId, reason.trim() || 'Cancelled by user', noShowType);
      Alert.alert('Booking Cancelled', 'Booking status and session schedule have been updated.');
      setReason('');
      onCancelled();
      onClose();
    } catch (err: any) {
      Alert.alert(
        'Cancellation Failed',
        err?.response?.data?.message || 'Unable to cancel booking.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <AlertTriangle size={20} color={Colors.danger} />
              <Text style={styles.title}>Cancel Booking</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.slateMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.policyNote}>
            Cancellations within 6 hours of scheduled time may incur a 20% cancellation fee on remaining unsettled session value. Professional no-shows unlock make-up session eligibility.
          </Text>

          <Text style={styles.label}>Scenario / No-Show Status</Text>
          <View style={styles.pillRow}>
            {(
              [
                { id: 'none', label: 'Standard Cancel' },
                { id: 'customer_no_show', label: 'Client No-Show' },
                { id: 'professional_no_show', label: 'Pro No-Show' },
              ] as const
            ).map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.pill, noShowType === opt.id && styles.pillActive]}
                onPress={() => setNoShowType(opt.id)}
              >
                <Text style={[styles.pillText, noShowType === opt.id && styles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Reason / Notes</Text>
          <TextInput
            style={styles.input}
            placeholder="Why are you cancelling?"
            placeholderTextColor={Colors.slateMuted}
            value={reason}
            onChangeText={setReason}
            multiline
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Keep Booking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, submitting && styles.disabledBtn]}
              onPress={handleConfirmCancel}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Cancel</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,30,45,0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...Typography.h2 },
  policyNote: { ...Typography.caption, lineHeight: 17, marginBottom: Spacing.md },
  label: { ...Typography.h3, fontSize: 13, marginBottom: 6 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  pillActive: { backgroundColor: Colors.slateDark, borderColor: Colors.slateDark },
  pillText: { fontSize: 11, fontWeight: '700', color: Colors.slateDark },
  pillTextActive: { color: Colors.white },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: 72,
    color: Colors.slateDark,
    marginBottom: Spacing.md,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontWeight: '700', color: Colors.slateDark },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.danger,
    alignItems: 'center',
  },
  confirmBtnText: { fontWeight: '700', color: Colors.white },
  disabledBtn: { opacity: 0.7 },
});