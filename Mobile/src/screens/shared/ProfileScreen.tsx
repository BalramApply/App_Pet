import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Wallet,
  LogOut,
  Trash2,
  User,
  PawPrint,
  MapPin,
  ChevronRight,
} from 'lucide-react-native';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useWalletStore } from '../../store/useWalletStore';
import { usePetStore } from '../../store/usePetStore';
import { RootStackParamList } from '../../types/navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { user, logout, deleteAccount } = useAuthStore();
  const { balance } = useWalletStore();
  const { pets } = usePetStore();
  const isPetParent = user?.role === 'pet_parent';

  const [pushEnabled, setPushEnabled] = useState(
    user?.profile?.notificationPreferences?.pushEnabled ?? true
  );
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of PetJeeva?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account Permanently?',
      'This will deactivate your PetJeeva account and revoke active sessions in compliance with Play Store account deletion requirements.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
            } catch (err: any) {
              Alert.alert(
                'Deletion Error',
                err?.response?.data?.message || 'Unable to delete account.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Account &amp; Settings</Text>

      <View style={styles.card}>
        <View style={styles.rowGap}>
          <User size={22} color={Colors.primary} />
          <View>
            <Text style={styles.name}>{user?.name || 'PetJeeva User'}</Text>
            <Text style={styles.meta}>
              +91 {user?.phone} • Role: {user?.role}
            </Text>
          </View>
        </View>
      </View>

      {/* Wallet Shortcut */}
      <TouchableOpacity
        style={styles.menuCard}
        onPress={() => navigation.navigate('MainTabs', { screen: 'WalletTab' } as any)}
      >
        <View style={styles.rowGap}>
          <Wallet size={18} color={Colors.mintDark} />
          <Text style={styles.menuText}>Wallet &amp; Transaction History</Text>
        </View>
        <Text style={styles.walletBadge}>
          ₹{Number(balance ?? user?.walletBalance ?? 0).toLocaleString('en-IN')}
        </Text>
      </TouchableOpacity>

      {isPetParent ? (
        <TouchableOpacity
          style={styles.menuCard}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('PetEdit')}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.rowGap}>
              <PawPrint size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Pets ({pets.length})</Text>
            </View>
            <Text style={styles.meta}>
              {pets.length > 0
                ? pets.map((p) => `${p.name} (${p.breed})`).join(', ')
                : 'Tap to add or edit your pets'}
            </Text>
          </View>
          <ChevronRight size={18} color={Colors.slateMuted} />
        </TouchableOpacity>
      ) : null}

      {/* Saved Addresses -> Opens Address Edit Screen */}
      <TouchableOpacity
        style={styles.menuCard}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('AddressEdit')}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.rowGap}>
            <MapPin size={18} color={Colors.info} />
            <Text style={styles.cardTitle}>
              Saved Addresses ({user?.addresses?.length || 0})
            </Text>
          </View>
          <Text style={styles.meta}>
            {user?.addresses && user.addresses.length > 0
              ? `${user.addresses[0].line1}, ${user.addresses[0].city}`
              : 'Tap to add or edit service addresses'}
          </Text>
        </View>
        <ChevronRight size={18} color={Colors.slateMuted} />
      </TouchableOpacity>

      {/* Notification Preferences */}
      <View style={styles.menuCard}>
        <Text style={styles.menuText}>Push &amp; Session Alerts</Text>
        <Switch value={pushEnabled} onValueChange={setPushEnabled} />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color={Colors.slateDark} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={handleDeleteAccount}
        disabled={deleting}
      >
        <Trash2 size={18} color={Colors.danger} />
        <Text style={styles.deleteText}>
          {deleting ? 'Deleting Account...' : 'Delete Account'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  title: { ...Typography.h2, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontWeight: '800', fontSize: 17, color: Colors.slateDark },
  cardTitle: { fontWeight: '700', fontSize: 14, color: Colors.slateDark },
  meta: { ...Typography.caption, marginTop: 2 },
  menuCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  menuText: { fontWeight: '700', fontSize: 14, color: Colors.slateDark },
  walletBadge: { fontWeight: '800', color: Colors.mintDark, fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 13,
    borderRadius: Radii.md,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  logoutText: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 13,
    borderRadius: Radii.md,
    gap: 8,
  },
  deleteText: { fontWeight: '700', color: Colors.danger, fontSize: 14 },
});