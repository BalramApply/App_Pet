import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Calendar, UserCheck, PawPrint } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingConfirmation'>;

export const BookingConfirmationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { booking } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <CheckCircle2 size={42} color={Colors.mintDark} />
        </View>
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.sub}>
          Your sessions are scheduled and a PetJeeva professional has been assigned.
        </Text>

        <View style={styles.detailBox}>
          <View style={styles.detailRow}>
            <PawPrint size={16} color={Colors.primary} />
            <Text style={styles.detailText}>
              Pet: {booking.pet?.name || 'Pet'} • {booking.service?.type || 'Service'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Calendar size={16} color={Colors.primary} />
            <Text style={styles.detailText}>
              {new Date(booking.scheduledDate).toDateString()} ({booking.timeSlot})
            </Text>
          </View>
          <View style={styles.detailRow}>
            <UserCheck size={16} color={Colors.primary} />
            <Text style={styles.detailText}>
              Assigned Pro: {booking.assignedProfessional?.name || 'PetJeeva Specialist'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.replace('BookingDetail', { bookingId: booking._id })}
        >
          <Text style={styles.primaryBtnText}>View Booking & Sessions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' } as any)}
        >
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { ...Typography.h1, textAlign: 'center' },
  sub: {
    ...Typography.body,
    color: Colors.slateMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: Spacing.lg,
  },
  detailBox: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 10,
    marginBottom: Spacing.lg,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { fontWeight: '600', color: Colors.slateDark, fontSize: 13 },
  primaryBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: { paddingVertical: 10 },
  secondaryBtnText: { color: Colors.slateMuted, fontWeight: '700', fontSize: 14 },
});