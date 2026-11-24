import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PhoneCall, ShieldCheck, Send, AlertTriangle } from 'lucide-react-native';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { RootStackParamList } from '../../types/navigation';

const TICKET_TYPES = [
  { id: 'callback_request', label: 'Callback Request' },
  { id: 'reschedule_request', label: 'Reschedule' },
  { id: 'wallet_billing_inquiry', label: 'Wallet / Billing' },
  { id: 'complaint', label: 'Complaint' },
  { id: 'concern_report', label: 'Report a Concern' },
  { id: 'email_inquiry', label: 'Email Support' },
  { id: 'emergency_sos', label: 'Emergency SOS' },
] as const;

export const SupportHubScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, supportContact, fetchSupportContact } = useAuthStore();
  const [selectedType, setSelectedType] =
    useState<(typeof TICKET_TYPES)[number]['id']>('callback_request');
  const [notes, setNotes] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadSupport = useCallback(async () => {
    await fetchSupportContact().catch(() => {});
    try {
      const res = await apiClient.get('/support/tickets');
      setTickets(res.data.data.tickets || []);
    } catch {
      // Handled below
    }
  }, [fetchSupportContact]);

  useFocusEffect(
    useCallback(() => {
      loadSupport();
    }, [loadSupport])
  );

  const handleSubmitTicket = async () => {
    if (!notes.trim()) {
      Alert.alert('Details Required', 'Please describe your request or concern.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post('/support/tickets', {
        type: selectedType,
        notes: notes.trim(),
      });
      setNotes('');
      setTickets((prev) => [res.data.data.ticket, ...prev]);
      Alert.alert('Ticket Submitted', `Reference #${res.data.data.ticket.ticketNumber} created.`);
    } catch (err: any) {
      Alert.alert('Submission Failed', err?.response?.data?.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const rm = user?.profile?.assignedRelationshipManager;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Multi-Channel Support Hub</Text>

      {/* Relationship Manager Card */}
      <View style={styles.rmCard}>
        <View style={styles.rowGap}>
          <PhoneCall size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>Dedicated Relationship Manager</Text>
        </View>
        <Text style={styles.rmName}>
          {rm ? `${rm.name} (${rm.phone})` : 'PetJeeva Priority Relationship Desk'}
        </Text>
        <Text style={styles.meta}>
          Helpline: {supportContact?.supportPhone || '+91-124-400-0100'} • Email:{' '}
          {supportContact?.supportEmail || 'support@petjeeva.com'}
        </Text>
        <Text style={styles.meta}>
          Hours: {supportContact?.supportHours || 'Mon-Sun, 08:00 AM - 10:00 PM IST'}
        </Text>
      </View>

      {/* Create Support Ticket */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Raise a Request or Concern</Text>
        <View style={styles.chipsWrap}>
          {TICKET_TYPES.map((t) => {
            const active = selectedType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.typeChip,
                  active && styles.typeChipActive,
                  t.id === 'emergency_sos' && styles.sosChip,
                ]}
                onPress={() => setSelectedType(t.id)}
              >
                {t.id === 'emergency_sos' && <AlertTriangle size={12} color={Colors.danger} />}
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Enter details for callback, reschedule, wallet inquiry, or concern..."
          placeholderTextColor={Colors.slateMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity
          style={[styles.primaryBtn, submitting && styles.disabledBtn]}
          onPress={handleSubmitTicket}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Send size={16} color={Colors.white} />
              <Text style={styles.primaryBtnText}>Submit Ticket</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Policies */}
      <View style={styles.card}>
        <View style={styles.rowGap}>
          <ShieldCheck size={18} color={Colors.mintDark} />
          <Text style={styles.cardTitle}>Platform Policies</Text>
        </View>
        <Text style={styles.policyLine}>
- Cancellation Policy: Free cancellation up to 6 hours prior; late cancellations may carry a 20% fee on unsettled session value.
        </Text>
        <Text style={styles.policyLine}>
- Wallet &amp; Refund Policy: Internal wallet top-ups are managed by PetJeeva Admin; completed sessions settle atomically per session.
        </Text>
        <Text style={styles.policyLine}>
- Privacy Policy: Sensitive professional verification documents are restricted from public display.
        </Text>
      </View>

      {/* Recent Tickets */}
      <Text style={styles.sectionHeading}>Recent Support Tickets</Text>
      {tickets.map((tk) => {
        const unread =
          tk.lastStaffReplyAt &&
          (!tk.userLastReadAt || new Date(tk.lastStaffReplyAt) > new Date(tk.userLastReadAt));
        return (
          <TouchableOpacity
            key={tk._id}
            style={styles.ticketItem}
            onPress={() => navigation.navigate('TicketThread', { ticketId: tk._id })}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.ticketNum}>#{tk.ticketNumber}</Text>
              <Text style={styles.ticketStatus}>{String(tk.status).toUpperCase()}</Text>
            </View>
            <Text style={styles.ticketType}>
              {String(tk.type).replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text style={styles.meta} numberOfLines={2}>
              {tk.notes}
            </Text>
            <Text style={unread ? styles.newReply : styles.viewThread}>
              {unread ? 'New reply from PetJeeva Support' : 'View conversation'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  title: { ...Typography.h2, marginBottom: Spacing.md },
  rmCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...Typography.h3, fontSize: 15 },
  rmName: { fontWeight: '700', color: Colors.slateDark, fontSize: 14, marginBottom: 4 },
  meta: { ...Typography.caption, marginTop: 2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: Spacing.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  typeChipActive: { backgroundColor: Colors.slateDark, borderColor: Colors.slateDark },
  sosChip: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  typeChipText: { fontSize: 11, fontWeight: '700', color: Colors.slateDark },
  typeChipTextActive: { color: Colors.white },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: 76,
    color: Colors.slateDark,
    marginBottom: Spacing.sm,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  disabledBtn: { opacity: 0.7 },
  policyLine: { ...Typography.caption, lineHeight: 17, marginTop: 4 },
  sectionHeading: { ...Typography.h3, marginBottom: Spacing.sm },
  ticketItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  ticketNum: { fontWeight: '800', color: Colors.slateDark, fontSize: 13 },
  ticketStatus: { fontSize: 11, fontWeight: '800', color: Colors.info },
  ticketType: { fontWeight: '700', color: Colors.primary, fontSize: 12, marginTop: 2 },
  newReply: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 6,
  },
  viewThread: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slateMuted,
    marginTop: 6,
  },
});