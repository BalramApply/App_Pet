import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Home,
  CalendarCheck,
  Wallet,
  HeartPulse,
  LifeBuoy,
  UserCircle2,
  Briefcase,
} from 'lucide-react-native';
import {
  AuthStackParamList,
  ClientTabParamList,
  ProTabParamList,
  RootStackParamList,
} from '../types/navigation';
import { useAuthStore } from '../store/useAuthStore';
import { Colors } from '../theme/theme';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { HomeScreen } from '../screens/client/HomeScreen';
import { WalletScreen } from '../screens/shared/WalletScreen';
import { ServiceCatalogScreen } from '../screens/client/ServiceCatalogScreen';
import { ServiceDetailScreen } from '../screens/client/ServiceDetailScreen';
import { AssessmentBookingScreen } from '../screens/client/AssessmentBookingScreen';
import { BookingCheckoutScreen } from '../screens/client/BookingCheckoutScreen';
import { BookingConfirmationScreen } from '../screens/client/BookingConfirmationScreen';
import { BookingsHubScreen } from '../screens/shared/BookingsHubScreen';
import { BookingDetailScreen } from '../screens/shared/BookingDetailScreen';
import { LiveTrackingScreen } from '../screens/client/LiveTrackingScreen';
import { ProfessionalSessionScreen } from '../screens/pro/ProfessionalSessionScreen';
import { CustomerActiveSessionScreen } from '../screens/client/CustomerActiveSessionScreen';
import { SessionReportScreen } from '../screens/shared/SessionReportScreen';
import { ProfessionalProfileScreen } from '../screens/shared/ProfessionalProfileScreen';
import { HealthVaultScreen } from '../screens/client/HealthVaultScreen';
import { SupportHubScreen } from '../screens/shared/SupportHubScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { ProfessionalDashboardScreen } from '../screens/pro/ProfessionalDashboardScreen';
import { AddressEditScreen } from '../screens/shared/AddressEditScreen';
import { PetEditScreen } from '../screens/shared/PetEditScreen';
import { TicketThreadScreen } from '../screens/shared/TicketThreadScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ClientTabs = createBottomTabNavigator<ClientTabParamList>();
const ProTabs = createBottomTabNavigator<ProTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const PRO_ROLES = [
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
];

const ClientMainTabs: React.FC = () => {
  return (
    <ClientTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.slateMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <ClientTabs.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <ClientTabs.Screen
        name="BookingsTab"
        component={BookingsHubScreen}
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} />,
        }}
      />
      <ClientTabs.Screen
        name="WalletTab"
        component={WalletScreen}
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />
      <ClientTabs.Screen
        name="VaultTab"
        component={HealthVaultScreen}
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, size }) => <HeartPulse size={size} color={color} />,
        }}
      />
      <ClientTabs.Screen
        name="SupportTab"
        component={SupportHubScreen}
        options={{
          title: 'Support',
          tabBarIcon: ({ color, size }) => <LifeBuoy size={size} color={color} />,
        }}
      />
      <ClientTabs.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserCircle2 size={size} color={color} />,
        }}
      />
    </ClientTabs.Navigator>
  );
};

const ProMainTabs: React.FC = () => {
  return (
    <ProTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.slateMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <ProTabs.Screen
        name="ProDashboardTab"
        component={ProfessionalDashboardScreen}
        options={{
          title: 'Desk',
          tabBarIcon: ({ color, size }) => <Briefcase size={size} color={color} />,
        }}
      />
      <ProTabs.Screen
        name="BookingsTab"
        component={BookingsHubScreen}
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} />,
        }}
      />
      <ProTabs.Screen
        name="WalletTab"
        component={WalletScreen}
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />
      <ProTabs.Screen
        name="SupportTab"
        component={SupportHubScreen}
        options={{
          title: 'Support',
          tabBarIcon: ({ color, size }) => <LifeBuoy size={size} color={color} />,
        }}
      />
      <ProTabs.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserCircle2 size={size} color={color} />,
        }}
      />
    </ProTabs.Navigator>
  );
};

const AuthenticatedStack: React.FC = () => {
  const { user } = useAuthStore();
  const isPro = user ? PRO_ROLES.includes(user.role) : false;

  return (
    <RootStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.slateDark,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <RootStack.Screen
        name="MainTabs"
        component={isPro ? ProMainTabs : ClientMainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="ServiceCatalog"
        component={ServiceCatalogScreen}
        options={{ title: 'Pet Services & Packages' }}
      />
      <RootStack.Screen
        name="ServiceDetail"
        component={ServiceDetailScreen}
        options={{ title: 'Program & Package Details' }}
      />
      <RootStack.Screen
        name="AssessmentBooking"
        component={AssessmentBookingScreen}
        options={{ title: 'Free Assessment / Demo' }}
      />
      <RootStack.Screen
        name="BookingCheckout"
        component={BookingCheckoutScreen}
        options={{ title: 'Wallet Checkout' }}
      />
      <RootStack.Screen
        name="BookingConfirmation"
        component={BookingConfirmationScreen}
        options={{ title: 'Booking Confirmed', headerLeft: () => null }}
      />
      <RootStack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Booking Details' }}
      />
      <RootStack.Screen
        name="LiveTracking"
        component={LiveTrackingScreen}
        options={{ title: 'Live GPS Tracking (Leaflet)' }}
      />
      <RootStack.Screen
        name="ProfessionalSession"
        component={ProfessionalSessionScreen}
        options={{ title: 'Session Console' }}
      />
      <RootStack.Screen
        name="CustomerActiveSession"
        component={CustomerActiveSessionScreen}
        options={{ title: 'Active Session' }}
      />
      <RootStack.Screen
        name="SessionReport"
        component={SessionReportScreen}
        options={{ title: 'Session Report & Settlement' }}
      />
      <RootStack.Screen
        name="ProfessionalProfile"
        component={ProfessionalProfileScreen}
        options={{ title: 'Professional Profile' }}
      />
      <RootStack.Screen
        name="TicketThread"
        component={TicketThreadScreen}
        options={{ title: 'Support Conversation' }}
      />
      <RootStack.Screen
        name="AddressEdit"
        component={AddressEditScreen}
        options={{ title: 'Saved Addresses' }}
      />

      <RootStack.Screen
      name="PetEdit"
      component={PetEditScreen}
      options={{ title: 'My Pets' }}
      />
    </RootStack.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <AuthenticatedStack />
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
};