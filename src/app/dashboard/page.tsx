'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  GitBranch,
  QrCode as QrIcon,
  MessageSquare,
  Users,
  CreditCard,
  BarChart3,
  Bell,
  Plus,
  ExternalLink,
  Download,
  Printer,
  RefreshCw,
  LogOut,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Check,
  X,
  Star,
  ThumbsDown,
  ThumbsUp,
  Meh,
  Shield,
  Layers,
  Search,
  Filter,
  FileText,
} from 'lucide-react';
import FormManager from '@/components/FormManager';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'OWNER' | 'MANAGER' | 'SUPER_MANAGER' | 'SUPER_ADMIN' | 'ADMIN';
  mustChangePassword?: boolean;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  description?: string;
  themeColor: string;
  qrToken: string;
  status: string;
  businessId: string;
  businessName?: string;
  _count?: { reviews: number };
  qrCodes?: { qrImageUrl: string }[];
}

interface Business {
  id: string;
  name: string;
  category: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  branches: Branch[];
}

interface LicenseStatus {
  hasActiveLicense: boolean;
  status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  planName: string;
  maxBranches: number;
  currentBranches: number;
  availableBranches: number;
  canCreateBranch: boolean;
  daysRemaining: number;
  isTrial: boolean;
  warningLevel: string;
}

interface Review {
  id: string;
  rating: number;
  sentiment: 'GOOD' | 'OKAY' | 'POOR';
  status: 'NEW' | 'READ' | 'RESOLVED';
  source: string;
  notes?: string;
  createdAt: string;
  customer: { name: string; mobile: string; email?: string };
  business: { name: string };
  branch: { name: string; themeColor?: string };
  answers: { questionText: string; answerText: string; classification?: string }[];
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  metadata?: any;
  createdAt: string;
  isRead: boolean;
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('ALL');

  const [activeTab, setActiveTab] = useState<'analytics' | 'businesses' | 'forms' | 'qr' | 'reviews' | 'customers' | 'team' | 'billing'>('analytics');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);

  // Data states
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewFilterSentiment, setReviewFilterSentiment] = useState<string>('ALL');
  const [reviewSearch, setReviewSearch] = useState<string>('');
  const [analytics, setAnalytics] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  // Notifications & Live Alert Popups
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState<boolean>(false);
  const [liveAlert, setLiveAlert] = useState<NotificationItem | null>(null);

  // Modals
  const [showAddBusinessModal, setShowAddBusinessModal] = useState<boolean>(false);
  const [newBizName, setNewBizName] = useState('');
  const [newBizCategory, setNewBizCategory] = useState('Restaurant & Dining');
  const [newBizDesc, setNewBizDesc] = useState('');
  const [newBizPhone, setNewBizPhone] = useState('');

  const [showAddBranchModal, setShowAddBranchModal] = useState<boolean>(false);
  const [targetBusinessIdForBranch, setTargetBusinessIdForBranch] = useState<string>('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [newBranchColor, setNewBranchColor] = useState('#1E3A8A');
  const [branchCreationError, setBranchCreationError] = useState<string | null>(null);

  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [selectedReviewForModal, setSelectedReviewForModal] = useState<Review | null>(null);
  const [reviewResolutionNotes, setReviewResolutionNotes] = useState('');

  const [showCreateTeamModal, setShowCreateTeamModal] = useState<boolean>(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamEmail, setNewTeamEmail] = useState('');
  const [newTeamUsername, setNewTeamUsername] = useState('');
  const [newTeamPassword, setNewTeamPassword] = useState('manager123');
  const [newTeamRole, setNewTeamRole] = useState<'MANAGER' | 'SUPER_MANAGER'>('MANAGER');
  const [newTeamBusinessId, setNewTeamBusinessId] = useState('');
  const [newTeamBranchId, setNewTeamBranchId] = useState('');

  // Initial Load
  const fetchSessionAndBusinesses = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (!data.authenticated) {
        router.push('/login');
        return;
      }

      setUser(data.user);
      setLicense(data.license);
      setBusinesses(data.businesses || []);
    } catch {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    fetchSessionAndBusinesses();
  }, [fetchSessionAndBusinesses]);

  const loadDashboardData = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (selectedBusinessId !== 'ALL') {
        queryParams.set('businessId', selectedBusinessId);
      }
      if (reviewFilterSentiment !== 'ALL') {
        queryParams.set('sentiment', reviewFilterSentiment);
      }
      if (reviewSearch) {
        queryParams.set('search', reviewSearch);
      }

      const revRes = await fetch(`/api/reviews?${queryParams.toString()}`);
      if (revRes.ok) {
        const revData = await revRes.json();
        setReviews(revData.reviews || []);
      }

      const anaRes = await fetch(`/api/reports/analytics?${selectedBusinessId !== 'ALL' ? `businessId=${selectedBusinessId}` : ''}`);
      if (anaRes.ok) {
        const anaData = await anaRes.json();
        setAnalytics(anaData);
      }

      const custRes = await fetch('/api/customers');
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData.customers || []);
      }

      const teamRes = await fetch('/api/team');
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeamMembers(teamData.team || []);
      }

      const planRes = await fetch('/api/license/plans');
      if (planRes.ok) {
        const planData = await planRes.json();
        setPlans(planData.plans || []);
      }

      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData.notifications || []);
        setUnreadCount(notifData.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }, [selectedBusinessId, reviewFilterSentiment, reviewSearch]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Polling for instant Poor Review push alerts
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/notifications/poll');
        if (res.ok) {
          const data = await res.json();
          if (data.hasNew && data.notifications && data.notifications.length > 0) {
            const poorAlert = data.notifications.find((n: any) => n.type === 'POOR_REVIEW');
            if (poorAlert) {
              setLiveAlert(poorAlert);
              loadDashboardData();
            }
          }
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const displayedBranches: (Branch & { businessName: string })[] = [];
  for (const b of businesses) {
    if (selectedBusinessId === 'ALL' || selectedBusinessId === b.id) {
      for (const br of b.branches) {
        displayedBranches.push({ ...br, businessName: b.name });
      }
    }
  }

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBizName,
          category: newBizCategory,
          description: newBizDesc,
          phone: newBizPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create business');
        return;
      }
      setShowAddBusinessModal(false);
      setNewBizName('');
      setNewBizDesc('');
      setNewBizPhone('');
      await fetchSessionAndBusinesses();
      await loadDashboardData();
    } catch {
      alert('Error creating business');
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchCreationError(null);

    const bizId = targetBusinessIdForBranch || (businesses[0] ? businesses[0].id : '');
    if (!bizId) {
      setBranchCreationError('Please select a business');
      return;
    }

    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: bizId,
          name: newBranchName,
          address: newBranchAddress,
          phone: newBranchPhone,
          themeColor: newBranchColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBranchCreationError(data.error || 'Failed to create branch');
        return;
      }

      setShowAddBranchModal(false);
      setNewBranchName('');
      setNewBranchAddress('');
      setNewBranchPhone('');
      await fetchSessionAndBusinesses();
      await loadDashboardData();
    } catch {
      setBranchCreationError('Network error while creating branch');
    }
  };

  const handleRegenerateQr = async (branchId: string) => {
    if (!confirm('Are you sure you want to regenerate this QR code? Existing printed standees using the previous QR code will stop functioning.')) {
      return;
    }

    try {
      const res = await fetch(`/api/branches/${branchId}/regenerate-qr`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to regenerate QR');
        return;
      }
      alert('QR code successfully regenerated with a new secure token!');
      await fetchSessionAndBusinesses();
      await loadDashboardData();
    } catch {
      alert('Error regenerating QR');
    }
  };

  const handleResolveReview = async () => {
    if (!selectedReviewForModal) return;
    try {
      const res = await fetch(`/api/reviews/${selectedReviewForModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RESOLVED',
          notes: reviewResolutionNotes,
        }),
      });
      if (res.ok) {
        setSelectedReviewForModal(null);
        setReviewResolutionNotes('');
        await loadDashboardData();
      }
    } catch {
      alert('Failed to update review status');
    }
  };

  const handleCreateTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName,
          email: newTeamEmail,
          username: newTeamUsername,
          password: newTeamPassword,
          role: newTeamRole,
          assignments: [
            {
              businessId: newTeamBusinessId || (businesses[0]?.id || ''),
              branchId: newTeamRole === 'MANAGER' ? (newTeamBranchId || null) : null,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create team member');
        return;
      }
      setShowCreateTeamModal(false);
      setNewTeamName('');
      setNewTeamEmail('');
      setNewTeamUsername('');
      await loadDashboardData();
    } catch {
      alert('Error creating team member');
    }
  };

  const handleUpgradePlan = async (planId: string) => {
    try {
      const orderRes = await fetch('/api/license/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        alert(orderData.error || 'Order creation failed');
        return;
      }

      const mockPaymentId = `pay_${Date.now()}`;
      const resVerify = await fetch('/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          orderId: orderData.order.orderId,
          paymentId: mockPaymentId,
          signature: 'mock_sig_verified_flow_signature',
          paymentMethod: 'Razorpay UPI / Cards',
        }),
      });

      const verifyData = await resVerify.json();
      if (resVerify.ok) {
        alert(`Payment verified! License successfully upgraded.\nInvoice Number: ${verifyData.invoiceNumber}`);
        setShowUpgradeModal(false);
        await fetchSessionAndBusinesses();
        await loadDashboardData();
      } else {
        alert(verifyData.error || 'Payment verification failed');
      }
    } catch (err: any) {
      alert(err.message || 'Payment processing error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const getSentimentBadge = (sentiment: string) => {
    if (sentiment === 'GOOD') return <span className="badge badge-good"><ThumbsUp size={12} /> GOOD</span>;
    if (sentiment === 'OKAY') return <span className="badge badge-okay"><Meh size={12} /> OKAY</span>;
    return <span className="badge badge-poor"><ThumbsDown size={12} /> POOR</span>;
  };

  const renderDashboardContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: isMobileMode ? '16px' : '28px' }}>
      {/* 1. Header & Business Switcher */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: isMobileMode ? 20 : 26, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
              {selectedBusinessId === 'ALL'
                ? 'All Businesses'
                : businesses.find((b) => b.id === selectedBusinessId)?.name || 'Business Dashboard'}
            </h1>
            {user?.role === 'SUPER_ADMIN' && <span className="badge badge-primary">Super Admin</span>}
            {user?.role === 'SUPER_MANAGER' && <span className="badge badge-primary">Super Manager</span>}
            {user?.role === 'MANAGER' && <span className="badge badge-primary">Manager</span>}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {user?.role === 'OWNER'
              ? 'Multi-branch customer feedback, private reviews & QR standee management.'
              : `Scoped staff access for ${user?.name}`}
          </p>
        </div>

        {/* Business Switcher Dropdown & Add Business */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '4px 10px', boxShadow: 'var(--shadow-sm)' }}>
            <Layers size={16} color="#1E3A8A" style={{ marginRight: 8 }} />
            <select
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">✨ All Businesses ({businesses.length})</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  🏢 {b.name} ({b.branches?.length || 0} branches)
                </option>
              ))}
            </select>
          </div>

          {user?.role === 'OWNER' && (
            <button
              onClick={() => setShowAddBusinessModal(true)}
              className="btn btn-secondary btn-sm"
              title="Add a brand-new independent business anytime with no count limit"
            >
              <Plus size={14} color="#1E3A8A" />
              <span>Add Business</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. License Capacity Bar & Branch Quota Status in White & Navy */}
      {user?.role === 'OWNER' && license && (
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            background: license.warningLevel === 'EXPIRED' ? '#FEF2F2' : '#FFFFFF',
            borderColor: license.warningLevel === 'EXPIRED' ? '#FECACA' : 'var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CreditCard size={18} color="#1E3A8A" />
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0B192C' }}>{license.planName}</span>
                <span style={{ fontSize: 12, color: '#475569', marginLeft: 8 }}>
                  ({license.daysRemaining} days remaining · {license.isTrial ? 'Trial License' : 'Active Paid License'})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0B192C' }}>
                  {license.currentBranches} / {license.maxBranches} Branches Used
                </span>
                <span style={{ fontSize: 11, color: '#1E3A8A', display: 'block', fontWeight: 600 }}>
                  across all your {businesses.length} businesses
                </span>
              </div>

              <button
                onClick={() => setShowUpgradeModal(true)}
                className="btn btn-primary btn-sm"
              >
                Upgrade License
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: 8, background: '#E2E8F0', borderRadius: 9999, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, (license.currentBranches / Math.max(1, license.maxBranches)) * 100)}%`,
                height: '100%',
                background: license.currentBranches >= license.maxBranches ? 'var(--poor)' : 'var(--primary-gradient)',
                borderRadius: 9999,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* 3. Navigation Tabs in White & Navy */}
      {!isMobileMode && (
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
          {[
            { id: 'analytics', label: 'Analytics & Trends', icon: BarChart3 },
            { id: 'businesses', label: `Businesses & Branches (${displayedBranches.length})`, icon: Building2 },
            { id: 'forms', label: 'Review Design & Forms', icon: FileText },
            { id: 'qr', label: 'QR Codes & Standees', icon: QrIcon },
            { id: 'reviews', label: `Review Inbox (${reviews.length})`, icon: MessageSquare },
            { id: 'customers', label: `Customers (${customers.length})`, icon: Users },
            { id: 'team', label: `Team & Managers (${teamMembers.length})`, icon: Shield },
            { id: 'billing', label: 'License & Billing', icon: CreditCard },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: isActive ? '#FFFFFF' : 'transparent',
                  color: isActive ? '#1E3A8A' : '#64748B',
                  border: isActive ? '1px solid var(--border-strong)' : '1px solid transparent',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} color={isActive ? '#1E3A8A' : '#64748B'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* TAB A: ANALYTICS */}
      {activeTab === 'analytics' && analytics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobileMode ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
            <div className="glass-panel" style={{ padding: '18px 20px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Total Reviews</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0B192C', marginTop: 4 }}>
                {analytics.metrics.totalReviews}
              </div>
              <span style={{ fontSize: 11, color: '#059669', marginTop: 4, display: 'block', fontWeight: 600 }}>
                +{analytics.metrics.todaysReviews} submitted today
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '18px 20px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Average Rating</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#0B192C' }}>{analytics.metrics.avgRating}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <Star size={18} color="#D97706" fill="#F59E0B" />
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
                out of 5.0 scale
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '18px 20px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Good Feedback</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                {analytics.metrics.goodReviews}
              </div>
              <span style={{ fontSize: 11, color: '#059669', marginTop: 4, display: 'block', fontWeight: 600 }}>
                {analytics.distribution.goodPct}% positive satisfaction
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '18px 20px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Poor Reviews</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>
                {analytics.metrics.poorReviews}
              </div>
              <span style={{ fontSize: 11, color: '#DC2626', marginTop: 4, display: 'block', fontWeight: 600 }}>
                {analytics.distribution.poorPct}% triggered instant alerts
              </span>
            </div>
          </div>

          {/* Sentiment Distribution */}
          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0B192C', marginBottom: 12 }}>
              Customer Sentiment Distribution
            </h3>
            <div style={{ width: '100%', height: 16, background: '#E2E8F0', borderRadius: 9999, display: 'flex', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${analytics.distribution.goodPct}%`, background: '#059669' }} title={`Good: ${analytics.distribution.goodPct}%`} />
              <div style={{ width: `${analytics.distribution.okayPct}%`, background: '#D97706' }} title={`Okay: ${analytics.distribution.okayPct}%`} />
              <div style={{ width: `${analytics.distribution.poorPct}%`, background: '#DC2626' }} title={`Poor: ${analytics.distribution.poorPct}%`} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 12 }}>
              <span style={{ color: '#059669', fontWeight: 700 }}>● Good: {analytics.distribution.good} ({analytics.distribution.goodPct}%)</span>
              <span style={{ color: '#D97706', fontWeight: 700 }}>● Okay: {analytics.distribution.okay} ({analytics.distribution.okayPct}%)</span>
              <span style={{ color: '#DC2626', fontWeight: 700 }}>● Poor: {analytics.distribution.poor} ({analytics.distribution.poorPct}%)</span>
            </div>
          </div>

          {/* Branch Comparison Table */}
          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0B192C', marginBottom: 14 }}>
              Branch Performance Comparison
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748B' }}>
                    <th style={{ padding: '10px 12px' }}>Branch</th>
                    <th style={{ padding: '10px 12px' }}>Business</th>
                    <th style={{ padding: '10px 12px' }}>Total Reviews</th>
                    <th style={{ padding: '10px 12px' }}>Avg Rating</th>
                    <th style={{ padding: '10px 12px' }}>Good</th>
                    <th style={{ padding: '10px 12px' }}>Poor</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.branchComparison.map((bc: any) => (
                    <tr key={bc.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#0B192C' }}>{bc.name}</td>
                      <td style={{ padding: '12px', color: '#334155' }}>{bc.businessName}</td>
                      <td style={{ padding: '12px', color: '#64748B' }}>{bc.total}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#D97706' }}>★ {bc.avgRating}</td>
                      <td style={{ padding: '12px', color: '#059669', fontWeight: 600 }}>{bc.good}</td>
                      <td style={{ padding: '12px', color: '#DC2626', fontWeight: 600 }}>{bc.poor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: BUSINESSES & BRANCHES */}
      {activeTab === 'businesses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>Active Businesses & Branches</h2>
              <p style={{ fontSize: 13, color: '#64748B' }}>
                Total {displayedBranches.length} branches active across your portfolio.
              </p>
            </div>
            {user?.role === 'OWNER' && (
              <button
                onClick={() => {
                  setTargetBusinessIdForBranch(businesses[0]?.id || '');
                  setShowAddBranchModal(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={14} />
                <span>Add Branch</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {displayedBranches.map((br) => {
              const reviewUrl = `/review/${br.qrToken}`;
              return (
                <div key={br.id} className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase' }}>
                        {br.businessName}
                      </span>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0B192C', marginTop: 2 }}>{br.name}</h3>
                    </div>
                    <span className="badge badge-good" style={{ fontSize: 10 }}>ACTIVE</span>
                  </div>

                  <p style={{ fontSize: 13, color: '#475569', marginBottom: 16, minHeight: 38 }}>
                    {br.address}
                  </p>

                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      Token: <code style={{ color: '#1E3A8A', fontWeight: 600 }}>{br.qrToken.slice(0, 14)}...</code>
                    </div>
                    <button
                      onClick={() => handleRegenerateQr(br.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                      title="Regenerate unique QR token"
                    >
                      <RefreshCw size={12} color="#1E3A8A" />
                      <span>Regen</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={reviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <ExternalLink size={13} color="#1E3A8A" />
                      <span>Test QR Page</span>
                    </a>
                    <a
                      href={`/api/branches/${br.id}/artwork`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <Printer size={13} />
                      <span>Standee</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB C: QR CODES & STANDEES */}
      {activeTab === 'qr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>QR Studio & Printable Standees</h2>
            <p style={{ fontSize: 13, color: '#64748B' }}>
              High-resolution QR artwork configured for table tents, counters, and reception standees.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {displayedBranches.map((br) => {
              const reviewUrl = `/review/${br.qrToken}`;
              return (
                <div key={br.id} className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ background: `linear-gradient(135deg, ${br.themeColor || '#1E3A8A'}, #0B192C)`, borderRadius: 16, padding: '16px', color: '#FFFFFF', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.9 }}>{br.businessName}</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{br.name}</div>
                  </div>

                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16, display: 'inline-block', marginBottom: 16, boxShadow: 'var(--shadow-md)' }}>
                    {br.qrCodes && br.qrCodes[0]?.qrImageUrl ? (
                      <img src={br.qrCodes[0].qrImageUrl} alt="QR" style={{ width: 180, height: 180, display: 'block' }} />
                    ) : (
                      <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E3A8A' }}>
                        <QrIcon size={80} />
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
                    Scan with any phone camera to submit private direct feedback.
                  </p>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <a
                      href={`/api/branches/${br.id}/artwork`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      <Printer size={13} />
                      <span>Print Standee</span>
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}${reviewUrl}`);
                        alert('Review link copied to clipboard!');
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <span>Copy Link</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB D: REVIEWS INBOX */}
      {activeTab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '4px 10px', boxShadow: 'var(--shadow-sm)' }}>
                <Filter size={14} color="#1E3A8A" style={{ marginRight: 6 }} />
                <select
                  value={reviewFilterSentiment}
                  onChange={(e) => setReviewFilterSentiment(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#0B192C', fontSize: 12, fontWeight: 600, outline: 'none' }}
                >
                  <option value="ALL">All Sentiments</option>
                  <option value="GOOD">Good (4-5 Stars)</option>
                  <option value="OKAY">Okay (3 Stars)</option>
                  <option value="POOR">Poor (1-2 Stars / Alerts)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '4px 10px', boxShadow: 'var(--shadow-sm)' }}>
                <Search size={14} color="#64748B" style={{ marginRight: 6 }} />
                <input
                  type="text"
                  placeholder="Search customer name or phone..."
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#0B192C', fontSize: 12, outline: 'none', width: 180 }}
                />
              </div>
            </div>

            <a
              href={`/api/reviews/export?${selectedBusinessId !== 'ALL' ? `businessId=${selectedBusinessId}` : ''}`}
              className="btn btn-secondary btn-sm"
              download
            >
              <FileSpreadsheet size={14} color="#1E3A8A" />
              <span>Export CSV</span>
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.length === 0 ? (
              <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
                No customer reviews match your criteria.
              </div>
            ) : (
              reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="glass-panel"
                  style={{
                    padding: '18px 20px',
                    borderColor: rev.sentiment === 'POOR' ? 'var(--poor-border)' : 'var(--border-subtle)',
                    background: rev.sentiment === 'POOR' ? '#FEF2F2' : '#FFFFFF',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {getSentimentBadge(rev.sentiment)}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#D97706', fontWeight: 800, fontSize: 14 }}>
                        <Star size={16} fill="#F59E0B" />
                        <span>{rev.rating}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0B192C' }}>{rev.customer.name}</span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>({rev.customer.mobile})</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#64748B' }}>
                        {new Date(rev.createdAt).toLocaleDateString()} {new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`badge ${rev.status === 'RESOLVED' ? 'badge-good' : 'badge-primary'}`} style={{ fontSize: 10 }}>
                        {rev.status}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: '#1E3A8A', marginBottom: 12, fontWeight: 600 }}>
                    📍 <strong>{rev.business.name}</strong> — {rev.branch.name}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                    {rev.answers.map((ans, aIdx) => (
                      <div key={aIdx} style={{ fontSize: 12, display: 'flex', gap: 8 }}>
                        <span style={{ color: '#64748B' }}>{ans.questionText}:</span>
                        <strong style={{ color: ans.classification === 'POOR' ? '#DC2626' : '#0B192C' }}>{ans.answerText}</strong>
                      </div>
                    ))}
                  </div>

                  {rev.notes && (
                    <div style={{ fontSize: 12, color: '#059669', background: '#ECFDF5', padding: '6px 10px', borderRadius: 8, marginBottom: 10, border: '1px solid #A7F3D0' }}>
                      <strong>Resolution Note:</strong> {rev.notes}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {rev.status !== 'RESOLVED' && (
                      <button
                        onClick={() => {
                          setSelectedReviewForModal(rev);
                          setReviewResolutionNotes(rev.notes || '');
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <CheckCircle2 size={13} color="#059669" />
                        <span>Resolve Review</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB E: CUSTOMERS */}
      {activeTab === 'customers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>Customer Directory</h2>
              <p style={{ fontSize: 13, color: '#64748B' }}>Verified visitors who submitted reviews across your locations.</p>
            </div>
            <a href="/api/customers/export" className="btn btn-secondary btn-sm" download>
              <Download size={14} color="#1E3A8A" />
              <span>Export Customers</span>
            </a>
          </div>

          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border-subtle)', color: '#64748B' }}>
                  <th style={{ padding: '12px 16px' }}>Customer Name</th>
                  <th style={{ padding: '12px 16px' }}>Mobile Number</th>
                  <th style={{ padding: '12px 16px' }}>Total Reviews</th>
                  <th style={{ padding: '12px 16px' }}>Last Visited</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0B192C' }}>{c.name}</td>
                    <td style={{ padding: '14px 16px', color: '#334155' }}>{c.mobile}</td>
                    <td style={{ padding: '14px 16px', color: '#1E3A8A', fontWeight: 800 }}>{c.totalReviews} visits</td>
                    <td style={{ padding: '14px 16px', color: '#64748B' }}>{new Date(c.lastVisitAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB F: TEAM & MANAGERS */}
      {activeTab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>Team & Delegated Managers</h2>
              <p style={{ fontSize: 13, color: '#64748B' }}>
                Create Managers (single branch) or Super Managers (multi-branch access) with strictly enforced server-side scoping.
              </p>
            </div>
            {user?.role === 'OWNER' && (
              <button onClick={() => setShowCreateTeamModal(true)} className="btn btn-primary btn-sm">
                <Plus size={14} />
                <span>Create Manager</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {teamMembers.map((tm) => (
              <div key={tm.id} className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0B192C' }}>{tm.name}</h3>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{tm.email} · @{tm.username}</div>
                  </div>
                  <span className="badge badge-primary">{tm.role}</span>
                </div>

                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                  <strong>Assigned Access:</strong>
                  <ul style={{ paddingLeft: 18, marginTop: 4, color: '#334155' }}>
                    {tm.assignments?.map((a: any, idx: number) => (
                      <li key={idx}>
                        {a.businessName} → <strong style={{ color: '#1E3A8A' }}>{a.branchName}</strong>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 10 }}>
                  <span className="badge" style={{ background: '#F1F5F9', color: '#1E3A8A' }}>VIEW_REVIEWS</span>
                  <span className="badge" style={{ background: '#F1F5F9', color: '#1E3A8A' }}>RECEIVE_ALERTS</span>
                  <span className="badge" style={{ background: '#F1F5F9', color: '#1E3A8A' }}>EXPORT_DATA</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB G: BILLING & LICENSE PLANS */}
      {activeTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>ReviewFlow License Plans</h2>
            <p style={{ fontSize: 13, color: '#64748B' }}>
              Your license controls the TOTAL NUMBER OF BRANCHES across ALL your businesses. Unlimited businesses are always permitted!
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(3, 1fr)', gap: 20 }}>
            {plans.map((p) => {
              const isCurrent = license?.planName === p.name;
              return (
                <div
                  key={p.id}
                  className="glass-panel"
                  style={{
                    padding: '28px 24px',
                    borderColor: isCurrent ? 'var(--primary)' : 'var(--border-subtle)',
                    background: isCurrent ? '#EFF6FF' : '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {isCurrent && (
                      <span className="badge badge-primary" style={{ marginBottom: 12 }}>
                        Current Active Plan
                      </span>
                    )}
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0B192C', marginBottom: 6 }}>{p.name}</h3>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#1E3A8A', marginBottom: 16 }}>
                      {p.price === 0 ? 'Free' : `₹${p.price.toLocaleString()}`}
                      <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}> / {p.durationDays} days</span>
                    </div>

                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#1E3A8A' }}>
                        Up to {p.maxBranches} Total Branches
                      </span>
                      <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        Deploy across unlimited separate businesses!
                      </p>
                    </div>

                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                      {p.featuresList?.map((f: string, fIdx: number) => (
                        <li key={fIdx} style={{ fontSize: 13, color: '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Check size={14} color="#059669" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleUpgradePlan(p.id)}
                    disabled={isCurrent}
                    className={`btn ${isCurrent ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ width: '100%' }}
                  >
                    {isCurrent ? 'Current Plan' : `Upgrade to ${p.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB H: REVIEW DESIGN & FORMS */}
      {activeTab === 'forms' && (
        <FormManager businesses={businesses} selectedBusinessId={selectedBusinessId} />
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header style={{ height: 64, borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 800, fontSize: 16 }}>
            RF
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-main)' }}>
            ReviewFlow
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setIsMobileMode(!isMobileMode)}
            className="btn btn-secondary btn-sm"
            title="Toggle between Desktop Dashboard and Android/iOS Mobile Business App mode"
          >
            {isMobileMode ? <Laptop size={14} color="#1E3A8A" /> : <Smartphone size={14} color="#1E3A8A" />}
            <span>{isMobileMode ? 'Desktop View' : 'Mobile App Mode'}</span>
          </button>

          {/* Notifications Bell */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
              style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1E3A8A', position: 'relative', boxShadow: 'var(--shadow-sm)' }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: '50%', background: '#DC2626', color: '#FFFFFF', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse-poor 2s infinite' }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotificationsDropdown && (
              <div
                className="glass-panel"
                style={{ position: 'absolute', right: 0, top: 44, width: 320, maxHeight: 380, overflowY: 'auto', padding: 16, zIndex: 200, background: '#FFFFFF', boxShadow: 'var(--shadow-lg)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0B192C' }}>Notifications</span>
                  <span style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 700 }}>{unreadCount} unread</span>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', padding: '16px 0' }}>No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: n.type === 'POOR_REVIEW' ? '#DC2626' : '#0B192C' }}>{n.title}</div>
                      <div style={{ color: '#334155', marginTop: 2 }}>{n.body}</div>
                      <div style={{ color: '#64748B', fontSize: 10, marginTop: 4 }}>{new Date(n.createdAt).toLocaleTimeString()}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* User profile & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 8, borderLeft: '1px solid var(--border-subtle)' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0B192C' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 600 }}>{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 10px' }}
              title="Sign out"
            >
              <LogOut size={14} color="#64748B" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main style={{ flex: 1, display: 'flex', justifyContent: isMobileMode ? 'center' : 'stretch', padding: isMobileMode ? '30px 10px' : 0 }}>
        {isMobileMode ? (
          <div className="mobile-simulator-frame">
            <div className="mobile-notch" />
            <div className="mobile-app-screen">
              <div style={{ height: 32 }} />
              {renderDashboardContent()}
              <div style={{ height: 68 }} />
            </div>

            <div className="mobile-bottom-nav">
              <button
                className={`nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <BarChart3 size={18} />
                <span>Overview</span>
              </button>
              <button
                className={`nav-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
                onClick={() => setActiveTab('reviews')}
              >
                <MessageSquare size={18} />
                <span>Reviews</span>
              </button>
              <button
                className={`nav-tab-btn ${activeTab === 'businesses' ? 'active' : ''}`}
                onClick={() => setActiveTab('businesses')}
              >
                <Building2 size={18} />
                <span>Branches</span>
              </button>
              <button
                className={`nav-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
                onClick={() => setActiveTab('qr')}
              >
                <QrIcon size={18} />
                <span>QR Codes</span>
              </button>
              <button
                className={`nav-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
                onClick={() => setActiveTab('billing')}
              >
                <CreditCard size={18} />
                <span>License</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 1280, margin: '0 auto' }}>
            {renderDashboardContent()}
          </div>
        )}
      </main>

      {/* LIVE POOR REVIEW ALERT MODAL / TOAST */}
      {liveAlert && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, maxWidth: 400, animation: 'slideUp 0.3s ease' }}>
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              background: '#FFFFFF',
              border: '2px solid #DC2626',
              boxShadow: '0 10px 40px rgba(220, 38, 38, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626', fontWeight: 800, fontSize: 15 }}>
                <AlertTriangle size={20} />
                <span>POOR REVIEW ALERT</span>
              </div>
              <button
                onClick={() => setLiveAlert(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#0B192C', marginBottom: 12, lineHeight: 1.5 }}>
              {liveAlert.body}
            </p>
            {liveAlert.metadata && (
              <div style={{ fontSize: 12, color: '#334155', background: '#FEF2F2', border: '1px solid #FECACA', padding: 10, borderRadius: 8, marginBottom: 14 }}>
                <div><strong>Customer:</strong> {liveAlert.metadata.customerName} ({liveAlert.metadata.customerMobile})</div>
                <div><strong>Rating:</strong> ★ {liveAlert.metadata.rating} / 5.0</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setActiveTab('reviews');
                  setLiveAlert(null);
                }}
                className="btn btn-primary btn-sm"
                style={{ width: '100%' }}
              >
                View Review in Inbox
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD BUSINESS */}
      {showAddBusinessModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>Add New Business</h3>
              <button onClick={() => setShowAddBusinessModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
              You can create unlimited independent businesses under your account. Each business has its own branches, review forms, and QR codes.
            </p>
            <form onSubmit={handleCreateBusiness}>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Business Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Royal Horizon Spa"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Category *</label>
                <select
                  className="input-field"
                  value={newBizCategory}
                  onChange={(e) => setNewBizCategory(e.target.value)}
                >
                  <option value="Restaurant & Dining">Restaurant & Dining</option>
                  <option value="Hotel & Hospitality">Hotel & Hospitality</option>
                  <option value="Salon & Spa">Salon & Spa</option>
                  <option value="Healthcare & Clinic">Healthcare & Clinic</option>
                  <option value="Retail & Shopping">Retail & Shopping</option>
                  <option value="Automotive & Services">Automotive & Services</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Description</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Brief tagline or specialty..."
                  value={newBizDesc}
                  onChange={(e) => setNewBizDesc(e.target.value)}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 24 }}>
                <label className="input-label" style={{ color: '#0B192C' }}>Contact Phone</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="+91 9820011223"
                  value={newBizPhone}
                  onChange={(e) => setNewBizPhone(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Create Business
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BRANCH */}
      {showAddBranchModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>Add New Branch</h3>
              <button onClick={() => setShowAddBranchModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {branchCreationError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px', color: '#B91C1C', fontSize: 13, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <AlertTriangle size={18} />
                  <span>{branchCreationError}</span>
                </div>
                {branchCreationError.includes('Branch limit reached') && (
                  <button
                    onClick={() => {
                      setShowAddBranchModal(false);
                      setShowUpgradeModal(true);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Upgrade License Now
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleCreateBranch}>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Select Business *</label>
                <select
                  className="input-field"
                  value={targetBusinessIdForBranch}
                  onChange={(e) => setTargetBusinessIdForBranch(e.target.value)}
                  required
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Branch Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Phoenix Mall Branch"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Address *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Full physical street location"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Theme Color</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {['#1E3A8A', '#2563EB', '#059669', '#DC2626', '#7C3AED', '#D97706'].map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setNewBranchColor(c)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: c,
                        border: newBranchColor === c ? '3px solid #0B192C' : 'none',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
                Verify Quota & Create Branch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESOLVE REVIEW */}
      {selectedReviewForModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>Resolve Feedback</h3>
              <button onClick={() => setSelectedReviewForModal(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: '#334155', marginBottom: 16 }}>
              Customer: <strong>{selectedReviewForModal.customer.name}</strong> ({selectedReviewForModal.customer.mobile})
            </p>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label className="input-label" style={{ color: '#0B192C' }}>Resolution Actions & Internal Notes</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="e.g. Contacted customer, apologized for delayed order, offered 20% discount on next visit."
                value={reviewResolutionNotes}
                onChange={(e) => setReviewResolutionNotes(e.target.value)}
              />
            </div>
            <button onClick={handleResolveReview} className="btn btn-primary" style={{ width: '100%' }}>
              Mark as Resolved
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TEAM MEMBER */}
      {showCreateTeamModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>Create Staff User</h3>
              <button onClick={() => setShowCreateTeamModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateTeamMember}>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Full Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Suresh Nair"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Email *</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="suresh@example.com"
                  value={newTeamEmail}
                  onChange={(e) => setNewTeamEmail(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Username *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="suresh"
                  value={newTeamUsername}
                  onChange={(e) => setNewTeamUsername(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Role *</label>
                <select
                  className="input-field"
                  value={newTeamRole}
                  onChange={(e) => setNewTeamRole(e.target.value as any)}
                >
                  <option value="MANAGER">Manager (Single Branch)</option>
                  <option value="SUPER_MANAGER">Super Manager (Multi-Branch Access)</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>Business Assignment</label>
                <select
                  className="input-field"
                  value={newTeamBusinessId}
                  onChange={(e) => setNewTeamBusinessId(e.target.value)}
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
                Save Team User
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPGRADE LICENSE */}
      {showUpgradeModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C' }}>Upgrade License Capacity</h3>
              <button onClick={() => setShowUpgradeModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
              Select a capacity plan to expand your total branch capacity across all owned businesses.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {plans.map((p) => (
                <div key={p.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0B192C' }}>{p.name}</h4>
                    <span style={{ fontSize: 12, color: '#1E3A8A', fontWeight: 600 }}>Up to {p.maxBranches} Branches</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0B192C', marginTop: 4 }}>₹{p.price.toLocaleString()} / year</div>
                  </div>
                  <button onClick={() => handleUpgradePlan(p.id)} className="btn btn-primary btn-sm">
                    Select & Pay
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
