import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { usePetStore } from '../../store/usePetStore';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { Pet } from '../../types/models';

interface PetFormState {
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  ageYears: string;
  ageMonths: string;
  lifeStage: 'puppy_kitten' | 'adult' | 'senior';
  gender: 'male' | 'female';
  weightKg: string;
  neuteredOrSpayed: boolean;
  vetClinicName: string;
  notes: string;
  temperament: string;
}

const emptyPetForm: PetFormState = {
  name: '',
  species: 'dog',
  breed: '',
  ageYears: '1',
  ageMonths: '0',
  lifeStage: 'adult',
  gender: 'male',
  weightKg: '',
  neuteredOrSpayed: false,
  vetClinicName: '',
  notes: '',
  temperament: '',
};

export const PetEditScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isPetParent = user?.role === 'pet_parent';

  const pets = usePetStore((s) => s.pets);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [form, setForm] = useState<PetFormState>(emptyPetForm);

  const syncPets = (nextPets: Pet[]) => {
    usePetStore.setState({ pets: nextPets });
  };

  const fetchPets = async () => {
    if (!isPetParent) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/pets');
      syncPets(res.data?.data?.pets ?? []);
    } catch (err: any) {
      Alert.alert(
        'Load Failed',
        err?.response?.data?.message || 'Unable to load pets.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPets();
  }, [isPetParent]);

  if (!isPetParent) {
    return (
      <View style={styles.blockedContainer}>
        <Text style={styles.sectionTitle}>Access Restricted</Text>
        <Text style={styles.meta}>
          Only Pet Parent accounts can add or edit pet profiles.
        </Text>
      </View>
    );
  }

  const resetForm = () => {
    setEditingPetId(null);
    setForm(emptyPetForm);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.breed.trim()) {
      Alert.alert(
        'Missing Fields',
        'Pet name, species, breed, and gender are required.'
      );
      return;
    }

    setSaving(true);
    try {
      const parsedWeight =
        form.weightKg.trim() === '' ? null : Number(form.weightKg);

      const payload = {
        name: form.name.trim(),
        species: form.species,
        breed: form.breed.trim(),
        age: {
          years: Math.max(0, Number(form.ageYears) || 0),
          months: Math.max(0, Number(form.ageMonths) || 0),
          lifeStage: form.lifeStage,
        },
        gender: form.gender,
        weightKg: Number.isNaN(parsedWeight) ? null : parsedWeight,
        neuteredOrSpayed: Boolean(form.neuteredOrSpayed),
        medicalHistory: {
          vetClinicName: form.vetClinicName.trim(),
          notes: form.notes.trim(),
        },
        behaviourSummary: {
          temperament: form.temperament.trim(),
        },
      };

      if (editingPetId) {
        const res = await apiClient.put(`/pets/${editingPetId}`, payload);
        const updatedPet: Pet = res.data.data.pet;
        syncPets(pets.map((p) => (p._id === editingPetId ? updatedPet : p)));
        Alert.alert('Saved', res.data?.message || 'Pet profile updated.');
      } else {
        const res = await apiClient.post('/pets', { ...payload, photos: [] });
        const createdPet: Pet = res.data.data.pet;
        syncPets([createdPet, ...pets]);
        Alert.alert('Saved', res.data?.message || 'Pet profile created.');
      }

      resetForm();
    } catch (err: any) {
      Alert.alert(
        'Save Failed',
        err?.response?.data?.message || 'Could not save pet profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (pet: Pet) => {
    setEditingPetId(pet._id);
    setForm({
      name: pet.name || '',
      species: pet.species === 'cat' ? 'cat' : 'dog',
      breed: pet.breed || '',
      ageYears: String(pet.age?.years ?? 0),
      ageMonths: String(pet.age?.months ?? 0),
      lifeStage: pet.age?.lifeStage || 'adult',
      gender: pet.gender === 'female' ? 'female' : 'male',
      weightKg:
        pet.weightKg === null || pet.weightKg === undefined
          ? ''
          : String(pet.weightKg),
      neuteredOrSpayed: Boolean(pet.neuteredOrSpayed),
      vetClinicName: pet.medicalHistory?.vetClinicName || '',
      notes: pet.medicalHistory?.notes || '',
      temperament: pet.behaviourSummary?.temperament || '',
    });
  };

  const handleDelete = (pet: Pet) => {
    Alert.alert('Remove Pet', `Remove "${pet.name}" from your profile?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await apiClient.delete(`/pets/${pet._id}`);
            syncPets(pets.filter((p) => p._id !== pet._id));
            if (editingPetId === pet._id) {
              resetForm();
            }
          } catch (err: any) {
            Alert.alert(
              'Delete Failed',
              err?.response?.data?.message || 'Could not remove pet.'
            );
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {editingPetId ? 'Edit Pet Profile' : 'Add New Pet'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Pet Name *"
          placeholderTextColor={Colors.slateMuted}
          value={form.name}
          onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
        />

        {/* Species Selector */}
        <View style={styles.pillRow}>
          {(['dog', 'cat'] as const).map((sp) => (
            <TouchableOpacity
              key={sp}
              style={[styles.pill, form.species === sp && styles.pillActive]}
              onPress={() => setForm((p) => ({ ...p, species: sp }))}
            >
              <Text
                style={[
                  styles.pillText,
                  form.species === sp && styles.pillTextActive,
                ]}
              >
                {sp.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Breed *"
          placeholderTextColor={Colors.slateMuted}
          value={form.breed}
          onChangeText={(v) => setForm((p) => ({ ...p, breed: v }))}
        />

        {/* Gender Selector */}
        <View style={styles.pillRow}>
          {(['male', 'female'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.pill, form.gender === g && styles.pillActive]}
              onPress={() => setForm((p) => ({ ...p, gender: g }))}
            >
              <Text
                style={[
                  styles.pillText,
                  form.gender === g && styles.pillTextActive,
                ]}
              >
                {g.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Age Years & Months */}
        <View style={styles.pillRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Age (Years)"
            placeholderTextColor={Colors.slateMuted}
            keyboardType="numeric"
            value={form.ageYears}
            onChangeText={(v) => setForm((p) => ({ ...p, ageYears: v }))}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Age (Months)"
            placeholderTextColor={Colors.slateMuted}
            keyboardType="numeric"
            value={form.ageMonths}
            onChangeText={(v) => setForm((p) => ({ ...p, ageMonths: v }))}
          />
        </View>

        {/* Life Stage */}
        <View style={styles.pillRow}>
          {(
            [
              { key: 'puppy_kitten', label: 'Puppy/Kitten' },
              { key: 'adult', label: 'Adult' },
              { key: 'senior', label: 'Senior' },
            ] as const
          ).map((stage) => (
            <TouchableOpacity
              key={stage.key}
              style={[
                styles.pill,
                form.lifeStage === stage.key && styles.pillActive,
              ]}
              onPress={() => setForm((p) => ({ ...p, lifeStage: stage.key }))}
            >
              <Text
                style={[
                  styles.pillText,
                  form.lifeStage === stage.key && styles.pillTextActive,
                ]}
              >
                {stage.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Weight (kg)"
          placeholderTextColor={Colors.slateMuted}
          keyboardType="numeric"
          value={form.weightKg}
          onChangeText={(v) => setForm((p) => ({ ...p, weightKg: v }))}
        />

        <TextInput
          style={styles.input}
          placeholder="Temperament (e.g., Friendly, Energetic)"
          placeholderTextColor={Colors.slateMuted}
          value={form.temperament}
          onChangeText={(v) => setForm((p) => ({ ...p, temperament: v }))}
        />

        <TextInput
          style={styles.input}
          placeholder="Vet Clinic Name (Optional)"
          placeholderTextColor={Colors.slateMuted}
          value={form.vetClinicName}
          onChangeText={(v) => setForm((p) => ({ ...p, vetClinicName: v }))}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Neutered / Spayed</Text>
          <Switch
            value={form.neuteredOrSpayed}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, neuteredOrSpayed: v }))
            }
          />
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {editingPetId ? 'Update Pet' : 'Add Pet'}
              </Text>
            )}
          </TouchableOpacity>

          {editingPetId ? (
            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Saved Pets List */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>My Pets ({pets.length})</Text>
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
        ) : pets.length === 0 ? (
          <Text style={styles.meta}>No pets added yet.</Text>
        ) : (
          pets.map((pet) => (
            <View key={pet._id} style={styles.petRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.petName}>
                  {pet.name} ({pet.species})
                </Text>
                <Text style={styles.meta}>
                  {pet.breed} • {pet.gender} • {pet.age?.years ?? 0}y{' '}
                  {pet.age?.months ?? 0}m • {pet.weightKg ?? '-'} kg
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editChip}
                onPress={() => handleEdit(pet)}
              >
                <Text style={styles.editChipText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.delChip}
                onPress={() => handleDelete(pet)}
              >
                <Text style={styles.delChipText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 15,
    color: Colors.slateDark,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
    color: Colors.slateDark,
  },
  pillRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: { fontSize: 12, fontWeight: '700', color: Colors.slateDark },
  pillTextActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radii.md,
  },
  cancelBtnText: { fontWeight: '700', color: Colors.slateDark },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    gap: 8,
  },
  petName: { fontWeight: '700', fontSize: 14, color: Colors.slateDark },
  meta: { ...Typography.caption, marginTop: 2 },
  editChip: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  editChipText: { fontSize: 12, fontWeight: '700', color: Colors.slateDark },
  delChip: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  delChipText: { fontSize: 12, fontWeight: '700', color: Colors.danger },
});