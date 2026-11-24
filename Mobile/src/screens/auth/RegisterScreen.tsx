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
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { User, Phone, Lock, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react-native';
import { AuthStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useAuthStore } from '../../store/useAuthStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const {
    registerInit,
    verifyRegistration,
    pendingRegistration,
    clearPendingRegistration,
    isLoading,
  } = useAuthStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [codeInput, setCodeInput] = useState('');

  const handleRequestCode = async () => {
    if (name.trim().length < 2) {
      Alert.alert('Invalid Name', 'Please enter your full name.');
      return;
    }
    if (!/^[0-9]{10,15}$/.test(phone.trim())) {
      Alert.alert('Invalid Mobile Number', 'Enter a valid 10-to-15 digit mobile number.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    try {
      const pending = await registerInit({
        name: name.trim(),
        phone: phone.trim(),
        password,
      });
      setCodeInput('');
      Alert.alert(
        '4-Digit Code Generated',
        `Your verification code is ${pending.verificationCode}. Enter it on screen to complete registration.`
      );
    } catch (err: any) {
      Alert.alert(
        'Registration Error',
        err?.response?.data?.message || 'Could not start registration.'
      );
    }
  };

  const handleVerifyCode = async () => {
    const targetPhone = pendingRegistration?.phone || phone.trim();
    if (!/^[0-9]{4}$/.test(codeInput.trim())) {
      Alert.alert('Enter 4-Digit Code', 'Please enter the 4-digit code shown on screen.');
      return;
    }
    try {
      await verifyRegistration(targetPhone, codeInput.trim());
    } catch (err: any) {
      Alert.alert(
        'Verification Failed',
        err?.response?.data?.message || 'Invalid or expired 4-digit code.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            clearPendingRegistration();
            navigation.goBack();
          }}
        >
          <ArrowLeft size={18} color={Colors.slateDark} />
          <Text style={styles.backText}>Back to Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create Pet Parent Account</Text>
        <Text style={styles.subtitle}>
          Enter your name and mobile number to receive your on-screen 4-digit verification code.
        </Text>

        {!pendingRegistration ? (
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <User size={18} color={Colors.slateMuted} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={Colors.slateMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Phone size={18} color={Colors.slateMuted} />
              <TextInput
                style={styles.input}
                placeholder="Mobile Number"
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
                placeholder="Create Password (min 6 chars)"
                placeholderTextColor={Colors.slateMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.disabledBtn]}
              onPress={handleRequestCode}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Generate 4-Digit Code</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.codeBanner}>
              <Text style={styles.codeBannerLabel}>YOUR ON-SCREEN VERIFICATION CODE</Text>
              <Text style={styles.codeDigits}>{pendingRegistration.verificationCode}</Text>
              <Text style={styles.codeMeta}>
                Mobile: {pendingRegistration.phone} • Valid for {pendingRegistration.expiresInMinutes} mins
              </Text>
            </View>

            <Text style={styles.verifyPrompt}>Enter the 4-digit code displayed above:</Text>

            <View style={styles.inputGroup}>
              <KeyRound size={18} color={Colors.primary} />
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="0000"
                placeholderTextColor={Colors.slateMuted}
                keyboardType="number-pad"
                maxLength={4}
                value={codeInput}
                onChangeText={setCodeInput}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.disabledBtn]}
              onPress={handleVerifyCode}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <View style={styles.btnContent}>
                  <CheckCircle2 size={18} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Verify & Complete Registration</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={clearPendingRegistration}>
              <Text style={styles.secondaryBtnText}>Edit Name or Mobile Number</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  backText: {
    fontWeight: '600',
    color: Colors.slateDark,
  },
  title: {
    ...Typography.h1,
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.slateMuted,
    marginBottom: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
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
  codeInput: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 8,
  },
  codeBanner: {
    backgroundColor: Colors.mint,
    borderRadius: Radii.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  codeBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.mintDark,
    letterSpacing: 0.6,
  },
  codeDigits: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.slateDark,
    letterSpacing: 10,
    marginVertical: 6,
  },
  codeMeta: {
    ...Typography.caption,
    color: Colors.mintDark,
  },
  verifyPrompt: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
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
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: Colors.slateMuted,
    fontWeight: '600',
    fontSize: 13,
  },
});