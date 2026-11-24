import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Award, CheckCircle2, Star } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useProfessionalStore } from '../../store/useProfessionalStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceDetail'>;

const TYPE_TO_ROLE: Record<string, string> = {
  Training: 'trainer',
  Walking: 'walker',
  Grooming: 'groomer',
  Vaccination: 'vet',
};

export const ServiceDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { service, packages, species } = route.params;
  const { professionals, fetchProfessionals } = useProfessionalStore();

  useEffect(() => {
    fetchProfessionals(TYPE_TO_ROLE[service.type]).catch(() => {});
  }, [service.type, fetchProfessionals]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{service.title}</Text>
      <Text style={styles.meta}>
        Service Type: {service.type} • Standard Duration: {service.sessionDuration} mins
      </Text>
      <Text style={styles.desc}>{service.description}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Program Syllabus & Inclusions</Text>
        {service.syllabusOrInclusions?.map((item, idx) => (
          <View key={idx} style={styles.bulletRow}>
            <CheckCircle2 size={15} color={Colors.mintDark} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Verified {service.type} Professionals</Text>
        {professionals.length > 0 ? (
          professionals.map((pro) => (
            <TouchableOpacity
              key={pro._id}
              style={styles.proRow}
              onPress={() =>
                navigation.navigate('ProfessionalProfile', {
                  professionalId: pro.user?._id || pro._id,
                })
              }
            >
              <View style={styles.proInfo}>
                <Text style={styles.proName}>{pro.user?.name || 'PetJeeva Specialist'}</Text>
                <Text style={styles.proMeta}>
                  {pro.experienceYears} yrs exp • {pro.completionPercentage}% completion
                </Text>
              </View>
              <View style={styles.ratingPill}>
                <Star size={13} color={Colors.warning} fill={Colors.warning} />
                <Text style={styles.ratingText}>{pro.averageRating.toFixed(1)}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.credNote}>
            <Award size={16} color={Colors.info} />
            <Text style={styles.credNoteText}>
              All PetJeeva professionals undergo background & credential verification before
              assignment.
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.cardTitle}>Available Packages ({packages.length})</Text>
      {packages.map((pkg) => (
        <TouchableOpacity
          key={pkg._id}
          style={styles.pkgItem}
          onPress={() =>
            navigation.navigate(pkg.freeDemoEligible ? 'AssessmentBooking' : 'BookingCheckout', {
              packageItem: pkg,
              serviceItem: service,
              species,
            } as any)
          }
        >
          <View>
            <Text style={styles.pkgName}>{pkg.name}</Text>
            <Text style={styles.pkgSub}>
              {pkg.sessionCount} sessions • {pkg.sessionDuration} mins
            </Text>
          </View>
          <Text style={styles.pkgPrice}>
            {pkg.price === 0 ? 'FREE' : `₹${pkg.price.toLocaleString('en-IN')}`}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  title: { ...Typography.h1, marginBottom: 4 },
  meta: { ...Typography.caption, marginBottom: Spacing.sm },
  desc: { ...Typography.body, color: Colors.slateMuted, lineHeight: 21, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  cardTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  bulletText: { flex: 1, ...Typography.body, fontSize: 13 },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  proInfo: { flex: 1 },
  proName: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  proMeta: { ...Typography.caption, marginTop: 2 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    gap: 4,
  },
  ratingText: { fontWeight: '800', fontSize: 12, color: Colors.slateDark },
  credNote: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  credNoteText: { flex: 1, ...Typography.caption },
  pkgItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  pkgName: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  pkgSub: { ...Typography.caption, marginTop: 2 },
  pkgPrice: { fontWeight: '800', color: Colors.primary, fontSize: 15 },
});