import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PawPrint, Phone, Lock } from 'lucide-react-native';
import { AuthStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { ForgotPasswordModal } from '../../components/ForgotPasswordModal';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login, isLoading } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [forgotVisible, setForgotVisible] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Missing Details', 'Please enter your mobile number and password.');
      return;
    }
    try {
      await login(phone.trim(), password);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Unable to sign in. Please check your credentials.';
      Alert.alert('Sign In Failed', msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brandHeader}>
        <View style={styles.logoBadge}>
          <PawPrint size={32} color={Colors.white} />
        </View>
        <Text style={styles.brandName}>PetJeeva</Text>
        <Text style={styles.brandTagline}>
          Trusted Training, GPS Walking, Grooming & Home Vaccination
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.heading}>Welcome Back</Text>

        <View style={styles.inputGroup}>
          <Phone size={18} color={Colors.slateMuted} />
          <TextInput
            style={styles.input}
            placeholder="Mobile Number (e.g. 9876543210)"
            placeholderTextColor={Colors.slateMuted}
            keyboardType="phone-pad"
            maxLength={15}
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.inputGroup}>
          <Lock size={18} color={Colors.slateMuted} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.slateMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity style={styles.forgotRow} onPress={() => setForgotVisible(true)}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, isLoading && styles.disabledBtn]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New to PetJeeva?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ForgotPasswordModal visible={forgotVisible} onClose={() => setForgotVisible(false)} />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.slateDark,
  },
  brandTagline: {
    ...Typography.caption,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: Spacing.md,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heading: {
    ...Typography.h2,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    height: 48,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.slateDark,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
  },
  forgotText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    gap: 6,
  },
  footerText: {
    ...Typography.body,
    color: Colors.slateMuted,
  },
  linkText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '700',
  },
});