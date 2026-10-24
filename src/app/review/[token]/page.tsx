'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Star,
  ThumbsUp,
  Meh,
  ThumbsDown,
  CheckCircle,
  AlertCircle,
  Building2,
  MapPin,
  Send,
  ShieldCheck,
  Heart,
  HelpCircle,
} from 'lucide-react';

interface QuestionOption {
  id: string;
  text: string;
  value: string;
}

interface Question {
  id: string;
  text: string;
  description?: string;
  type: 'STAR_RATING' | 'GOOD_OKAY_POOR' | 'MULTIPLE_CHOICE' | 'YES_NO' | 'TEXT';
  required: boolean;
  positiveValue?: string;
  options: QuestionOption[];
}

interface BranchInfo {
  id: string;
  name: string;
  address: string;
  description?: string;
  themeColor: string;
  businessName: string;
  businessCategory: string;
  businessLogoUrl?: string;
}

interface FormInfo {
  id: string;
  title: string;
  description?: string;
  welcomeMessage?: string;
  thankYouMessage?: string;
  submitButtonText?: string;
  privacyNotice?: string;
  designSettings?: any;
  customerFieldSettings?: any;
  questions: Question[];
}

export const dynamic = 'force-dynamic';

export default function CustomerReviewPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [form, setForm] = useState<FormInfo | null>(null);

  // Customer input
  const [answers, setAnswers] = useState<Record<string, { answerText: string; numericValue?: number }>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [thankYouText, setThankYouText] = useState('');

  useEffect(() => {
    async function loadReviewPage() {
      if (!token) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/public/review/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Review portal unavailable');
          if (data.isUnavailable) {
            setIsUnavailable(true);
          }
          setLoading(false);
          return;
        }

        setBranch(data.branch);
        setForm(data.form);

        const initAnswers: Record<string, { answerText: string; numericValue?: number }> = {};
        for (const q of data.form.questions || []) {
          if (q.type === 'STAR_RATING') {
            initAnswers[q.id] = { answerText: '5 Stars', numericValue: 5 };
          }
        }
        setAnswers(initAnswers);
      } catch {
        setError('Failed to connect to review service. Please check your network connection.');
      } finally {
        setLoading(false);
      }
    }

    loadReviewPage();
  }, [token]);

  const handleAnswerChange = (questionId: string, answerText: string, numericValue?: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { answerText, numericValue },
    }));
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const questions = form?.questions || [];
    const customerFields = form?.customerFieldSettings || {};
    const requireName = customerFields.nameRequired !== false;
    const requireMobile = customerFields.mobileRequired !== false;

    if (requireName && !customerName.trim()) {
      setValidationError('Please enter your full name');
      return;
    }

    if (requireMobile && (!customerMobile.trim() || customerMobile.trim().length < 8)) {
      setValidationError('Please provide a valid mobile number');
      return;
    }

    for (const q of questions) {
      if (q.required && (!answers[q.id] || !answers[q.id].answerText || !answers[q.id].answerText.trim())) {
        setValidationError(`Please answer: "${q.text}"`);
        return;
      }
    }

    try {
      setSubmitting(true);

      const formattedAnswers = questions.map((q) => {
        const userAns = answers[q.id] || { answerText: '', numericValue: undefined };
        return {
          questionId: q.id,
          questionText: q.text,
          questionType: q.type,
          answerText: userAns.answerText || '',
          numericValue: userAns.numericValue,
        };
      });

      const res = await fetch(`/api/public/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerMobile,
          customerEmail,
          answers: formattedAnswers,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setValidationError(result.error || 'Submission failed');
        setSubmitting(false);
        return;
      }

      setThankYouText(result.message || form?.thankYouMessage || 'Thank you for your valuable feedback!');
      setSubmitted(true);
    } catch {
      setValidationError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const themeColor = form?.designSettings?.primaryColor || branch?.themeColor || '#1E3A8A';
  const bgColor = form?.designSettings?.backgroundColor || '#F8FAFC';
  const buttonStyle = form?.designSettings?.buttonStyle || 'rounded';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '3px solid #E2E8F0',
              borderTopColor: '#1E3A8A',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px auto',
            }}
          />
          <div style={{ fontWeight: 700, color: '#0B192C' }}>Loading feedback portal...</div>
        </div>
      </div>
    );
  }

  if (error || !branch || !form) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 20 }}>
        <div style={{ maxWidth: 460, width: '100%', background: '#FFFFFF', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: '#DC2626' }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0B192C', margin: 0 }}>Portal Unavailable</h2>
          <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.5, marginTop: 8 }}>
            {error || 'This branch is currently not accepting new customer feedback.'}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bgColor, padding: 20 }}>
        <div style={{ maxWidth: 480, width: '100%', background: '#FFFFFF', borderRadius: 20, padding: 36, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: '#059669' }}>
            <CheckCircle size={38} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0B192C', margin: 0 }}>Feedback Received</h2>
          <p style={{ fontSize: 14.5, color: '#475569', lineHeight: 1.6, marginTop: 12 }}>
            {thankYouText}
          </p>
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #F1F5F9', fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ShieldCheck size={14} color="#059669" />
            <span>Private feedback securely routed to management</span>
          </div>
        </div>
      </div>
    );
  }

  const questions = form.questions || [];
  const customerFields = form.customerFieldSettings || {};

  return (
    <div style={{ minHeight: '100vh', background: bgColor, padding: '24px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 540 }}>
        {/* Header Card */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px 20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', textAlign: 'center' }}>
          {branch.businessLogoUrl && (
            <img
              src={branch.businessLogoUrl}
              alt={branch.businessName}
              style={{ maxHeight: 54, maxWidth: 160, objectFit: 'contain', margin: '0 auto 12px auto' }}
            />
          )}
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: themeColor, letterSpacing: '0.05em' }}>
            {branch.businessName}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0B192C', margin: '4px 0 0 0' }}>
            {form.title}
          </h1>
          {form.description && (
            <p style={{ fontSize: 13, color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
              {form.description}
            </p>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F8FAFC', padding: '4px 10px', borderRadius: 12, fontSize: 11.5, color: '#64748B', marginTop: 10 }}>
            <MapPin size={12} color={themeColor} />
            <span>{branch.name} — {branch.address}</span>
          </div>
        </div>

        {/* Welcome Message */}
        {form.welcomeMessage && (
          <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1E3A8A', lineHeight: 1.4 }}>
            {form.welcomeMessage}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {questions.map((q, idx) => {
              const currentAns = answers[q.id];

              return (
                <div
                  key={q.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 14,
                    padding: '20px 18px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    border: '1px solid #F1F5F9',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0B192C', lineHeight: 1.35 }}>
                      <span style={{ color: themeColor, marginRight: 6 }}>{idx + 1}.</span>
                      {q.text}
                      {q.required && <span style={{ color: '#DC2626', marginLeft: 4 }}>*</span>}
                    </div>
                  </div>

                  {q.description && (
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                      {q.description}
                    </div>
                  )}

                  {/* 1. STAR RATING */}
                  {q.type === 'STAR_RATING' && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '10px 0' }}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isSelected = (currentAns?.numericValue || 0) >= star;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleAnswerChange(q.id, `${star} Stars`, star)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 4,
                              transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                              transition: 'transform 0.15s ease',
                            }}
                          >
                            <Star
                              size={34}
                              fill={isSelected ? '#F59E0B' : '#E2E8F0'}
                              color={isSelected ? '#F59E0B' : '#CBD5E1'}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. GOOD / OKAY / POOR */}
                  {q.type === 'GOOD_OKAY_POOR' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {[
                        { label: 'Good', icon: ThumbsUp, color: '#059669', bg: '#ECFDF5' },
                        { label: 'Okay', icon: Meh, color: '#D97706', bg: '#FFFBEB' },
                        { label: 'Poor', icon: ThumbsDown, color: '#DC2626', bg: '#FEF2F2' },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = currentAns?.answerText?.toUpperCase() === item.label.toUpperCase();
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleAnswerChange(q.id, item.label)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              padding: '12px 8px',
                              borderRadius: 10,
                              border: isSelected ? `2px solid ${item.color}` : '1px solid #E2E8F0',
                              background: isSelected ? item.bg : '#F8FAFC',
                              cursor: 'pointer',
                            }}
                          >
                            <Icon size={22} color={item.color} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0B192C', marginTop: 6 }}>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. YES / NO */}
                  {q.type === 'YES_NO' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {['Yes', 'No'].map((opt) => {
                        const isSelected = currentAns?.answerText?.toLowerCase() === opt.toLowerCase();
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleAnswerChange(q.id, opt)}
                            style={{
                              padding: '12px',
                              borderRadius: 10,
                              border: isSelected ? `2px solid ${themeColor}` : '1px solid #E2E8F0',
                              background: isSelected ? '#EFF6FF' : '#F8FAFC',
                              fontSize: 14,
                              fontWeight: 700,
                              color: isSelected ? themeColor : '#0B192C',
                              cursor: 'pointer',
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 4. MULTIPLE CHOICE */}
                  {q.type === 'MULTIPLE_CHOICE' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.options.map((opt) => {
                        const isSelected = currentAns?.answerText === opt.text;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleAnswerChange(q.id, opt.text)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 14px',
                              borderRadius: 8,
                              border: isSelected ? `2px solid ${themeColor}` : '1px solid #E2E8F0',
                              background: isSelected ? '#EFF6FF' : '#F8FAFC',
                              textAlign: 'left',
                              fontSize: 13.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? themeColor : '#0B192C',
                              cursor: 'pointer',
                            }}
                          >
                            <span>{opt.text}</span>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                border: isSelected ? `5px solid ${themeColor}` : '2px solid #CBD5E1',
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 5. TEXT COMMENT */}
                  {q.type === 'TEXT' && (
                    <textarea
                      rows={3}
                      placeholder="Share your thoughts..."
                      value={currentAns?.answerText || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        fontSize: 13.5,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* Customer Details Card */}
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0B192C', marginBottom: 12 }}>
                Your Contact Information
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {customerFields.nameRequired !== false && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13.5, boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {customerFields.mobileRequired !== false && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={customerMobile}
                      onChange={(e) => setCustomerMobile(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13.5, boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {customerFields.emailEnabled && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="alex@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13.5, boxSizing: 'border-box' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                {validationError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: buttonStyle === 'pill' ? 30 : buttonStyle === 'square' ? 4 : 10,
                border: 'none',
                background: themeColor,
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)',
              }}
            >
              <Send size={16} />
              <span>{submitting ? 'Submitting Feedback...' : form.submitButtonText || 'Submit Feedback'}</span>
            </button>

            {/* Privacy notice */}
            <div style={{ textAlign: 'center', fontSize: 11.5, color: '#94A3B8', marginTop: 8 }}>
              {form.privacyNotice || 'Your feedback is private and protected by ReviewFlow.'}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
