import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowDownLeft, ArrowUpRight, ShieldCheck, Wallet } from 'lucide-react-native';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useWalletStore } from '../../store/useWalletStore';
import { useAuthStore } from '../../store/useAuthStore';
import { WalletTransaction } from '../../types/models';

const PRO_ROLES = [
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
];

export const WalletScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { balance, transactions, isLoading, refreshWallet, fetchTransactions } = useWalletStore();
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');

  const isPro = user ? PRO_ROLES.includes(user.role) : false;

  useFocusEffect(
    useCallback(() => {
      refreshWallet().catch(() => {});
    }, [refreshWallet])
  );

  const handleFilterChange = async (nextFilter: 'all' | 'credit' | 'debit') => {
    setFilter(nextFilter);
    await fetchTransactions(nextFilter);
  };

  const renderTransaction = ({ item }: { item: WalletTransaction }) => {
    const isCredit = item.type === 'credit';
    return (
      <View style={styles.txCard}>
        <View style={[styles.txIconBox, isCredit ? styles.creditIconBg : styles.debitIconBg]}>
          {isCredit ? (
            <ArrowDownLeft size={18} color={Colors.mintDark} />
          ) : (
            <ArrowUpRight size={18} color={Colors.danger} />
          )}
        </View>

        <View style={styles.txBody}>
          <Text style={styles.txDesc} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.txMeta}>
            {item.category.replace(/_/g, ' ').toUpperCase()} •{' '}
            {new Date(item.createdAt).toLocaleString()}
          </Text>
          <Text style={styles.txBalLine}>
            Balance: ₹{item.balanceBefore.toLocaleString('en-IN')} → ₹
            {item.balanceAfter.toLocaleString('en-IN')}
          </Text>
        </View>

        <Text style={[styles.txAmount, isCredit ? styles.creditText : styles.debitText]}>
          {isCredit ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.screenTitle}>
          {isPro ? 'Professional Wallet & Earnings' : 'PetJeeva Internal Wallet'}
        </Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceTopRow}>
          <Text style={styles.balanceLabel}>AVAILABLE WALLET BALANCE</Text>
          <Wallet size={20} color={Colors.white} />
        </View>
        <Text style={styles.balanceAmount}>₹{Number(balance || 0).toLocaleString('en-IN')}</Text>
        <Text style={styles.balanceRoleNote}>
          {isPro
            ? 'Session earnings are credited atomically upon completed sessions.'
            : 'Session fees are settled atomically from your wallet upon session completion.'}
        </Text>
      </View>

      {/* Admin Top-Up Policy Banner */}
      <View style={styles.adminBanner}>
        <ShieldCheck size={18} color={Colors.mintDark} />
        <Text style={styles.adminBannerText}>
          Internal Wallet System: Wallet top-ups and balance adjustments are managed directly by
          PetJeeva Admin (no third-party payment gateways).
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'credit', 'debit'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterPill, filter === tab && styles.filterPillActive]}
            onPress={() => handleFilterChange(tab)}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {tab === 'all' ? 'All Ledger' : tab === 'credit' ? 'Credits (+)' : 'Debits (-)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={renderTransaction}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshWallet} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No wallet transactions recorded yet.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topHeader: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  screenTitle: { ...Typography.h2 },
  balanceCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.slateDark,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: { color: '#D1D5DB', fontSize: 11, fontWeight: '700', letterSpacing: 0.7 },
  balanceAmount: { color: Colors.white, fontSize: 32, fontWeight: '800', marginVertical: 6 },
  balanceRoleNote: { color: '#E5E7EB', fontSize: 12, lineHeight: 17 },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.mint,
    marginHorizontal: Spacing.lg,
    padding: Spacing.sm + 4,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    gap: 8,
    marginBottom: Spacing.md,
  },
  adminBannerText: { flex: 1, fontSize: 12, color: Colors.mintDark, fontWeight: '600', lineHeight: 16 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: Colors.slateDark },
  filterTextActive: { color: Colors.white },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditIconBg: { backgroundColor: Colors.mint },
  debitIconBg: { backgroundColor: '#FEE2E2' },
  txBody: { flex: 1 },
  txDesc: { fontWeight: '700', fontSize: 14, color: Colors.slateDark },
  txMeta: { ...Typography.caption, fontSize: 11, marginTop: 2 },
  txBalLine: { fontSize: 11, fontWeight: '600', color: Colors.slateMuted, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800' },
  creditText: { color: Colors.mintDark },
  debitText: { color: Colors.danger },
  emptyBox: { paddingVertical: Spacing.xl, alignItems: 'center' },
  emptyText: { ...Typography.caption },
});