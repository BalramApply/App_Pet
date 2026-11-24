import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Phone, MessageCircle, Mail, Clock, ShieldAlert, X } from 'lucide-react-native';
import { Colors, Radii, Spacing, Typography } from '../theme/theme';
import { useAuthStore } from '../store/useAuthStore';
import { SupportContact } from '../types/models';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ visible, onClose }) => {
  const { supportContact, fetchSupportContact } = useAuthStore();
  const [contact, setContact] = useState<SupportContact | null>(supportContact);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    fetchSupportContact()
      .then((data) => {
        if (active) setContact(data);
      })
      .catch(() => {
        if (active) {
          setContact({
            supportPhone: '+91-124-400-0100',
            supportWhatsApp: '+91-98110-00100',
            supportEmail: 'support@petjeeva.com',
            supportHours: 'Mon-Sun, 08:00 AM - 10:00 PM IST',
            emergencyHelpline: '+91-98110-00911',
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, fetchSupportContact]);

  const handleCall = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`).catch(() => {});
  };

  const handleWhatsApp = (wa?: string) => {
    if (!wa) return;
    const digits = wa.replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent('Hello PetJeeva Admin, I need help resetting my password.')}`).catch(() => {});
  };

  const handleEmail = (email?: string) => {
    if (!email) return;
    Linking.openURL(
      `mailto:${email}?subject=${encodeURIComponent('PetJeeva Password Reset Assistance')}`
    ).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ShieldAlert size={20} color={Colors.primary} />
              <Text style={styles.title}>Forgot Password?</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={22} color={Colors.slateMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Password resets are handled directly by our PetJeeva Admin & Support team for your security. Please reach out using any channel below:
          </Text>

          {loading && !contact ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.rows}>
              <TouchableOpacity style={styles.channelRow} onPress={() => handleCall(contact?.supportPhone)}>
                <Phone size={18} color={Colors.primary} />
                <View style={styles.channelText}>
                  <Text style={styles.channelLabel}>Support Helpline</Text>
                  <Text style={styles.channelValue}>{contact?.supportPhone}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.channelRow}
                onPress={() => handleWhatsApp(contact?.supportWhatsApp)}
              >
                <MessageCircle size={18} color={Colors.mintDark} />
                <View style={styles.channelText}>
                  <Text style={styles.channelLabel}>WhatsApp Admin Desk</Text>
                  <Text style={styles.channelValue}>{contact?.supportWhatsApp}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.channelRow} onPress={() => handleEmail(contact?.supportEmail)}>
                <Mail size={18} color={Colors.info} />
                <View style={styles.channelText}>
                  <Text style={styles.channelLabel}>Support Email</Text>
                  <Text style={styles.channelValue}>{contact?.supportEmail}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.hoursRow}>
                <Clock size={16} color={Colors.slateMuted} />
                <Text style={styles.hoursText}>
                  {contact?.supportHours || 'Mon-Sun, 08:00 AM - 10:00 PM IST'}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Got It</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 30, 45, 0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h2,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.slateMuted,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  loaderBox: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  rows: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  channelText: {
    flex: 1,
  },
  channelLabel: {
    ...Typography.caption,
  },
  channelValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.slateDark,
    marginTop: 2,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.xs,
  },
  hoursText: {
    ...Typography.caption,
  },
  closeBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  closeBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});