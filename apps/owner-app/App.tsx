import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LayoutDashboard, TrendingUp, AlertTriangle, Utensils, LogOut, Store, Mail } from 'lucide-react-native';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// Import Screens
import DashboardScreen from './src/screens/DashboardScreen';
import BranchAnalysisScreen from './src/screens/BranchAnalysisScreen';
import ServiceAreaScreen from './src/screens/ServiceAreaScreen';
import FoodItemScreen from './src/screens/FoodItemScreen';
import LoginScreen from './src/screens/LoginScreen';
import BranchSetupScreen from './src/screens/BranchSetupScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';
import BrandSetupScreen from './src/screens/BrandSetupScreen';
import ManageBranchesScreen from './src/screens/ManageBranchesScreen';
import InboxScreen from './src/screens/InboxScreen';
import { UserProvider, useUser } from './src/context/UserContext';

const Tab = createBottomTabNavigator();

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [unauthRole, setUnauthRole] = useState<'owner' | 'manager' | null>(null);
  const { role, brandId, branchId, loading: userLoading } = useUser();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const { role, brandId, isDemo } = useUser();

  // Listen for pending review requests to show notification badge
  useEffect(() => {
    if (!brandId || !role || isDemo || !auth.currentUser) {
      setPendingCount(0);
      return;
    }

    const q = query(
      collection(db, 'review_requests'),
      where('brandId', '==', brandId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    }, (error) => {
      console.error("Error listening for pending requests:", error);
    });

    return () => unsubscribe();
  }, [brandId, role]);

  if (authLoading || (user && userLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Pre-Authentication Flow
  if (!user) {
    if (!unauthRole) {
      return <RoleSelectionScreen onSelectRole={setUnauthRole} />;
    }
    if (unauthRole === 'owner') {
      return <LoginScreen onBack={() => setUnauthRole(null)} />;
    }
    if (unauthRole === 'manager') {
      return <BranchSetupScreen onBack={() => setUnauthRole(null)} />;
    }
  }

  // Post-Authentication Flow
  if (!role) {
    // Wait for UserContext to sync if they just signed up
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (role === 'owner' && !brandId) {
    return <BrandSetupScreen />;
  }

  // A manager should have both brandId and branchId set immediately upon anonymous auth, 
  // but just in case, we can fallback here.
  if (role === 'manager' && !branchId) {
    return <BranchSetupScreen />;
  }

  const LogoutButton = () => (
    <TouchableOpacity 
      onPress={() => {
        setUnauthRole(null);
        signOut(auth);
      }} 
      style={{ marginRight: 16, flexDirection: 'row', alignItems: 'center' }}
    >
      <LogOut size={18} color="#ef4444" />
    </TouchableOpacity>
  );

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
            tabBarActiveTintColor: '#6366f1', // Premium active indigo
            tabBarInactiveTintColor: '#94a3b8',
            headerRight: () => <LogoutButton />,
            tabBarStyle: {
              backgroundColor: '#ffffff',
              borderTopWidth: 1,
              borderTopColor: 'rgba(99, 102, 241, 0.08)', // Subtle indigo border tint
              height: 70,
              paddingBottom: 10,
              paddingTop: 10,
              elevation: 0,
              shadowColor: '#6366f1',
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.02,
              shadowRadius: 10,
            },
            headerStyle: {
              backgroundColor: '#ffffff', // Clean white header
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(99, 102, 241, 0.08)',
              elevation: 0,
              shadowOpacity: 0,
            },
            headerTitleStyle: {
              fontWeight: '800',
              color: '#09090b', // Sleek off-black
              letterSpacing: -0.5,
            },
            tabBarLabelStyle: {
              fontWeight: '700',
              fontSize: 11,
              marginTop: -4,
            },
            // Center titles across all screens
            headerTitleAlign: 'center',
          }}
        >
          <Tab.Screen 
            name="Dashboard" 
            component={DashboardScreen} 
            options={{
              tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} strokeWidth={2} />
            }}
          />
          <Tab.Screen 
            name="Branches" 
            component={BranchAnalysisScreen} 
            options={{
              tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} strokeWidth={2} />
            }}
          />
          <Tab.Screen 
            name="Service" 
            component={ServiceAreaScreen} 
            options={{
              tabBarIcon: ({ color, size }) => <AlertTriangle color={color} size={size} strokeWidth={2} />
            }}
          />
          <Tab.Screen 
            name="Food" 
            component={FoodItemScreen} 
            options={{
              tabBarIcon: ({ color, size }) => <Utensils color={color} size={size} strokeWidth={2} />
        }}
      />
      {(role === 'owner' || role === 'manager') && (
        <>
          <Tab.Screen 
            name="Setup" 
            component={ManageBranchesScreen} 
            options={{
              tabBarIcon: ({ color, size }) => <Store color={color} size={size} strokeWidth={2} />
            }}
          />
          <Tab.Screen 
            name="Inbox" 
            component={InboxScreen} 
            options={{
              tabBarItemStyle: { display: 'none' },
              tabBarButton: () => null,
            }}
          />
        </>
      )}
    </Tab.Navigator>
  </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <UserProvider>
        <MainApp />
      </UserProvider>
    </SafeAreaProvider>
  );
}

