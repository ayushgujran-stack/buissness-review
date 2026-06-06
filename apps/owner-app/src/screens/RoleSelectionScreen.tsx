import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Store, Building2 } from 'lucide-react-native';

export default function RoleSelectionScreen({ onSelectRole }: { onSelectRole: (role: 'owner' | 'manager') => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>How would you like to use ReVu?</Text>
        </View>

        <TouchableOpacity 
          style={styles.roleCard}
          onPress={() => onSelectRole('owner')}
        >
          <View style={styles.iconContainer}>
            <Building2 color="#ffffff" size={28} />
          </View>
          <View style={styles.roleInfo}>
            <Text style={styles.roleTitle}>I am a Brand Owner</Text>
            <Text style={styles.roleDesc}>Setup your franchise, create branches, and view overall analytics.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.roleCard}
          onPress={() => onSelectRole('manager')}
        >
          <View style={styles.iconContainer}>
            <Store color="#ffffff" size={28} />
          </View>
          <View style={styles.roleInfo}>
            <Text style={styles.roleTitle}>I am a Branch Manager</Text>
            <Text style={styles.roleDesc}>Login securely with your branch credentials to manage operations.</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    width: '100%',
    maxWidth: 450,
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  roleDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    fontWeight: '500',
  }
});
