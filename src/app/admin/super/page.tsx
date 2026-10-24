'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  GitBranch,
  Layers,
  KeyRound,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  BarChart3,
  ScrollText,
  Settings as SettingsIcon,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  ChevronRight,
  X,
  FileText,
  DollarSign,
  Calendar,
  Lock,
  UserCheck,
  MoreVertical,
  Sliders,
  LogOut,
  Building,
} from 'lucide-react';

type NavTab =
  | 'dashboard'
  | 'customers'
  | 'businesses'
  | 'branches'
  | 'plans'
  | 'licenses'
  | 'payments'
  | 'reviews'
  | 'admins'
  | 'reports'
  | 'audit'
  | 'settings';

export default function SuperAdminPanel() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [licensePlans, setLicensePlans] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Drawers
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);

  // Action Modals
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    type: 'ASSIGN_TRIAL' | 'ASSIGN_PAID' | 'EXTEND' | 'RENEW' | 'CHANGE_BRANCH_LIMIT' | 'SUSPEND' | 'REACTIVATE';
    ownerId: string;
    ownerName: string;
    currentLimit?: number;
    currentExpiry?: string;
  } | null>(null);

  const [actionForm, setActionForm] = useState({
    durationDays: 15,
    maxBranches: 5,
    additionalDays: 30,
    newMaxBranches: 10,
    assignmentSource: 'ADMIN_MANUAL' as 'ADMIN_MANUAL' | 'PAYMENT_GATEWAY',
    amount: '4999',
    currency: 'INR',
    gatewayTransactionId: '',
    reason: '',
  });

  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Customer Form State
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    organizationName: '',
    address: '',
    status: 'ACTIVE',
    password: '',
    licenseOption: 'TRIAL' as 'TRIAL' | 'PAID' | 'NONE',
    trialDurationDays: 15,
    trialMaxBranches: 5,
    paidDurationDays: 365,
    paidMaxBranches: 10,
    paidSource: 'ADMIN_MANUAL' as 'ADMIN_MANUAL' | 'PAYMENT_GATEWAY',
    paidAmount: '4999',
    paidGatewayTxId: '',
    reason: '',
  });

  const [customerCreatedResult, setCustomerCreatedResult] = useState<any>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Settings saving
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Initial load
  const loadInitialData = async () => {
    try {
      setLoading(true);

      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const meData = await meRes.json();
      if (meData.user?.role !== 'SUPER_ADMIN' && meData.user?.role !== 'ADMIN') {
        router.push('/dashboard');
        return;
      }
      setCurrentUser(meData.user);

      // Load dashboard stats
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats);
      }

      // Load customers
      await refreshCustomers();

      // Load initial licenses
      refreshLicenses();
    } catch (err) {
      console.error(err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Tab switch fetchers
  useEffect(() => {
    if (activeTab === 'businesses') fetchBusinesses();
    if (activeTab === 'branches') fetchBranches();
    if (activeTab === 'plans') fetchPlans();
    if (activeTab === 'licenses') fetchLicenses();
    if (activeTab === 'payments') fetchPayments();
    if (activeTab === 'reviews') fetchReviews();
    if (activeTab === 'admins') fetchAdmins();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab]);

  const refreshCustomers = async () => {
    const res = await fetch('/api/admin/customers');
    if (res.ok) {
      const d = await res.json();
      setCustomers(d.customers || []);
    }
  };

  const refreshLicenses = async () => {
    const res = await fetch('/api/admin/licenses');
    if (res.ok) {
      const d = await res.json();
      setLicenses(d.licenses || []);
    }
  };

  const fetchBusinesses = async () => {
    const res = await fetch('/api/admin/businesses');
    if (res.ok) {
      const d = await res.json();
      setBusinesses(d.businesses || []);
    }
  };

  const fetchBranches = async () => {
    const res = await fetch('/api/admin/branches');
    if (res.ok) {
      const d = await res.json();
      setBranches(d.branches || []);
    }
  };

  const fetchPlans = async () => {
    const res = await fetch('/api/admin/license-plans');
    if (res.ok) {
      const d = await res.json();
      setLicensePlans(d.plans || []);
    }
  };

  const fetchLicenses = async () => {
    const res = await fetch('/api/admin/licenses');
    if (res.ok) {
      const d = await res.json();
      setLicenses(d.licenses || []);
    }
  };

  const fetchPayments = async () => {
    const res = await fetch('/api/admin/payments');
    if (res.ok) {
      const d = await res.json();
      setPayments(d.payments || []);
    }
  };

  const fetchReviews = async () => {
    const res = await fetch('/api/reviews?limit=100');
    if (res.ok) {
      const d = await res.json();
      setReviews(d.reviews || []);
    }
  };

  const fetchAdmins = async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const d = await res.json();
      setAdmins(d.admins || []);
    }
  };

  const fetchAuditLogs = async () => {
    const res = await fetch('/api/admin/audit-logs');
    if (res.ok) {
      const d = await res.json();
      setAuditLogs(d.logs || []);
    }
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/admin/settings');
    if (res.ok) {
      const d = await res.json();
      setSettings(d.settings || []);
    }
  };

  const handleOpenCustomerDetails = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setLoadingCustomerDetails(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`);
      if (res.ok) {
        const d = await res.json();
        setCustomerDetails(d);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCustomerDetails(false);
    }
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCustomer(true);
    setActionMessage(null);

    try {
      const payload: any = {
        name: customerForm.name,
        email: customerForm.email,
        phone: customerForm.phone,
        organizationName: customerForm.organizationName,
        address: customerForm.address,
        status: customerForm.status,
        password: customerForm.password,
        licenseOption: customerForm.licenseOption,
      };

      if (customerForm.licenseOption === 'TRIAL') {
        payload.trialDetails = {
          durationDays: customerForm.trialDurationDays,
          maxBranches: customerForm.trialMaxBranches,
          reason: customerForm.reason || 'Super Admin initial trial license grant',
        };
      } else if (customerForm.licenseOption === 'PAID') {
        payload.paidDetails = {
          durationDays: customerForm.paidDurationDays,
          maxBranches: customerForm.paidMaxBranches,
          assignmentSource: customerForm.paidSource,
          amount: customerForm.paidAmount,
          currency: 'INR',
          gatewayTransactionId: customerForm.paidGatewayTxId,
          reason: customerForm.reason || (customerForm.paidSource === 'PAYMENT_GATEWAY' ? 'Payment Verified' : 'Manual Entitlement'),
        };
      }

      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }

      setCustomerCreatedResult(data);
      await refreshCustomers();
      await refreshLicenses();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleExecuteLicenseAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;

    setActionSubmitting(true);
    setActionMessage(null);

    try {
      const payload: any = {
        action: actionModal.type,
        ownerId: actionModal.ownerId,
        reason: actionForm.reason,
      };

      if (actionModal.type === 'ASSIGN_TRIAL') {
        payload.durationDays = actionForm.durationDays;
        payload.maxBranches = actionForm.maxBranches;
      } else if (actionModal.type === 'ASSIGN_PAID') {
        payload.durationDays = actionForm.durationDays;
        payload.maxBranches = actionForm.maxBranches;
        payload.assignmentSource = actionForm.assignmentSource;
        payload.amount = actionForm.amount;
        payload.gatewayTransactionId = actionForm.gatewayTransactionId;
      } else if (actionModal.type === 'EXTEND') {
        payload.additionalDays = actionForm.additionalDays;
      } else if (actionModal.type === 'RENEW') {
        payload.durationDays = actionForm.durationDays;
        payload.maxBranches = actionForm.maxBranches;
      } else if (actionModal.type === 'CHANGE_BRANCH_LIMIT') {
        payload.newMaxBranches = actionForm.newMaxBranches;
      }

      const res = await fetch('/api/admin/licenses/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }

      setActionMessage({ type: 'success', text: data.message || 'Operation succeeded' });
      await refreshCustomers();
      await refreshLicenses();
      if (selectedCustomerId) {
        await handleOpenCustomerDetails(selectedCustomerId);
      }

      setTimeout(() => {
        setActionModal(null);
        setActionMessage(null);
      }, 1200);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setSettingsSuccess(false);

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (res.ok) {
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 3000);
      } else {
        alert('Failed to save settings');
      }
    } catch {
      alert('Error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', color: '#0B192C' }}>
        <RefreshCw size={32} className="spin" color="#1E3A8A" />
        <span style={{ marginLeft: 16, fontWeight: 700, fontSize: 18 }}>Loading Super Admin System...</span>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Customers & Owners', icon: Users, badge: customers.length },
    { id: 'businesses', label: 'Businesses', icon: Building2 },
    { id: 'branches', label: 'Branches', icon: GitBranch },
    { id: 'plans', label: 'License Plans', icon: Layers },
    { id: 'licenses', label: 'License Assignments', icon: KeyRound },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare },
    { id: 'admins', label: 'Admins & Permissions', icon: ShieldCheck },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'audit', label: 'Audit Logs', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC', color: '#0B192C', fontFamily: 'system-ui, sans-serif' }}>
      {/* 1. SUPER ADMIN SIDEBAR (All 12 Navigation Items) */}
      <aside
        style={{
          width: 280,
          background: '#0B192C',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          boxShadow: '4px 0 20px rgba(11, 25, 44, 0.1)',
          zIndex: 40,
        }}
      >
        {/* Brand */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(30, 58, 138, 0.4)',
              }}
            >
              <ShieldAlert size={22} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: '#FFFFFF' }}>ReviewFlow</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                SUPER ADMIN
              </div>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as NavTab);
                  setSelectedCustomerId(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#FFFFFF' : '#94A3B8',
                  background: isActive ? '#1E3A8A' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Icon size={18} color={isActive ? '#60A5FA' : '#94A3B8'} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                      color: '#FFFFFF',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User profile & logout */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#1E3A8A',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {currentUser?.name?.[0] || 'A'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{currentUser?.name}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{currentUser?.email}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 6,
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        {/* Top Header */}
        <header
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0B192C', margin: 0, textTransform: 'capitalize' }}>
              {activeTab.replace('-', ' ')}
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0 0' }}>
              ReviewFlow Centralized Software License & Multi-Tenant Management
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => {
                setShowCreateCustomerModal(true);
                setCustomerCreatedResult(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#1E3A8A',
                color: '#FFFFFF',
                padding: '9px 16px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(30, 58, 138, 0.25)',
              }}
            >
              <Plus size={16} />
              <span>Create New Customer</span>
            </button>
          </div>
        </header>

        {/* Tab Body */}
        <div style={{ padding: '32px' }}>
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 32 }}>
                {[
                  { label: 'Total Customers', val: customers.length, sub: 'Active Business Owners', icon: Users, color: '#1E3A8A', bg: '#EFF6FF' },
                  { label: 'Active Businesses', val: stats?.totalBusinesses || businesses.length || 0, sub: 'Multi-Tenant Portals', icon: Building2, color: '#059669', bg: '#ECFDF5' },
                  { label: 'Licensed Branches', val: stats?.totalBranches || branches.length || 0, sub: 'Unique QR Touchpoints', icon: GitBranch, color: '#7C3AED', bg: '#F5F3FF' },
                  { label: 'Customer Reviews', val: stats?.totalReviews || reviews.length || 0, sub: 'Feedback Collected', icon: MessageSquare, color: '#EA580C', bg: '#FFF7ED' },
                ].map((s, idx) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 12,
                        padding: 24,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>{s.label}</div>
                          <div style={{ fontSize: 32, fontWeight: 800, color: '#0B192C', marginTop: 4 }}>{s.val}</div>
                          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{s.sub}</div>
                        </div>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={22} color={s.color} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Actions & Recent Customers */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0B192C', margin: 0 }}>Recent Customers & Licenses</h2>
                    <button
                      onClick={() => setActiveTab('customers')}
                      style={{ background: 'none', border: 'none', color: '#1E3A8A', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      View All Customers <ArrowRight size={14} />
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                          <th style={{ padding: '10px 12px', fontWeight: 600 }}>Customer</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600 }}>Organization</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600 }}>License</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600 }}>Branches</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600 }}>Expiry / Remaining</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.slice(0, 6).map((c) => (
                          <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '12px' }}>
                              <div style={{ fontWeight: 700, color: '#0B192C' }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{c.email}</div>
                            </td>
                            <td style={{ padding: '12px', color: '#475569' }}>{c.organizationName || '—'}</td>
                            <td style={{ padding: '12px' }}>
                              {c.license ? (
                                <span
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background:
                                      c.license.status === 'ACTIVE'
                                        ? '#ECFDF5'
                                        : c.license.status === 'TRIAL'
                                        ? '#EFF6FF'
                                        : '#FEF2F2',
                                    color:
                                      c.license.status === 'ACTIVE'
                                        ? '#059669'
                                        : c.license.status === 'TRIAL'
                                        ? '#1E3A8A'
                                        : '#DC2626',
                                  }}
                                >
                                  {c.license.licenseType} ({c.license.status})
                                </span>
                              ) : (
                                <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#F1F5F9', color: '#64748B' }}>
                                  NO LICENSE
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontWeight: 600 }}>
                              {c.totalBranches} / {c.license?.maxBranches ?? 0}
                            </td>
                            <td style={{ padding: '12px', fontSize: 12 }}>
                              {c.license ? `${c.license.daysRemaining} days left` : '—'}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <button
                                onClick={() => handleOpenCustomerDetails(c.id)}
                                style={{
                                  background: '#F1F5F9',
                                  border: '1px solid #CBD5E1',
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: '#0B192C',
                                  cursor: 'pointer',
                                }}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Provisioning Quick Card */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                      <KeyRound size={22} color="#1E3A8A" />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0B192C', margin: 0 }}>Provision Customer</h3>
                    <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, marginTop: 8 }}>
                      Super Admin can create a new customer account, grant immediate Trial or Paid licenses, and configure branch allowances without requiring the customer to register first.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateCustomerModal(true);
                      setCustomerCreatedResult(null);
                    }}
                    style={{
                      width: '100%',
                      background: '#1E3A8A',
                      color: '#FFFFFF',
                      padding: '12px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      marginTop: 20,
                    }}
                  >
                    + Create New Customer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOMERS & OWNERS */}
          {activeTab === 'customers' && (
            <div>
              {/* Controls bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16 }}>
                <div style={{ position: 'relative', width: 340 }}>
                  <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 11 }} />
                  <input
                    type="text"
                    placeholder="Search customers by name, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13.5,
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => refreshCustomers()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: '#475569',
                    }}
                  >
                    <RefreshCw size={14} /> Refresh
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateCustomerModal(true);
                      setCustomerCreatedResult(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#1E3A8A',
                      color: '#FFFFFF',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontSize: 13.5,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={16} /> Create Customer
                  </button>
                </div>
              </div>

              {/* Customers Table */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Customer Name</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Email & Phone</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Organization</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Account Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>License Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Branches (Used / Max)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Remaining</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers
                      .filter(
                        (c) =>
                          !searchQuery ||
                          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.organizationName?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((c) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 800, color: '#0B192C' }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>Joined: {new Date(c.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ color: '#1E3A8A', fontWeight: 600 }}>{c.email}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{c.phone || 'No phone'}</div>
                          </td>
                          <td style={{ padding: '14px 16px', color: '#475569' }}>
                            {c.organizationName || <span style={{ color: '#CBD5E1' }}>None</span>}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                background: c.status === 'ACTIVE' ? '#ECFDF5' : '#FEF2F2',
                                color: c.status === 'ACTIVE' ? '#059669' : '#DC2626',
                              }}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {c.license ? (
                              <span
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background:
                                    c.license.status === 'ACTIVE'
                                      ? '#ECFDF5'
                                      : c.license.status === 'TRIAL'
                                      ? '#EFF6FF'
                                      : '#FEF2F2',
                                  color:
                                    c.license.status === 'ACTIVE'
                                      ? '#059669'
                                      : c.license.status === 'TRIAL'
                                      ? '#1E3A8A'
                                      : '#DC2626',
                                }}
                              >
                                {c.license.licenseType} • {c.license.status}
                              </span>
                            ) : (
                              <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#F1F5F9', color: '#64748B' }}>
                                NO LICENSE
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#0B192C' }}>
                              {c.totalBranches} / {c.license?.maxBranches ?? 0}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>across {c.totalBusinesses} businesses</div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {c.license ? (
                              <span style={{ fontWeight: 600, color: c.license.daysRemaining <= 3 ? '#DC2626' : '#0B192C' }}>
                                {c.license.daysRemaining} days
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleOpenCustomerDetails(c.id)}
                                style={{
                                  background: '#1E3A8A',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BUSINESSES */}
          {activeTab === 'businesses' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 800, fontSize: 16 }}>
                  All Customer Businesses (Unlimited per Owner)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px' }}>Business</th>
                      <th style={{ padding: '12px 16px' }}>Category</th>
                      <th style={{ padding: '12px 16px' }}>Owner</th>
                      <th style={{ padding: '12px 16px' }}>Branches</th>
                      <th style={{ padding: '12px 16px' }}>Reviews</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>{b.name}</td>
                        <td style={{ padding: '14px 16px', color: '#64748B' }}>{b.category}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{b.owner.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.owner.email}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>{b._count.branches}</td>
                        <td style={{ padding: '14px 16px' }}>{b._count.reviews}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#ECFDF5', color: '#059669' }}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: BRANCHES */}
          {activeTab === 'branches' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 800, fontSize: 16 }}>
                  All Licensed Branches & QR Touchpoints
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px' }}>Branch Name</th>
                      <th style={{ padding: '12px 16px' }}>Business</th>
                      <th style={{ padding: '12px 16px' }}>Owner</th>
                      <th style={{ padding: '12px 16px' }}>Address</th>
                      <th style={{ padding: '12px 16px' }}>Reviews</th>
                      <th style={{ padding: '12px 16px' }}>QR Portal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((br) => (
                      <tr key={br.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>{br.name}</td>
                        <td style={{ padding: '14px 16px' }}>{br.business.name}</td>
                        <td style={{ padding: '14px 16px' }}>{br.business.owner.name}</td>
                        <td style={{ padding: '14px 16px', color: '#64748B' }}>{br.address}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>{br._count.reviews}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <a
                            href={`/review/${br.qrToken}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1E3A8A', fontWeight: 700, fontSize: 12 }}
                          >
                            Open QR Link <ExternalLink size={12} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: LICENSE PLANS */}
          {activeTab === 'plans' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {licensePlans.map((p) => (
                  <div key={p.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#1E3A8A' }}>
                          {p.licenseType}
                        </span>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C', margin: '8px 0 4px 0' }}>{p.name}</h3>
                        <div style={{ fontSize: 12, color: '#64748B' }}>Code: {p.code}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#0B192C' }}>₹{p.price}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.durationDays} days</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F1F5F9', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#64748B' }}>Max Branches:</span>
                        <span style={{ fontWeight: 700 }}>{p.maxBranches} branches</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Subscribers:</span>
                        <span style={{ fontWeight: 700 }}>{p._count.licenses} owners</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: LICENSE ASSIGNMENTS */}
          {activeTab === 'licenses' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>All License Assignments</div>
                  <button onClick={() => refreshLicenses()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E3A8A' }}>
                    <RefreshCw size={16} />
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px' }}>Customer</th>
                      <th style={{ padding: '12px 16px' }}>Plan Name</th>
                      <th style={{ padding: '12px 16px' }}>Type & Status</th>
                      <th style={{ padding: '12px 16px' }}>Capacity (Used / Max)</th>
                      <th style={{ padding: '12px 16px' }}>Expires At</th>
                      <th style={{ padding: '12px 16px' }}>Remaining</th>
                      <th style={{ padding: '12px 16px' }}>Source / Assigned By</th>
                      <th style={{ padding: '12px 16px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((lic) => (
                      <tr key={lic.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700 }}>{lic.ownerName}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{lic.ownerEmail}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>{lic.planName}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background:
                                lic.status === 'ACTIVE'
                                  ? '#ECFDF5'
                                  : lic.status === 'TRIAL'
                                  ? '#EFF6FF'
                                  : '#FEF2F2',
                              color:
                                lic.status === 'ACTIVE'
                                  ? '#059669'
                                  : lic.status === 'TRIAL'
                                  ? '#1E3A8A'
                                  : '#DC2626',
                            }}
                          >
                            {lic.licenseType} • {lic.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                          {lic.currentBranches} / {lic.maxBranches}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 12 }}>{new Date(lic.expiresAt).toLocaleDateString()}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>{lic.daysRemaining} days</td>
                        <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748B' }}>
                          <div>{lic.assignmentSource}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>by {lic.assignedBy || 'System'}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={() => handleOpenCustomerDetails(lic.ownerId)}
                            style={{
                              background: '#1E3A8A',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '5px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: PAYMENTS */}
          {activeTab === 'payments' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 800, fontSize: 16 }}>
                  Verified Payment Records
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px' }}>Invoice</th>
                      <th style={{ padding: '12px 16px' }}>Customer</th>
                      <th style={{ padding: '12px 16px' }}>Amount</th>
                      <th style={{ padding: '12px 16px' }}>Gateway</th>
                      <th style={{ padding: '12px 16px' }}>Transaction ID</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>{p.invoiceNumber}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{p.owner.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.owner.email}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 800 }}>₹{p.amount}</td>
                        <td style={{ padding: '14px 16px', color: '#64748B' }}>{p.gateway}</td>
                        <td style={{ padding: '14px 16px', fontSize: 12 }}>{p.transactionId}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#ECFDF5', color: '#059669' }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 12 }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>
                          No verified payments recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: REVIEWS */}
          {activeTab === 'reviews' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 800, fontSize: 16 }}>
                  System-Wide Customer Feedback Stream
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {reviews.map((r) => (
                      <div key={r.id} style={{ padding: 16, border: '1px solid #E2E8F0', borderRadius: 8, background: '#F8FAFC' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0B192C' }}>
                              {r.customer?.name} ({r.customer?.mobile})
                            </div>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                              {r.business?.name} • Branch: {r.branch?.name}
                            </div>
                          </div>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 800,
                              background: r.sentiment === 'GOOD' ? '#ECFDF5' : r.sentiment === 'OKAY' ? '#FFFBEB' : '#FEF2F2',
                              color: r.sentiment === 'GOOD' ? '#059669' : r.sentiment === 'OKAY' ? '#D97706' : '#DC2626',
                            }}
                          >
                            {r.sentiment} ({r.rating}★)
                          </span>
                        </div>
                        {r.answers && r.answers.length > 0 && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #E2E8F0', fontSize: 12.5, color: '#334155' }}>
                            {r.answers.map((a: any, i: number) => (
                              <div key={i} style={{ marginTop: 4 }}>
                                <span style={{ fontWeight: 600 }}>{a.questionText}:</span> {a.answerText}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {reviews.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>No reviews submitted yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: ADMINS & PERMISSIONS */}
          {activeTab === 'admins' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 800, fontSize: 16 }}>
                  System Administrators & Privileges
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px' }}>Administrator</th>
                      <th style={{ padding: '12px 16px' }}>Email</th>
                      <th style={{ padding: '12px 16px' }}>Role</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((adm) => (
                      <tr key={adm.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>{adm.name}</td>
                        <td style={{ padding: '14px 16px', color: '#1E3A8A' }}>{adm.email}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#1E3A8A' }}>
                            {adm.role}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#ECFDF5', color: '#059669' }}>
                            {adm.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 12 }}>{new Date(adm.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 10: REPORTS */}
          {activeTab === 'reports' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px 0' }}>Platform Health Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ color: '#64748B' }}>Total Customer Owners:</span>
                      <span style={{ fontWeight: 700 }}>{customers.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ color: '#64748B' }}>Active Businesses:</span>
                      <span style={{ fontWeight: 700 }}>{businesses.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ color: '#64748B' }}>Licensed Branches:</span>
                      <span style={{ fontWeight: 700 }}>{branches.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ color: '#64748B' }}>Total Reviews Collected:</span>
                      <span style={{ fontWeight: 700 }}>{reviews.length}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px 0' }}>Feedback Sentiment Breakdown</h3>
                  <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
                    <div style={{ flex: 1, padding: 16, background: '#ECFDF5', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#059669' }}>
                        {reviews.filter((r) => r.sentiment === 'GOOD').length}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginTop: 4 }}>GOOD REVIEWS</div>
                    </div>
                    <div style={{ flex: 1, padding: 16, background: '#FFFBEB', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#D97706' }}>
                        {reviews.filter((r) => r.sentiment === 'OKAY').length}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginTop: 4 }}>OKAY REVIEWS</div>
                    </div>
                    <div style={{ flex: 1, padding: 16, background: '#FEF2F2', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#DC2626' }}>
                        {reviews.filter((r) => r.sentiment === 'POOR').length}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', marginTop: 4 }}>POOR REVIEWS</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 800, fontSize: 16 }}>
                  Immutable System Audit Trail
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px' }}>Timestamp</th>
                      <th style={{ padding: '12px 16px' }}>Actor</th>
                      <th style={{ padding: '12px 16px' }}>Role</th>
                      <th style={{ padding: '12px 16px' }}>Action</th>
                      <th style={{ padding: '12px 16px' }}>Entity</th>
                      <th style={{ padding: '12px 16px' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{log.userName || log.user?.name || 'System'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700, background: '#F1F5F9', color: '#475569' }}>
                            {log.role || 'ADMIN'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E3A8A' }}>{log.action}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B' }}>{log.entityType}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 12: SETTINGS */}
          {activeTab === 'settings' && (
            <div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24, maxWidth: 640 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0' }}>Super Admin System Settings</h3>
                <form onSubmit={handleSaveSettings}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {settings.map((s) => (
                      <div key={s.key}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0B192C', marginBottom: 4 }}>
                          {s.key}
                        </label>
                        <input
                          type="text"
                          value={s.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSettings((prev) => prev.map((x) => (x.key === s.key ? { ...x, value: val } : x)));
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid #CBD5E1',
                            fontSize: 13.5,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  {settingsSuccess && (
                    <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 6, background: '#ECFDF5', color: '#059669', fontSize: 13, fontWeight: 700 }}>
                      Settings saved successfully.
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={savingSettings}
                    style={{
                      marginTop: 24,
                      background: '#1E3A8A',
                      color: '#FFFFFF',
                      padding: '10px 20px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {savingSettings ? 'Saving...' : 'Save Configuration'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ----------------------------------------------------
          MODAL: CREATE NEW CUSTOMER & ASSIGN LICENSE
          ---------------------------------------------------- */}
      {showCreateCustomerModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 25, 44, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(3px)',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: 32,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0B192C', margin: 0 }}>Create New Customer</h2>
                <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0 0' }}>
                  Provision customer account and assign software license
                </p>
              </div>
              <button
                onClick={() => setShowCreateCustomerModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            {actionMessage && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  background: actionMessage.type === 'error' ? '#FEF2F2' : '#ECFDF5',
                  color: actionMessage.type === 'error' ? '#DC2626' : '#059669',
                }}
              >
                {actionMessage.text}
              </div>
            )}

            {customerCreatedResult ? (
              /* Success / Result View */
              <div>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: '50%',
                      background: '#ECFDF5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px auto',
                    }}
                  >
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C', margin: 0 }}>Customer Provisioned!</h3>
                  <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                    Customer account and license assignment have been saved with audit trail.
                  </p>
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0B192C', marginBottom: 8 }}>Activation Credentials:</div>
                  <div style={{ fontSize: 12.5, color: '#334155', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div><strong>Customer Name:</strong> {customerCreatedResult.customer.name}</div>
                    <div><strong>Login Email:</strong> {customerCreatedResult.customer.email}</div>
                    <div><strong>Username:</strong> {customerCreatedResult.customer.username}</div>
                    <div><strong>Temporary Password:</strong> <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>{customerCreatedResult.activation.temporaryPassword}</code></div>
                    <div><strong>License Assigned:</strong> {customerCreatedResult.license ? `${customerCreatedResult.license.licenseType} (${customerCreatedResult.license.maxBranches} branches, ${customerCreatedResult.license.durationDays} days)` : 'No License Assigned'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    onClick={() => {
                      setShowCreateCustomerModal(false);
                      setCustomerCreatedResult(null);
                    }}
                    style={{
                      flex: 1,
                      background: '#1E3A8A',
                      color: '#FFFFFF',
                      padding: '11px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Create Customer Form */
              <form onSubmit={handleCreateCustomerSubmit}>
                {/* Section 1: Customer Details */}
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E3A8A', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  1. Customer Profile
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="john@example.com"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                      Organization Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ABC Hospitality Group"
                      value={customerForm.organizationName}
                      onChange={(e) => setCustomerForm({ ...customerForm, organizationName: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                      Address (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Suite 400, MG Road, Bangalore"
                      value={customerForm.address}
                      onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                      Account Status
                    </label>
                    <select
                      value={customerForm.status}
                      onChange={(e) => setCustomerForm({ ...customerForm, status: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PENDING">PENDING</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>

                {/* Section 2: License Selection */}
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E3A8A', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  2. License Selection
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { id: 'TRIAL', title: 'Option A: Trial', desc: '15 Days Trial (5 Branches)' },
                    { id: 'PAID', title: 'Option B: Paid', desc: 'Commercial License' },
                    { id: 'NONE', title: 'Option C: No License', desc: 'Assign License Later' },
                  ].map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => setCustomerForm({ ...customerForm, licenseOption: opt.id as any })}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: customerForm.licenseOption === opt.id ? '2px solid #1E3A8A' : '1px solid #CBD5E1',
                        background: customerForm.licenseOption === opt.id ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0B192C' }}>{opt.title}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>

                {/* TRIAL Fields */}
                {customerForm.licenseOption === 'TRIAL' && (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                          Trial Duration (Days)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={customerForm.trialDurationDays}
                          onChange={(e) => setCustomerForm({ ...customerForm, trialDurationDays: parseInt(e.target.value, 10) })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                          Maximum Total Branches
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={customerForm.trialMaxBranches}
                          onChange={(e) => setCustomerForm({ ...customerForm, trialMaxBranches: parseInt(e.target.value, 10) })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#059669', marginTop: 8, fontWeight: 600 }}>
                      ✓ Expiry will be calculated automatically: {new Date(Date.now() + customerForm.trialDurationDays * 86400000).toLocaleDateString()}
                    </div>
                  </div>
                )}

                {/* PAID Fields */}
                {customerForm.licenseOption === 'PAID' && (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                          Duration (Days)
                        </label>
                        <input
                          type="number"
                          min="30"
                          value={customerForm.paidDurationDays}
                          onChange={(e) => setCustomerForm({ ...customerForm, paidDurationDays: parseInt(e.target.value, 10) })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                          Maximum Branches
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={customerForm.paidMaxBranches}
                          onChange={(e) => setCustomerForm({ ...customerForm, paidMaxBranches: parseInt(e.target.value, 10) })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                        Activation Authorization Mode
                      </label>
                      <select
                        value={customerForm.paidSource}
                        onChange={(e) => setCustomerForm({ ...customerForm, paidSource: e.target.value as any })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                      >
                        <option value="ADMIN_MANUAL">Explicit Manual Administrative Entitlement</option>
                        <option value="PAYMENT_GATEWAY">Verified Payment Gateway Transaction</option>
                      </select>
                    </div>

                    {customerForm.paidSource === 'PAYMENT_GATEWAY' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Amount (₹)</label>
                          <input
                            type="text"
                            value={customerForm.paidAmount}
                            onChange={(e) => setCustomerForm({ ...customerForm, paidAmount: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Gateway Tx ID</label>
                          <input
                            type="text"
                            placeholder="e.g. pay_29Xkd..."
                            value={customerForm.paidGatewayTxId}
                            onChange={(e) => setCustomerForm({ ...customerForm, paidGatewayTxId: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                        Authorization Reason / Note *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Annual Enterprise Subscription authorized by Super Admin"
                        value={customerForm.reason}
                        onChange={(e) => setCustomerForm({ ...customerForm, reason: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateCustomerModal(false)}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingCustomer}
                    style={{
                      flex: 2,
                      padding: '11px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#1E3A8A',
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {creatingCustomer ? 'Provisioning...' : 'Provision Customer Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: CUSTOMER DETAILS & LICENSE SUMMARY (Req 8)
          ---------------------------------------------------- */}
      {selectedCustomerId && customerDetails && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 25, 44, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(3px)',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 900,
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: 32,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0B192C', margin: 0 }}>
                    {customerDetails.customer.name}
                  </h2>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: customerDetails.customer.status === 'ACTIVE' ? '#ECFDF5' : '#FEF2F2',
                      color: customerDetails.customer.status === 'ACTIVE' ? '#059669' : '#DC2626',
                    }}
                  >
                    {customerDetails.customer.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                  {customerDetails.customer.email} • {customerDetails.customer.phone || 'No phone'} • Org: {customerDetails.customer.organizationName || 'None'}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>TOTAL BUSINESSES</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0B192C', marginTop: 4 }}>
                  {customerDetails.metrics.totalBusinesses}
                </div>
              </div>
              <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>TOTAL BRANCHES</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0B192C', marginTop: 4 }}>
                  {customerDetails.metrics.totalBranches}
                </div>
              </div>
              <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>BRANCH LIMIT</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0B192C', marginTop: 4 }}>
                  {customerDetails.metrics.branchLimit}
                </div>
              </div>
              <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>AVAILABLE CAPACITY</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: customerDetails.metrics.availableBranches === 0 ? '#DC2626' : '#059669', marginTop: 4 }}>
                  {customerDetails.metrics.availableBranches}
                </div>
              </div>
              <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>REMAINING DAYS</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1E3A8A', marginTop: 4 }}>
                  {customerDetails.license.daysRemaining}
                </div>
              </div>
            </div>

            {/* Current License Card & Action Buttons */}
            <div style={{ background: '#FFFFFF', border: '2px solid #1E3A8A', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1E3A8A', textTransform: 'uppercase' }}>Current Software License</div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C', margin: '4px 0 0 0' }}>
                    {customerDetails.license.planName}
                  </h3>
                  <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
                    Type: <strong>{customerDetails.license.type}</strong> | Status: <strong>{customerDetails.license.status}</strong> | Source: <strong>{customerDetails.license.assignmentSource}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Start: <strong>{customerDetails.license.startsAt ? new Date(customerDetails.license.startsAt).toLocaleDateString() : 'N/A'}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Expiry: <strong>{customerDetails.license.expiresAt ? new Date(customerDetails.license.expiresAt).toLocaleDateString() : 'N/A'}</strong>
                  </div>
                </div>
              </div>

              {/* Requirement 8 Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                <button
                  onClick={() =>
                    setActionModal({
                      open: true,
                      type: 'ASSIGN_TRIAL',
                      ownerId: customerDetails.customer.id,
                      ownerName: customerDetails.customer.name,
                    })
                  }
                  style={{ background: '#EFF6FF', border: '1px solid #93C5FD', color: '#1E3A8A', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Assign Trial
                </button>
                <button
                  onClick={() =>
                    setActionModal({
                      open: true,
                      type: 'ASSIGN_PAID',
                      ownerId: customerDetails.customer.id,
                      ownerName: customerDetails.customer.name,
                    })
                  }
                  style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Assign Paid License
                </button>
                <button
                  onClick={() =>
                    setActionModal({
                      open: true,
                      type: 'EXTEND',
                      ownerId: customerDetails.customer.id,
                      ownerName: customerDetails.customer.name,
                      currentExpiry: customerDetails.license.expiresAt,
                    })
                  }
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#0B192C', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Extend License
                </button>
                <button
                  onClick={() =>
                    setActionModal({
                      open: true,
                      type: 'RENEW',
                      ownerId: customerDetails.customer.id,
                      ownerName: customerDetails.customer.name,
                    })
                  }
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#0B192C', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Renew License
                </button>
                <button
                  onClick={() =>
                    setActionModal({
                      open: true,
                      type: 'CHANGE_BRANCH_LIMIT',
                      ownerId: customerDetails.customer.id,
                      ownerName: customerDetails.customer.name,
                      currentLimit: customerDetails.metrics.branchLimit,
                    })
                  }
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#0B192C', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Change Branch Limit
                </button>
                {customerDetails.license.status !== 'SUSPENDED' ? (
                  <button
                    onClick={() =>
                      setActionModal({
                        open: true,
                        type: 'SUSPEND',
                        ownerId: customerDetails.customer.id,
                        ownerName: customerDetails.customer.name,
                      })
                    }
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      setActionModal({
                        open: true,
                        type: 'REACTIVATE',
                        ownerId: customerDetails.customer.id,
                        ownerName: customerDetails.customer.name,
                      })
                    }
                    style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>

            {/* License History Table */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0B192C', margin: '0 0 12px 0' }}>License History Diffs</h4>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 12px' }}>Timestamp</th>
                      <th style={{ padding: '8px 12px' }}>Action</th>
                      <th style={{ padding: '8px 12px' }}>Performed By</th>
                      <th style={{ padding: '8px 12px' }}>Reason</th>
                      <th style={{ padding: '8px 12px' }}>Diff (Previous vs New)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDetails.licenseHistory.map((h: any) => (
                      <tr key={h.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748B' }}>{new Date(h.createdAt).toLocaleString()}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1E3A8A' }}>{h.action}</td>
                        <td style={{ padding: '8px 12px' }}>{h.performedBy}</td>
                        <td style={{ padding: '8px 12px' }}>{h.reason || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ color: '#DC2626' }}>{h.previousValues ? JSON.stringify(h.previousValues) : 'None'}</span>
                          {' → '}
                          <span style={{ color: '#059669' }}>{JSON.stringify(h.newValues)}</span>
                        </td>
                      </tr>
                    ))}
                    {customerDetails.licenseHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#94A3B8' }}>
                          No previous license change history recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Businesses & Branches */}
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0B192C', margin: '0 0 12px 0' }}>Businesses & Branches</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {customerDetails.businesses.map((biz: any) => (
                  <div key={biz.id} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 14, background: '#F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, color: '#0B192C' }}>
                        {biz.name} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748B' }}>({biz.category})</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1E3A8A' }}>{biz.branchCount} branches</span>
                    </div>
                    {biz.branches.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {biz.branches.map((br: any) => (
                          <span
                            key={br.id}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontSize: 11.5,
                              color: '#334155',
                            }}
                          >
                            {br.name} ({br.reviewCount} reviews)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: LICENSE ACTION DIALOG (Extend, Renew, Change Limit, Suspend, Reactivate)
          ---------------------------------------------------- */}
      {actionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 25, 44, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            backdropFilter: 'blur(3px)',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 500,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: 28,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C', margin: 0 }}>
                {actionModal.type.replace(/_/g, ' ')}
              </h3>
              <button onClick={() => setActionModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
              Target Customer: <strong>{actionModal.ownerName}</strong>
            </div>

            {actionMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  marginBottom: 16,
                  fontSize: 13,
                  fontWeight: 600,
                  background: actionMessage.type === 'error' ? '#FEF2F2' : '#ECFDF5',
                  color: actionMessage.type === 'error' ? '#DC2626' : '#059669',
                }}
              >
                {actionMessage.text}
              </div>
            )}

            <form onSubmit={handleExecuteLicenseAction}>
              {actionModal.type === 'ASSIGN_TRIAL' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={actionForm.durationDays}
                      onChange={(e) => setActionForm({ ...actionForm, durationDays: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Max Branches</label>
                    <input
                      type="number"
                      min="1"
                      value={actionForm.maxBranches}
                      onChange={(e) => setActionForm({ ...actionForm, maxBranches: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                </div>
              )}

              {actionModal.type === 'ASSIGN_PAID' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Duration (Days)</label>
                      <input
                        type="number"
                        min="30"
                        value={actionForm.durationDays}
                        onChange={(e) => setActionForm({ ...actionForm, durationDays: parseInt(e.target.value, 10) })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Max Branches</label>
                      <input
                        type="number"
                        min="1"
                        value={actionForm.maxBranches}
                        onChange={(e) => setActionForm({ ...actionForm, maxBranches: parseInt(e.target.value, 10) })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Entitlement Source</label>
                    <select
                      value={actionForm.assignmentSource}
                      onChange={(e) => setActionForm({ ...actionForm, assignmentSource: e.target.value as any })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                    >
                      <option value="ADMIN_MANUAL">Administrative Manual Entitlement</option>
                      <option value="PAYMENT_GATEWAY">Verified Payment Gateway</option>
                    </select>
                  </div>
                </div>
              )}

              {actionModal.type === 'EXTEND' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Additional Days to Extend</label>
                  <input
                    type="number"
                    min="1"
                    value={actionForm.additionalDays}
                    onChange={(e) => setActionForm({ ...actionForm, additionalDays: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                  />
                </div>
              )}

              {actionModal.type === 'RENEW' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={actionForm.durationDays}
                      onChange={(e) => setActionForm({ ...actionForm, durationDays: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Max Branches</label>
                    <input
                      type="number"
                      min="1"
                      value={actionForm.maxBranches}
                      onChange={(e) => setActionForm({ ...actionForm, maxBranches: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                </div>
              )}

              {actionModal.type === 'CHANGE_BRANCH_LIMIT' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    New Maximum Branch Limit (Current: {actionModal.currentLimit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={actionForm.newMaxBranches}
                    onChange={(e) => setActionForm({ ...actionForm, newMaxBranches: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                  />
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Audit Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="State the administrative reason for this change"
                  value={actionForm.reason}
                  onChange={(e) => setActionForm({ ...actionForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  style={{ flex: 1, padding: '9px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  style={{
                    flex: 2,
                    padding: '9px',
                    borderRadius: 6,
                    border: 'none',
                    background: actionModal.type === 'SUSPEND' ? '#DC2626' : '#1E3A8A',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {actionSubmitting ? 'Processing...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
