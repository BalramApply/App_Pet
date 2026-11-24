import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Dog, Cat, CheckCircle2, ArrowRight } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useBookingStore } from '../../store/useBookingStore';
import { usePetStore } from '../../store/usePetStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceCatalog'>;

const SERVICE_TYPES: Array<'Training' | 'Walking' | 'Grooming' | 'Vaccination'> = [
  'Training',
  'Walking',
  'Grooming',
  'Vaccination',
];

export const ServiceCatalogScreen: React.FC<Props> = ({ navigation, route }) => {
  const { services, packages, fetchCatalog } = useBookingStore();
  const { activePetId, pets } = usePetStore();

  const activePet = pets.find((p) => p._id === activePetId) || pets[0] || null;
  const [selectedType, setSelectedType] = useState<'Training' | 'Walking' | 'Grooming' | 'Vaccination'>(
    route.params?.initialServiceType || 'Training'
  );
  const [species, setSpecies] = useState<'dog' | 'cat'>(
    route.params?.speciesFilter || activePet?.species || 'dog'
  );

  useEffect(() => {
    if (services.length === 0 || packages.length === 0) {
      fetchCatalog().catch(() => {});
    }
  }, [services.length, packages.length, fetchCatalog]);

  const matchingServices = services.filter(
    (s) => s.type === selectedType && s.targetSpecies.includes(species)
  );
  const serviceIds = new Set(matchingServices.map((s) => s._id));
  const matchingPackages = packages.filter((p) => {
    const svcId = typeof p.service === 'string' ? p.service : p.service._id;
    return serviceIds.has(svcId) && p.species.includes(species);
  });

  const primaryService = matchingServices[0] || services.find((s) => s.type === selectedType);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Dog / Cat Switcher */}
      <Text style={styles.label}>Select Species</Text>
      <View style={styles.speciesRow}>
        <TouchableOpacity
          style={[styles.speciesBtn, species === 'dog' && styles.speciesBtnActive]}
          onPress={() => setSpecies('dog')}
        >
          <Dog size={18} color={species === 'dog' ? Colors.white : Colors.slateDark} />
          <Text style={[styles.speciesText, species === 'dog' && styles.speciesTextActive]}>
            Dog
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.speciesBtn, species === 'cat' && styles.speciesBtnActive]}
          onPress={() => setSpecies('cat')}
        >
          <Cat size={18} color={species === 'cat' ? Colors.white : Colors.slateDark} />
          <Text style={[styles.speciesText, species === 'cat' && styles.speciesTextActive]}>
            Cat
          </Text>
        </TouchableOpacity>
      </View>

      {/* Service Type Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeTabs}>
        {SERVICE_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeChip, selectedType === t && styles.typeChipActive]}
            onPress={() => setSelectedType(t)}
          >
            <Text style={[styles.typeChipText, selectedType === t && styles.typeChipTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Service Overview Card */}
      {primaryService && (
        <View style={styles.overviewCard}>
          <Text style={styles.serviceTitle}>{primaryService.title}</Text>
          <Text style={styles.serviceDesc}>{primaryService.description}</Text>
          <TouchableOpacity
            style={styles.detailLinkBtn}
            onPress={() =>
              navigation.navigate('ServiceDetail', {
                service: primaryService,
                packages: matchingPackages,
                species,
              })
            }
          >
            <Text style={styles.detailLinkText}>View Syllabus, Credentials & Details</Text>
            <ArrowRight size={15} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Packages */}
      <Text style={styles.sectionHeading}>
        {selectedType} Packages for {species === 'dog' ? 'Dogs' : 'Cats'}
      </Text>

      {matchingPackages.map((pkg) => (
        <View key={pkg._id} style={styles.pkgCard}>
          <View style={styles.pkgTopRow}>
            <View style={styles.pkgInfo}>
              <Text style={styles.pkgTag}>{pkg.categoryTag}</Text>
              <Text style={styles.pkgName}>{pkg.name}</Text>
              <Text style={styles.pkgMeta}>
                {pkg.sessionCount} {pkg.sessionCount === 1 ? 'Session' : 'Sessions'} •{' '}
                {pkg.sessionDuration} mins each
              </Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceText}>
                {pkg.price === 0 ? 'FREE' : `₹${pkg.price.toLocaleString('en-IN')}`}
              </Text>
            </View>
          </View>

          {pkg.inclusions?.map((inc, idx) => (
            <View key={idx} style={styles.inclusionRow}>
              <CheckCircle2 size={14} color={Colors.mintDark} />
              <Text style={styles.inclusionText}>{inc}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.selectBtn}
            onPress={() => {
              if (pkg.freeDemoEligible || pkg.price === 0) {
                navigation.navigate('AssessmentBooking', {
                  packageItem: pkg,
                  petId: activePet?._id,
                });
              } else {
                navigation.navigate('BookingCheckout', {
                  packageItem: pkg,
                  serviceItem: primaryService,
                  petId: activePet?._id,
                });
              }
            }}
          >
            <Text style={styles.selectBtnText}>
              {pkg.freeDemoEligible || pkg.price === 0
                ? 'Book Free Assessment / Demo'
                : 'Select Package & Checkout'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  label: { ...Typography.caption, fontWeight: '700', marginBottom: 6 },
  speciesRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  speciesBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 11,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  speciesBtnActive: { backgroundColor: Colors.slateDark, borderColor: Colors.slateDark },
  speciesText: { fontWeight: '700', color: Colors.slateDark },
  speciesTextActive: { color: Colors.white },
  typeTabs: { marginBottom: Spacing.md },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontWeight: '700', color: Colors.slateDark, fontSize: 13 },
  typeChipTextActive: { color: Colors.white },
  overviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  serviceTitle: { ...Typography.h2, marginBottom: 6 },
  serviceDesc: { ...Typography.body, color: Colors.slateMuted, lineHeight: 20 },
  detailLinkBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  detailLinkText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  sectionHeading: { ...Typography.h3, marginBottom: Spacing.sm },
  pkgCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  pkgTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  pkgInfo: { flex: 1, paddingRight: 8 },
  pkgTag: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  pkgName: { fontSize: 16, fontWeight: '700', color: Colors.slateDark, marginTop: 2 },
  pkgMeta: { ...Typography.caption, marginTop: 2 },
  priceBox: {
    backgroundColor: Colors.mint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.md,
    alignSelf: 'flex-start',
  },
  priceText: { fontWeight: '800', color: Colors.mintDark, fontSize: 15 },
  inclusionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  inclusionText: { ...Typography.body, fontSize: 13 },
  selectBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  selectBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});