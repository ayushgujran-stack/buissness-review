'use client';

import React from 'react';
import Link from 'next/link';
import {
  QrCode,
  Building2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Printer,
  Shield,
  EyeOff,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', color: 'var(--text-main)', overflowX: 'hidden' }}>
      {/* Top Navigation */}
      <nav style={{ height: 72, borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 800, fontSize: 18, boxShadow: '0 4px 14px var(--primary-glow)' }}>
            RF
          </div>
          <div>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-main)' }}>ReviewFlow</span>
            <span style={{ fontSize: 11, color: 'var(--text-navy)', display: 'block', fontWeight: 600 }}>Turn Feedback Into Better Business</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link
            href="/review/rf_royal_spice_main_101"
            className="btn btn-secondary btn-sm"
            target="_blank"
          >
            <QrCode size={14} color="#1E3A8A" />
            <span>Try Sample QR Review</span>
          </Link>
          <Link href="/login" className="btn btn-primary btn-sm">
            <span>Sign In / Demo Login</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '70px 24px 50px', textAlign: 'center', position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '6px 18px', borderRadius: 9999, marginBottom: 24 }}>
          <Sparkles size={16} color="#1E3A8A" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1E3A8A' }}>Next-Gen Multi-Tenant Private Review Platform</span>
        </div>

        <h1 style={{ fontSize: 'clamp(36px, 5vw, 62px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.15, marginBottom: 20, color: '#0B192C' }}>
          Turn Customer Feedback<br />
          <span style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Into Better Business.
          </span>
        </h1>

        <p style={{ maxWidth: 680, margin: '0 auto 36px', fontSize: 18, color: '#334155', lineHeight: 1.6 }}>
          ReviewFlow provides private QR-based feedback terminal solutions for restaurants, hotels, salons, and multi-branch retail businesses. Prevent public review damage with real-time alerts.
        </p>

        {/* Action CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginBottom: 50 }}>
          <Link href="/login" className="btn btn-gradient" style={{ padding: '16px 28px', fontSize: 16 }}>
            <span>Open Business Dashboard</span>
            <ArrowRight size={18} />
          </Link>
          <Link href="/review/rf_royal_spice_main_101" className="btn btn-secondary" style={{ padding: '16px 24px', fontSize: 16 }} target="_blank">
            <QrCode size={18} color="#1E3A8A" />
            <span>Scan Live Customer QR</span>
          </Link>
          <Link href="/login" className="btn btn-secondary" style={{ padding: '16px 24px', fontSize: 16 }}>
            <Shield size={18} color="#1E3A8A" />
            <span>Super Admin Portal</span>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, textAlign: 'left', marginTop: 40 }}>
          <div className="glass-panel" style={{ padding: 28 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E3A8A', marginBottom: 18 }}>
              <Building2 size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0B192C', marginBottom: 8 }}>Unlimited Businesses</h3>
            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
              One owner account can operate unlimited independent businesses. The license only governs total branch capacity across all your ventures.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: 28 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', marginBottom: 18 }}>
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0B192C', marginBottom: 8 }}>Instant Poor-Review Alerts</h3>
            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
              When a guest submits a poor rating (1-2 stars or negative sentiment), owners and branch managers receive immediate push alerts to resolve issues instantly.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: 28 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', marginBottom: 18 }}>
              <EyeOff size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0B192C', marginBottom: 8 }}>100% Private & Frictionless</h3>
            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
              Customers don&apos;t need an app, login, or OTP. They simply scan the QR standee, provide genuine answers, and enter name + mobile number.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: 28 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', marginBottom: 18 }}>
              <Printer size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0B192C', marginBottom: 8 }}>QR Standee Artwork Generator</h3>
            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
              Auto-generate beautiful, print-ready table tents and counter standees customized with your brand logo, colors, and unique branch QR token.
            </p>
          </div>
        </div>
      </section>

      {/* Demo Credentials Footer Banner */}
      <section style={{ maxWidth: 960, margin: '30px auto 70px', padding: '0 24px' }}>
        <div className="glass-panel" style={{ padding: 32, background: '#FFFFFF', border: '1px solid #CBD5E1', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0B192C', marginBottom: 6 }}>
              ⚡ Pre-configured Demo Accounts
            </h2>
            <p style={{ fontSize: 13, color: '#334155' }}>
              Test ReviewFlow immediately using any of these roles:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, fontSize: 13 }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, color: '#DC2626' }}>Super Admin</div>
              <div style={{ color: '#0B192C', fontWeight: 600, marginTop: 4 }}>admin / admin123</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Platform governance & licenses</div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, color: '#1E3A8A' }}>Owner (Raj)</div>
              <div style={{ color: '#0B192C', fontWeight: 600, marginTop: 4 }}>raj / password123</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>3 businesses, 6 branches, 20 capacity</div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, color: '#0284C7' }}>Super Manager</div>
              <div style={{ color: '#0B192C', fontWeight: 600, marginTop: 4 }}>john / manager123</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Multi-branch authorized staff</div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, color: '#059669' }}>Branch Manager</div>
              <div style={{ color: '#0B192C', fontWeight: 600, marginTop: 4 }}>priya / manager123</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Single branch authorized staff</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', background: '#FFFFFF', padding: '24px', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
        ReviewFlow SaaS · Turn Customer Feedback Into Better Business · White & Navy Blue Edition
      </footer>
    </div>
  );
}
