import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ShieldCheck, Star, Award, MapPin } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useProfessionalStore } from '../../store/useProfessionalStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfessionalProfile'>;

export const ProfessionalProfileScreen: React.FC<Props> = ({ route }) => {
  const { professionalId } = route.params;
  const { selectedProfessional, selectedReviews, isLoading, fetchProfessionalById } =
    useProfessionalStore();

  useEffect(() => {
    fetchProfessionalById(professionalId).catch(() => {});
  }, [professionalId, fetchProfessionalById]);

  if (isLoading && !selectedProfessional) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!selectedProfessional) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Professional profile not found.</Text>
      </View>
    );
  }

  const pro = selectedProfessional;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.name}>{pro.user?.name || 'PetJeeva Specialist'}</Text>
            <Text style={styles.role}>
              {String(pro.professionalRole).replace(/_/g, ' ').toUpperCase()} • {pro.experienceYears}{' '}
              yrs exp
            </Text>
          </View>
          <View style={styles.verBadge}>
            <ShieldCheck size={14} color={Colors.mintDark} />
            <Text style={styles.verText}>{String(pro.verificationStatus).toUpperCase()}</Text>
          </View>
        </View>

        {pro.bio ? <Text style={styles.bio}>{pro.bio}</Text> : null}

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Star size={16} color={Colors.warning} fill={Colors.warning} />
            <Text style={styles.statVal}>{pro.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLbl}>Rating ({pro.totalEligibleReviews})</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{pro.totalCompletedSessions}</Text>
            <Text style={styles.statLbl}>Completed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{pro.completionPercentage}%</Text>
            <Text style={styles.statLbl}>Completion</Text>
          </View>
        </View>
      </View>

      {/* Specializations & Credentials */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Specializations &amp; Verified Credentials</Text>
        {pro.specializations?.length > 0 && (
          <Text style={styles.meta}>Specializations: {pro.specializations.join(' • ')}</Text>
        )}
        {pro.credentials?.map((c, idx) => (
          <View key={idx} style={styles.credRow}>
            <Award size={15} color={Colors.info} />
            <Text style={styles.credText}>
              {c.title} — {c.issuingBody}
            </Text>
          </View>
        ))}
        {pro.serviceAreas?.length > 0 && (
          <View style={styles.areaRow}>
            <MapPin size={15} color={Colors.primary} />
            <Text style={styles.credText}>
              Areas: {pro.serviceAreas.map((a) => a.city).join(', ')}
            </Text>
          </View>
        )}
      </View>

      {/* Recent Customer Reviews */}
      <Text style={styles.sectionTitle}>Recent Customer Reviews</Text>
      {selectedReviews.length > 0 ? (
        selectedReviews.map((rev) => (
          <View key={rev._id} style={styles.card}>
            <View style={styles.revTop}>
              <Text style={styles.revAuthor}>{rev.customer?.name || 'Pet Parent'}</Text>
              <Text style={styles.revRating}>★ {rev.rating}/5</Text>
            </View>
            {rev.reviewText ? <Text style={styles.bio}>{rev.reviewText}</Text> : null}
          </View>
        ))
      ) : (
        <Text style={styles.muted}>No published reviews yet.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...Typography.caption },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { ...Typography.h2 },
  role: { ...Typography.caption, marginTop: 2 },
  verBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.mint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    gap: 4,
  },
  verText: { fontSize: 11, fontWeight: '800', color: Colors.mintDark },
  bio: { ...Typography.body, color: Colors.slateMuted, lineHeight: 20, marginTop: Spacing.sm },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  statVal: { fontWeight: '800', fontSize: 16, color: Colors.slateDark, marginTop: 2 },
  statLbl: { ...Typography.caption, fontSize: 10, marginTop: 2 },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  meta: { ...Typography.caption, marginBottom: 8 },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  credText: { flex: 1, fontSize: 13, color: Colors.slateDark, fontWeight: '600' },
  revTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revAuthor: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  revRating: { fontWeight: '800', color: Colors.warning, fontSize: 14 },
});