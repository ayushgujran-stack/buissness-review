'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ArrowRight, ShieldCheck, Sparkles, AlertCircle, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Force password change state
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  const handleLogin = async (overrideLogin?: string, overridePassword?: string) => {
    const userToLogin = overrideLogin || login;
    const passToLogin = overridePassword || password;

    if (!userToLogin || !passToLogin) {
      setError('Please provide username/email and password');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: userToLogin, password: passToLogin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        setLoading(false);
        return;
      }

      if (data.user?.mustChangePassword) {
        setShowPasswordChangeModal(true);
        setLoading(false);
        return;
      }

      routeUserByRole(data.user?.role);
    } catch {
      setError('Connection failure. Please check your local server.');
      setLoading(false);
    }
  };

  const routeUserByRole = (role?: string) => {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      router.push('/admin/super');
    } else {
      router.push('/dashboard');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);

    if (newPassword.length < 6) {
      setPasswordChangeError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match');
      return;
    }

    try {
      setPasswordChangeLoading(true);
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordChangeError(data.error || 'Failed to update password');
        setPasswordChangeLoading(false);
        return;
      }

      setShowPasswordChangeModal(false);
      router.push('/admin/super');
    } catch {
      setPasswordChangeError('An unexpected error occurred.');
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 15%, #F0F4F8 0%, #FFFFFF 100%)', padding: 20 }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '8px 18px', borderRadius: 9999, marginBottom: 14 }}>
            <Sparkles size={16} color="#1E3A8A" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1E3A8A', letterSpacing: '0.5px' }}>REVIEWFLOW SaaS</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0B192C', letterSpacing: '-0.5px', marginBottom: 6 }}>
            Welcome Back
          </h1>
          <p style={{ fontSize: 14, color: '#334155' }}>
            Turn Customer Feedback Into Better Business.
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel" style={{ padding: '32px 28px', background: '#FFFFFF', border: '1px solid #CBD5E1', boxShadow: 'var(--shadow-lg)' }}>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 14px', color: '#B91C1C', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div className="input-group">
              <label className="input-label" style={{ color: '#0B192C' }}>Username or Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: 38 }}
                  placeholder="e.g. raj or admin"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  required
                />
                <User size={16} color="#64748B" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 24 }}>
              <label className="input-label" style={{ color: '#0B192C' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="input-field"
                  style={{ paddingLeft: 38 }}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock size={16} color="#64748B" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: 15 }}
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In to ReviewFlow</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* 1-Click Fast Persona Switcher */}
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, textAlign: 'center' }}>
              ⚡ 1-Click Demo Login Personas
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => { setLogin('admin'); setPassword('admin123'); handleLogin('admin', 'admin123'); }}
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px' }}
              >
                <span style={{ fontWeight: 700, color: '#DC2626', fontSize: 12 }}>Super Admin</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>admin / admin123</span>
              </button>

              <button
                type="button"
                onClick={() => { setLogin('raj'); setPassword('password123'); handleLogin('raj', 'password123'); }}
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px' }}
              >
                <span style={{ fontWeight: 700, color: '#1E3A8A', fontSize: 12 }}>Owner (Raj)</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>raj / password123</span>
              </button>

              <button
                type="button"
                onClick={() => { setLogin('john'); setPassword('manager123'); handleLogin('john', 'manager123'); }}
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px' }}
              >
                <span style={{ fontWeight: 700, color: '#0284C7', fontSize: 12 }}>Super Manager</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>john / manager123</span>
              </button>

              <button
                type="button"
                onClick={() => { setLogin('priya'); setPassword('manager123'); handleLogin('priya', 'manager123'); }}
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px' }}
              >
                <span style={{ fontWeight: 700, color: '#059669', fontSize: 12 }}>Branch Manager</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>priya / manager123</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security footnote */}
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ShieldCheck size={14} color="#059669" />
          <span>Server-enforced RBAC & Multi-tenant data isolation</span>
        </div>
      </div>

      {/* Mandatory First-Login Password Change Modal */}
      {showPasswordChangeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E3A8A' }}>
                <KeyRound size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0B192C' }}>First-Time Login Security</h3>
                <p style={{ fontSize: 13, color: '#334155' }}>Please set a new secure password for your Super Admin account.</p>
              </div>
            </div>

            {passwordChangeError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px', color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                {passwordChangeError}
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div className="input-group">
                <label className="input-label" style={{ color: '#0B192C' }}>New Password</label>
                <input
                  type="password"
                  className="input-field"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: 24 }}>
                <label className="input-label" style={{ color: '#0B192C' }}>Confirm New Password</label>
                <input
                  type="password"
                  className="input-field"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={passwordChangeLoading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                {passwordChangeLoading ? 'Updating password...' : 'Save Password & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
