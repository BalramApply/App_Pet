import React, { useState } from 'react';
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
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { Address } from '../../types/models';

const emptyForm: Address = {
  label: 'Home',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  coordinates: { lat: null, lng: null },
  isDefault: true,
};

export const AddressEditScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const addresses = user?.addresses ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Address>(emptyForm);
  const [saving, setSaving] = useState(false);

  const syncAddresses = (nextAddresses: Address[]) => {
    const current = useAuthStore.getState().user;
    if (current) {
      useAuthStore.setState({ user: { ...current, addresses: nextAddresses } });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (
      !form.line1.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !form.pincode.trim()
    ) {
      Alert.alert(
        'Missing Fields',
        'Please enter Address Line 1, City, State, and Pincode.'
      );
      return;
    }

    setSaving(true);
    try {
      const payload: Address = {
        label: form.label.trim() || 'Home',
        line1: form.line1.trim(),
        line2: form.line2?.trim() || '',
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        coordinates: form.coordinates ?? { lat: null, lng: null },
        isDefault: Boolean(form.isDefault),
      };

      const res = editingId
        ? await apiClient.put(`/users/me/addresses/${editingId}`, payload)
        : await apiClient.post('/users/me/addresses', payload);

      const updatedList: Address[] = res.data?.data?.addresses ?? [];
      syncAddresses(updatedList);
      resetForm();
      Alert.alert(
        'Saved',
        res.data?.message || (editingId ? 'Address updated.' : 'Address added.')
      );
    } catch (err: any) {
      Alert.alert(
        'Save Failed',
        err?.response?.data?.message || 'Could not save address.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addr: Address) => {
    setEditingId(addr._id || null);
    setForm({
      _id: addr._id,
      label: addr.label || 'Home',
      line1: addr.line1 || '',
      line2: addr.line2 || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      coordinates: addr.coordinates ?? { lat: null, lng: null },
      isDefault: Boolean(addr.isDefault),
    });
  };

  const handleDelete = (addr: Address) => {
    if (!addr._id) return;
    Alert.alert('Remove Address', `Delete "${addr.label}" address?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const res = await apiClient.delete(`/users/me/addresses/${addr._id}`);
            const nextList: Address[] =
              res.data?.data?.addresses ??
              addresses.filter((item) => item._id !== addr._id);
            syncAddresses(nextList);
            if (editingId === addr._id) {
              resetForm();
            }
          } catch (err: any) {
            Alert.alert(
              'Delete Failed',
              err?.response?.data?.message || 'Could not remove address.'
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
          {editingId ? 'Edit Address' : 'Add New Address'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Label (e.g., Home, Office)"
          placeholderTextColor={Colors.slateMuted}
          value={form.label}
          onChangeText={(v) => setForm((prev) => ({ ...prev, label: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Address Line 1 *"
          placeholderTextColor={Colors.slateMuted}
          value={form.line1}
          onChangeText={(v) => setForm((prev) => ({ ...prev, line1: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Address Line 2 (Optional)"
          placeholderTextColor={Colors.slateMuted}
          value={form.line2 || ''}
          onChangeText={(v) => setForm((prev) => ({ ...prev, line2: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="City *"
          placeholderTextColor={Colors.slateMuted}
          value={form.city}
          onChangeText={(v) => setForm((prev) => ({ ...prev, city: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="State *"
          placeholderTextColor={Colors.slateMuted}
          value={form.state}
          onChangeText={(v) => setForm((prev) => ({ ...prev, state: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Pincode *"
          placeholderTextColor={Colors.slateMuted}
          keyboardType="numeric"
          value={form.pincode}
          onChangeText={(v) => setForm((prev) => ({ ...prev, pincode: v }))}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Set as Default Address</Text>
          <Switch
            value={Boolean(form.isDefault)}
            onValueChange={(v) => setForm((prev) => ({ ...prev, isDefault: v }))}
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
                {editingId ? 'Update Address' : 'Save Address'}
              </Text>
            )}
          </TouchableOpacity>

          {editingId ? (
            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Saved Addresses ({addresses.length})
        </Text>
        {addresses.length === 0 ? (
          <Text style={styles.meta}>No addresses saved yet.</Text>
        ) : (
          addresses.map((addr, idx) => (
            <View key={addr._id || `${addr.label}-${idx}`} style={styles.addrRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.addrLabel}>
                  {addr.label} {addr.isDefault ? '• Default' : ''}
                </Text>
                <Text style={styles.meta}>
                  {addr.line1}
                  {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} -{' '}
                  {addr.pincode}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editChip}
                onPress={() => handleEdit(addr)}
              >
                <Text style={styles.editChipText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.delChip}
                onPress={() => handleDelete(addr)}
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
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    gap: 8,
  },
  addrLabel: { fontWeight: '700', fontSize: 14, color: Colors.slateDark },
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