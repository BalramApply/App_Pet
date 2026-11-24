import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Syringe, FileText, Plus, Award, CalendarClock } from 'lucide-react-native';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { usePetStore } from '../../store/usePetStore';
import { apiClient } from '../../api/client';
import { SessionItem, VaccinationRecordItem } from '../../types/models';
import { RootStackParamList } from '../../types/navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const HealthVaultScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { pets, activePetId, fetchPets, setActivePetId } = usePetStore();

  const [vaccinations, setVaccinations] = useState<VaccinationRecordItem[]>([]);
  const [completedSessions, setCompletedSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [vaccineName, setVaccineName] = useState('');
  const [doseNumber, setDoseNumber] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedPet = pets.find((p) => p._id === activePetId) || pets[0] || null;

  const loadVault = useCallback(async () => {
    if (pets.length === 0) {
      await fetchPets().catch(() => {});
    }
    const targetPet =
      usePetStore.getState().pets.find((p) => p._id === usePetStore.getState().activePetId) ||
      usePetStore.getState().pets[0];

    if (!targetPet) {
      setVaccinations([]);
      setCompletedSessions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.get(`/pets/${targetPet._id}/health-records`);
      setVaccinations(res.data.data.vaccinations || []);
      setCompletedSessions(res.data.data.completedSessions || []);
    } catch {
      // Handled by empty states
    } finally {
      setLoading(false);
    }
  }, [pets.length, fetchPets]);

  useFocusEffect(
    useCallback(() => {
      loadVault();
    }, [loadVault])
  );

  const handleAddVaccination = async () => {
    if (!selectedPet) {
      Alert.alert('Select Pet', 'Please select or create a pet first.');
      return;
    }
    if (!vaccineName.trim()) {
      Alert.alert('Vaccine Required', 'Please enter the vaccine name (e.g., Anti-Rabies, 7-in-1).');
      return;
    }

    setSaving(true);
    try {
      const adminDate = new Date();
      const nextDue = new Date(adminDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      await apiClient.post('/vaccinations', {
        petId: selectedPet._id,
        vaccineName: vaccineName.trim(),
        doseNumber: Number(doseNumber) || 1,
        administeredDate: adminDate.toISOString(),
        nextDueDate: nextDue.toISOString(),
        clinicOrHomeNotes: notes.trim(),
      });
      setVaccineName('');
      setDoseNumber('1');
      setNotes('');
      setModalVisible(false);
      await loadVault();
      Alert.alert('Saved', 'Vaccination record & booster reminder added to Pet Progress Vault.');
    } catch (err: any) {
      Alert.alert('Save Failed', err?.response?.data?.message || 'Unable to log vaccination.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadVault} tintColor={Colors.primary} />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Reports &amp; Progress Vault</Text>
        {selectedPet && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Plus size={15} color={Colors.white} />
            <Text style={styles.addBtnText}>Log Vaccine</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pet Selector */}
      {pets.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petChips}>
          {pets.map((p) => {
            const active = selectedPet?._id === p._id;
            return (
              <TouchableOpacity
                key={p._id}
                style={[styles.petChip, active && styles.petChipActive]}
                onPress={async () => {
                  setActivePetId(p._id);
                  setLoading(true);
                  try {
                    const res = await apiClient.get(`/pets/${p._id}/health-records`);
                    setVaccinations(res.data.data.vaccinations || []);
                    setCompletedSessions(res.data.data.completedSessions || []);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={[styles.petChipText, active && styles.petChipTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Vaccination Records & Booster Reminders */}
      <Text style={styles.sectionHeading}>Vaccination Records &amp; Boosters</Text>
      {vaccinations.length > 0 ? (
        vaccinations.map((v) => (
          <View key={v._id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.rowGap}>
                <Syringe size={18} color={Colors.primary} />
                <Text style={styles.cardTitle}>
                  {v.vaccineName} (Dose #{v.doseNumber})
                </Text>
              </View>
              {v.certificateUrl ? (
                <View style={styles.certBadge}>
                  <Award size={12} color={Colors.mintDark} />
                  <Text style={styles.certText}>Certificate</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.meta}>
              Administered: {new Date(v.administeredDate).toDateString()}
            </Text>
            {v.nextDueDate && (
              <View style={styles.boosterRow}>
                <CalendarClock size={14} color={Colors.warning} />
                <Text style={styles.boosterText}>
                  Next Booster Due: {new Date(v.nextDueDate).toDateString()}
                </Text>
              </View>
            )}
          </View>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No vaccination records logged for this pet yet.</Text>
        </View>
      )}

      {/* Completed Sessions & Progress Timeline */}
      <Text style={styles.sectionHeading}>Completed Sessions &amp; Progress Timeline</Text>
      {completedSessions.length > 0 ? (
        completedSessions.map((s) => {
          const svcType =
            typeof s.booking === 'object' && s.booking && 'service' in s.booking
              ? (s.booking as any).service?.type
              : 'Session';
          return (
            <TouchableOpacity
              key={s._id}
              style={styles.card}
              onPress={() => navigation.navigate('SessionReport', { sessionId: s._id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.rowGap}>
                  <FileText size={18} color={Colors.mintDark} />
                  <Text style={styles.cardTitle}>
                    {svcType} • Session #{s.sessionNumber}
                  </Text>
                </View>
                {s.behaviorScores?.overallProgressScore != null && (
                  <Text style={styles.scorePill}>
                    Score: {s.behaviorScores.overallProgressScore}/100
                  </Text>
                )}
              </View>
              <Text style={styles.meta} numberOfLines={2}>
                {s.reportNotes || s.completionNotes || 'Completed session report available.'}
              </Text>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Completed session reports will appear here.</Text>
        </View>
      )}

      {/* Log Vaccination Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log Vaccination Record</Text>
            <TextInput
              style={styles.input}
              placeholder="Vaccine Name (e.g. Anti-Rabies, 7-in-1, 9-in-1)"
              placeholderTextColor={Colors.slateMuted}
              value={vaccineName}
              onChangeText={setVaccineName}
            />
            <TextInput
              style={styles.input}
              placeholder="Dose Number (e.g. 1)"
              placeholderTextColor={Colors.slateMuted}
              keyboardType="number-pad"
              value={doseNumber}
              onChangeText={setDoseNumber}
            />
            <TextInput
              style={styles.input}
              placeholder="Clinic / Vet Notes (optional)"
              placeholderTextColor={Colors.slateMuted}
              value={notes}
              onChangeText={setNotes}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddVaccination}
                disabled={saving}
              >
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Record'}</Text>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: { ...Typography.h2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    gap: 5,
  },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  petChips: { marginBottom: Spacing.md },
  petChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  petChipActive: { backgroundColor: Colors.slateDark, borderColor: Colors.slateDark },
  petChipText: { fontWeight: '700', color: Colors.slateDark, fontSize: 13 },
  petChipTextActive: { color: Colors.white },
  sectionHeading: { ...Typography.h3, marginBottom: Spacing.sm, marginTop: 4 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardTitle: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.mint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    gap: 4,
  },
  certText: { fontSize: 11, fontWeight: '700', color: Colors.mintDark },
  meta: { ...Typography.caption, marginTop: 2 },
  boosterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  boosterText: { fontSize: 12, fontWeight: '700', color: Colors.warning },
  scorePill: {
    backgroundColor: Colors.mint,
    color: Colors.mintDark,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  emptyText: { ...Typography.caption, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,30,45,0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: { backgroundColor: Colors.surface, borderRadius: Radii.lg, padding: Spacing.lg },
  modalTitle: { ...Typography.h2, marginBottom: Spacing.md },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 46,
    marginBottom: Spacing.md,
    color: Colors.slateDark,
  },
  modalActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { fontWeight: '700', color: Colors.slateDark },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveText: { fontWeight: '700', color: Colors.white },
});