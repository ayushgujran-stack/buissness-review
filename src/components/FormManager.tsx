'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit3,
  Copy,
  Archive,
  Play,
  Pause,
  GitBranch,
  Eye,
  Trash2,
  Check,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Star,
  ThumbsUp,
  ThumbsDown,
  Meh,
  CheckCircle2,
  X,
  Palette,
  Settings2,
  HelpCircle,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Building2,
  Save,
  ArrowRight,
} from 'lucide-react';

interface QuestionOption {
  id?: string;
  text: string;
  value: string;
  scoreClassification: 'GOOD' | 'OKAY' | 'POOR' | 'NEUTRAL';
  displayOrder?: number;
}

interface Question {
  id?: string;
  text: string;
  description?: string;
  type: 'STAR_RATING' | 'GOOD_OKAY_POOR' | 'MULTIPLE_CHOICE' | 'YES_NO' | 'TEXT';
  required: boolean;
  positiveValue?: string;
  displayOrder?: number;
  options?: QuestionOption[];
}

interface AssignedBranch {
  assignmentId: string;
  branchId: string;
  branchName: string;
  address?: string;
  status: string;
  qrToken: string;
  isActive: boolean;
  isDefault: boolean;
}

interface ReviewFormItem {
  id: string;
  businessId: string;
  businessName?: string;
  name: string;
  title: string;
  description?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  version: number;
  isPublished: boolean;
  isDefault: boolean;
  classificationPolicy: 'LOWEST_SCORE' | 'OVERALL_QUESTION' | 'AGGREGATE';
  overallRatingQuestionId?: string;
  designSettings?: any;
  customerFieldSettings?: any;
  welcomeMessage?: string;
  thankYouMessage?: string;
  submitButtonText?: string;
  privacyNotice?: string;
  totalQuestions: number;
  questions?: Question[];
  totalReviews: number;
  assignedBranchesCount: number;
  assignedBranches: AssignedBranch[];
  isSharedAcrossBranches?: boolean;
}

interface BusinessInfo {
  id: string;
  name: string;
  branches: { id: string; name: string; qrToken: string }[];
}

export default function FormManager({
  businesses,
  selectedBusinessId,
}: {
  businesses: BusinessInfo[];
  selectedBusinessId: string;
}) {
  const [forms, setForms] = useState<ReviewFormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'forms' | 'branch_assignments'>('forms');

  // Editor states
  const [editingForm, setEditingForm] = useState<ReviewFormItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editorTab, setEditorTab] = useState<'questions' | 'design' | 'classification' | 'branches'>('questions');

  // Preview state
  const [previewForm, setPreviewForm] = useState<ReviewFormItem | null>(null);

  // Branch assignment modal
  const [assigningForm, setAssigningForm] = useState<ReviewFormItem | null>(null);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Notification message
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load forms
  const loadForms = async () => {
    try {
      setLoading(true);
      const url = selectedBusinessId && selectedBusinessId !== 'ALL'
        ? `/api/forms?businessId=${selectedBusinessId}&includeArchived=false`
        : '/api/forms?includeArchived=false';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setForms(data.forms || []);
      }
    } catch (err) {
      console.error('Failed to load forms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, [selectedBusinessId]);

  // Handle Form Publish / Pause / Archive
  const handleStatusChange = async (formId: string, newStatus: 'PUBLISHED' | 'PAUSED' | 'ARCHIVED') => {
    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: `Form marked as ${newStatus}` });
        await loadForms();
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update status');
      }
    } catch {
      alert('Error updating form status');
    }
  };

  // Duplicate a form
  const handleDuplicateForm = async (formId: string) => {
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DUPLICATE', sourceFormId: formId }),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Form duplicated successfully (saved as Draft)' });
        await loadForms();
        setTimeout(() => setFeedbackMsg(null), 3000);
      }
    } catch {
      alert('Error duplicating form');
    }
  };

  // Open Editor for existing form
  const handleOpenEdit = async (formId: string) => {
    try {
      const res = await fetch(`/api/forms/${formId}`);
      if (res.ok) {
        const d = await res.json();
        setEditingForm(d.form);
        setIsCreatingNew(false);
        setEditorTab('questions');
      }
    } catch {
      alert('Failed to load form details');
    }
  };

  // Open Create Form modal
  const handleStartCreate = () => {
    const targetBusiness = businesses.find((b) => selectedBusinessId !== 'ALL' ? b.id === selectedBusinessId : true) || businesses[0];
    if (!targetBusiness) {
      alert('Please create a business first before creating a review form.');
      return;
    }

    const defaultNewForm: any = {
      businessId: targetBusiness.id,
      name: 'Customer Experience Survey',
      title: 'How was your experience today?',
      description: 'Your feedback helps us provide the highest quality service.',
      status: 'PUBLISHED',
      classificationPolicy: 'LOWEST_SCORE',
      welcomeMessage: 'Welcome! We would love your honest feedback.',
      thankYouMessage: 'Thank you for your valuable feedback! We appreciate your time.',
      submitButtonText: 'Submit Feedback',
      privacyNotice: 'Your feedback is private and protected by ReviewFlow.',
      designSettings: {
        primaryColor: '#1E3A8A',
        backgroundColor: '#F8FAFC',
        buttonStyle: 'rounded',
      },
      customerFieldSettings: {
        nameRequired: true,
        mobileRequired: true,
        emailEnabled: true,
      },
      questions: [
        {
          text: 'How would you rate your overall experience today?',
          type: 'STAR_RATING',
          required: true,
          displayOrder: 1,
          options: [],
        },
        {
          text: 'How was the quality of our service and attentiveness?',
          type: 'GOOD_OKAY_POOR',
          required: true,
          displayOrder: 2,
          options: [],
        },
        {
          text: 'Would you recommend us to friends and family?',
          type: 'YES_NO',
          positiveValue: 'Yes',
          required: true,
          displayOrder: 3,
          options: [],
        },
        {
          text: 'What did you like most, or how can we improve?',
          type: 'TEXT',
          required: false,
          displayOrder: 4,
          options: [],
        },
      ],
      assignedBranches: [],
    };

    setEditingForm(defaultNewForm);
    setIsCreatingNew(true);
    setEditorTab('questions');
  };

  // Save changes to current form
  const handleSaveForm = async () => {
    if (!editingForm) return;

    if (!editingForm.title.trim()) {
      alert('Form title is required');
      return;
    }

    try {
      if (isCreatingNew) {
        // Create new form API
        const res = await fetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: editingForm.businessId,
            name: editingForm.name,
            title: editingForm.title,
            description: editingForm.description,
            status: editingForm.status,
            classificationPolicy: editingForm.classificationPolicy,
            overallRatingQuestionId: editingForm.overallRatingQuestionId,
            designSettings: editingForm.designSettings,
            customerFieldSettings: editingForm.customerFieldSettings,
            welcomeMessage: editingForm.welcomeMessage,
            thankYouMessage: editingForm.thankYouMessage,
            submitButtonText: editingForm.submitButtonText,
            privacyNotice: editingForm.privacyNotice,
            initialQuestions: editingForm.questions,
          }),
        });

        if (res.ok) {
          setFeedbackMsg({ type: 'success', text: 'New review form created and published successfully!' });
          setEditingForm(null);
          await loadForms();
          setTimeout(() => setFeedbackMsg(null), 3000);
        } else {
          const d = await res.json();
          alert(d.error || 'Failed to create form');
        }
      } else {
        // Update existing form API
        const res = await fetch(`/api/forms/${editingForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingForm.name,
            title: editingForm.title,
            description: editingForm.description,
            status: editingForm.status,
            classificationPolicy: editingForm.classificationPolicy,
            overallRatingQuestionId: editingForm.overallRatingQuestionId,
            designSettings: editingForm.designSettings,
            customerFieldSettings: editingForm.customerFieldSettings,
            welcomeMessage: editingForm.welcomeMessage,
            thankYouMessage: editingForm.thankYouMessage,
            submitButtonText: editingForm.submitButtonText,
            privacyNotice: editingForm.privacyNotice,
          }),
        });

        if (res.ok) {
          setFeedbackMsg({ type: 'success', text: 'Form settings saved successfully!' });
          setEditingForm(null);
          await loadForms();
          setTimeout(() => setFeedbackMsg(null), 3000);
        } else {
          const d = await res.json();
          alert(d.error || 'Failed to update form');
        }
      }
    } catch {
      alert('Error saving form');
    }
  };

  // Customize for Branch Action (from Branch View)
  const handleCustomizeForBranch = async (sourceFormId: string, branchId: string) => {
    try {
      const res = await fetch('/api/forms/assignments/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CUSTOMIZE_FOR_BRANCH', sourceFormId, branchId }),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Independent copy created and assigned to this branch!' });
        await loadForms();
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to customize for branch');
      }
    } catch {
      alert('Error customizing branch form');
    }
  };

  // Execute branch assignment
  const handleSaveBranchAssignments = async () => {
    if (!assigningForm) return;
    try {
      setSavingAssignment(true);
      const res = await fetch(`/api/forms/${assigningForm.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchIds: selectedBranchIds }),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: `Form assigned to ${selectedBranchIds.length} branch(es)` });
        setAssigningForm(null);
        await loadForms();
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to assign branches');
      }
    } catch {
      alert('Error assigning branches');
    } finally {
      setSavingAssignment(false);
    }
  };

  // Add question inside editor
  const handleAddQuestion = async (type: Question['type']) => {
    if (!editingForm) return;

    const newQ: Question = {
      text: type === 'STAR_RATING' ? 'How would you rate this service?' : type === 'GOOD_OKAY_POOR' ? 'How was our food and service?' : type === 'YES_NO' ? 'Would you visit us again?' : type === 'MULTIPLE_CHOICE' ? 'Which service did you use?' : 'Any additional comments?',
      type,
      required: true,
      displayOrder: (editingForm.questions?.length || 0) + 1,
      positiveValue: type === 'YES_NO' ? 'Yes' : undefined,
      options: type === 'MULTIPLE_CHOICE' ? [
        { text: 'Dine-In', value: 'dine_in', scoreClassification: 'GOOD' },
        { text: 'Takeaway', value: 'takeaway', scoreClassification: 'GOOD' },
        { text: 'Delivery', value: 'delivery', scoreClassification: 'GOOD' },
      ] : [],
    };

    if (isCreatingNew) {
      setEditingForm({
        ...editingForm,
        questions: [...(editingForm.questions || []), newQ],
      });
    } else {
      // API call to add question
      try {
        const res = await fetch(`/api/forms/${editingForm.id}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newQ),
        });
        if (res.ok) {
          const d = await res.json();
          setEditingForm({
            ...editingForm,
            questions: [...(editingForm.questions || []), d.question],
          });
        }
      } catch {
        alert('Failed to add question');
      }
    }
  };

  // Remove question inside editor
  const handleRemoveQuestion = async (index: number, questionId?: string) => {
    if (!editingForm) return;
    if (isCreatingNew || !questionId) {
      const updated = [...(editingForm.questions || [])];
      updated.splice(index, 1);
      setEditingForm({ ...editingForm, questions: updated });
    } else {
      try {
        const res = await fetch(`/api/forms/${editingForm.id}/questions/${questionId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          const updated = (editingForm.questions || []).filter((q) => q.id !== questionId);
          setEditingForm({ ...editingForm, questions: updated });
        }
      } catch {
        alert('Failed to delete question');
      }
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      {/* Top Banner & Tab Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0B192C', margin: 0 }}>Review Design & Form Settings</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '3px 0 0 0' }}>
            Configure branch-specific review questionnaires, classification policies, and customer branding
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
            <button
              onClick={() => setActiveSubTab('forms')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeSubTab === 'forms' ? '#FFFFFF' : 'transparent',
                color: activeSubTab === 'forms' ? '#1E3A8A' : '#64748B',
                fontWeight: activeSubTab === 'forms' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: activeSubTab === 'forms' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Forms Library ({forms.length})
            </button>
            <button
              onClick={() => setActiveSubTab('branch_assignments')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeSubTab === 'branch_assignments' ? '#FFFFFF' : 'transparent',
                color: activeSubTab === 'branch_assignments' ? '#1E3A8A' : '#64748B',
                fontWeight: activeSubTab === 'branch_assignments' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: activeSubTab === 'branch_assignments' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Branch Assignments
            </button>
          </div>

          <button
            onClick={handleStartCreate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#1E3A8A',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(30, 58, 138, 0.25)',
            }}
          >
            <Plus size={16} /> Create Review Form
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 600,
            background: feedbackMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: feedbackMsg.type === 'success' ? '#059669' : '#DC2626',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} /> {feedbackMsg.text}
        </div>
      )}

      {/* ----------------------------------------------------
          SUB-TAB 1: FORMS LIBRARY
          ---------------------------------------------------- */}
      {activeSubTab === 'forms' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {forms.map((f) => (
            <div
              key={f.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                padding: 22,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          f.status === 'PUBLISHED'
                            ? '#ECFDF5'
                            : f.status === 'DRAFT'
                            ? '#EFF6FF'
                            : '#FEF2F2',
                        color:
                          f.status === 'PUBLISHED'
                            ? '#059669'
                            : f.status === 'DRAFT'
                            ? '#1E3A8A'
                            : '#DC2626',
                      }}
                    >
                      {f.status} • v{f.version}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 11.5, color: '#64748B' }}>
                      {f.businessName}
                    </span>
                  </div>

                  {f.assignedBranchesCount > 1 && (
                    <span
                      title="Shared across multiple branches"
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#FFFBEB',
                        color: '#D97706',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <GitBranch size={12} /> Shared ({f.assignedBranchesCount})
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0B192C', margin: '4px 0 6px 0' }}>{f.name}</h3>
                <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{f.title}</div>
                {f.description && (
                  <p style={{ fontSize: 12.5, color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                    {f.description}
                  </p>
                )}

                {/* Form Metadata Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                  <span style={{ background: '#F8FAFC', padding: '3px 8px', borderRadius: 4, fontSize: 11.5, color: '#475569', border: '1px solid #E2E8F0' }}>
                    {f.totalQuestions} Questions
                  </span>
                  <span style={{ background: '#F8FAFC', padding: '3px 8px', borderRadius: 4, fontSize: 11.5, color: '#475569', border: '1px solid #E2E8F0' }}>
                    Policy: {f.classificationPolicy}
                  </span>
                  <span style={{ background: '#F8FAFC', padding: '3px 8px', borderRadius: 4, fontSize: 11.5, color: '#475569', border: '1px solid #E2E8F0' }}>
                    {f.totalReviews} Reviews
                  </span>
                </div>

                {/* Assigned branches preview */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9', fontSize: 12 }}>
                  <div style={{ color: '#64748B', fontWeight: 600, marginBottom: 4 }}>
                    Assigned Branches ({f.assignedBranches.length}):
                  </div>
                  {f.assignedBranches.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {f.assignedBranches.map((ab) => (
                        <span
                          key={ab.branchId}
                          style={{
                            background: '#EFF6FF',
                            color: '#1E3A8A',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {ab.branchName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not currently assigned to any branch</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
                <button
                  onClick={() => handleOpenEdit(f.id)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#0B192C',
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={14} /> Edit & Design
                </button>

                <button
                  onClick={() => {
                    setAssigningForm(f);
                    setSelectedBranchIds(f.assignedBranches.map((b) => b.branchId));
                  }}
                  title="Assign to Branches"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#1E3A8A',
                    cursor: 'pointer',
                  }}
                >
                  <GitBranch size={14} />
                </button>

                <button
                  onClick={() => handleDuplicateForm(f.id)}
                  title="Duplicate Form"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  <Copy size={14} />
                </button>

                {f.status === 'PUBLISHED' ? (
                  <button
                    onClick={() => handleStatusChange(f.id, 'PAUSED')}
                    title="Pause Form"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#FFFBEB',
                      color: '#D97706',
                      cursor: 'pointer',
                    }}
                  >
                    <Pause size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleStatusChange(f.id, 'PUBLISHED')}
                    title="Publish Form"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#ECFDF5',
                      color: '#059669',
                      cursor: 'pointer',
                    }}
                  >
                    <Play size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {forms.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 48, textAlign: 'center', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0' }}>
              <FileText size={36} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0B192C' }}>No Review Forms Created Yet</h3>
              <p style={{ fontSize: 13, color: '#64748B', maxWidth: 400, margin: '6px auto 16px auto' }}>
                Create your first customized feedback questionnaire and assign it to your branches.
              </p>
              <button
                onClick={handleStartCreate}
                style={{ background: '#1E3A8A', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
              >
                + Create Review Form
              </button>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          SUB-TAB 2: BRANCH-WISE FORM ASSIGNMENTS
          ---------------------------------------------------- */}
      {activeSubTab === 'branch_assignments' && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 800, fontSize: 16 }}>
            Active Branch Review Forms & Customizations
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Branch</th>
                <th style={{ padding: '12px 16px' }}>Business</th>
                <th style={{ padding: '12px 16px' }}>Active Assigned Form</th>
                <th style={{ padding: '12px 16px' }}>Form Status</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.flatMap((b) =>
                b.branches.map((br) => {
                  const assignedForm = forms.find((f) =>
                    f.assignedBranches.some((ab) => ab.branchId === br.id && ab.isActive)
                  );
                  const isShared = assignedForm ? assignedForm.assignedBranchesCount > 1 : false;

                  return (
                    <tr key={br.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0B192C' }}>{br.name}</td>
                      <td style={{ padding: '14px 16px', color: '#64748B' }}>{b.name}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {assignedForm ? (
                          <div>
                            <div style={{ fontWeight: 700, color: '#1E3A8A' }}>{assignedForm.name}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{assignedForm.title}</div>
                          </div>
                        ) : (
                          <span style={{ color: '#DC2626', fontWeight: 600 }}>No active form (Portal shows unavailable)</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {assignedForm ? (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: assignedForm.status === 'PUBLISHED' ? '#ECFDF5' : '#FEF2F2',
                              color: assignedForm.status === 'PUBLISHED' ? '#059669' : '#DC2626',
                            }}
                          >
                            {assignedForm.status}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {isShared ? (
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#FFFBEB', color: '#D97706' }}>
                            Shared ({assignedForm?.assignedBranchesCount} branches)
                          </span>
                        ) : assignedForm ? (
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#1E3A8A' }}>
                            Branch Specific
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {assignedForm && isShared && (
                            <button
                              onClick={() => handleCustomizeForBranch(assignedForm.id, br.id)}
                              title="Detaches from shared form into an independent copy for this branch"
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
                              Customize for This Branch
                            </button>
                          )}
                          <a
                            href={`/review/${br.qrToken}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              padding: '5px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#0B192C',
                              textDecoration: 'none',
                            }}
                          >
                            Test QR <ExternalLink size={12} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: FULL FORM & QUESTION EDITOR
          ---------------------------------------------------- */}
      {editingForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 25, 44, 0.65)',
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
              maxWidth: 880,
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: 28,
            }}
          >
            {/* Editor Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0B192C', margin: 0 }}>
                    {isCreatingNew ? 'Create New Review Form' : `Edit: ${editingForm.name}`}
                  </h3>
                  {!isCreatingNew && (
                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#1E3A8A' }}>
                      v{editingForm.version}
                    </span>
                  )}
                </div>
                {editingForm.isSharedAcrossBranches && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: '#D97706', fontWeight: 600 }}>
                    <AlertTriangle size={14} />
                    <span>This form is currently shared across {editingForm.assignedBranchesCount} branches. Changes will apply to all assigned branches.</span>
                  </div>
                )}
              </div>
              <button onClick={() => setEditingForm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={22} />
              </button>
            </div>

            {/* Editor Navigation Tabs */}
            <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #E2E8F0', paddingBottom: 12, marginBottom: 20 }}>
              {[
                { id: 'questions', label: 'Questions Builder', icon: FileText },
                { id: 'design', label: 'Branding & Design', icon: Palette },
                { id: 'classification', label: 'Classification Rules', icon: Settings2 },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = editorTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setEditorTab(t.id as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: isActive ? '#1E3A8A' : 'transparent',
                      color: isActive ? '#FFFFFF' : '#64748B',
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={15} /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: QUESTIONS BUILDER */}
            {editorTab === 'questions' && (
              <div>
                {/* Basic Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Internal Form Name *</label>
                    <input
                      type="text"
                      value={editingForm.name}
                      onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Public Form Heading *</label>
                    <input
                      type="text"
                      value={editingForm.title}
                      onChange={(e) => setEditingForm({ ...editingForm, title: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Description / Subtitle</label>
                  <input
                    type="text"
                    value={editingForm.description || ''}
                    onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                  />
                </div>

                {/* Questions List */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0B192C' }}>
                    Questions ({editingForm.questions?.length || 0})
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('STAR_RATING')}
                      style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      + 5-Star Rating
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('GOOD_OKAY_POOR')}
                      style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      + Good/Okay/Poor
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('YES_NO')}
                      style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      + Yes/No
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('MULTIPLE_CHOICE')}
                      style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      + Multiple Choice
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('TEXT')}
                      style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      + Text Comment
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {editingForm.questions?.map((q, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: 10,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A' }}>Q{idx + 1}.</span>
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700, background: '#E2E8F0', color: '#475569' }}>
                              {q.type}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={q.text}
                            onChange={(e) => {
                              const updated = [...(editingForm.questions || [])];
                              updated[idx].text = e.target.value;
                              setEditingForm({ ...editingForm, questions: updated });
                            }}
                            placeholder="Enter question text"
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, fontWeight: 600 }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={(e) => {
                                const updated = [...(editingForm.questions || [])];
                                updated[idx].required = e.target.checked;
                                setEditingForm({ ...editingForm, questions: updated });
                              }}
                            />
                            Required
                          </label>

                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(idx, q.id)}
                            style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: 4 }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Helper description */}
                      <div style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          value={q.description || ''}
                          onChange={(e) => {
                            const updated = [...(editingForm.questions || [])];
                            updated[idx].description = e.target.value;
                            setEditingForm({ ...editingForm, questions: updated });
                          }}
                          placeholder="Helper or description text (optional)"
                          style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, color: '#64748B' }}
                        />
                      </div>

                      {/* YES/NO positive answer config */}
                      {q.type === 'YES_NO' && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ color: '#475569' }}>Positive Answer for Classification:</span>
                          <select
                            value={q.positiveValue || 'Yes'}
                            onChange={(e) => {
                              const updated = [...(editingForm.questions || [])];
                              updated[idx].positiveValue = e.target.value;
                              setEditingForm({ ...editingForm, questions: updated });
                            }}
                            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: 12 }}
                          >
                            <option value="Yes">Yes (Good), No (Poor)</option>
                            <option value="No">No (Good), Yes (Poor)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: BRANDING & DESIGN */}
            {editorTab === 'design' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <h4 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 14px 0' }}>Visual Theme & Colors</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Primary Brand Color</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="color"
                          value={editingForm.designSettings?.primaryColor || '#1E3A8A'}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              designSettings: { ...editingForm.designSettings, primaryColor: e.target.value },
                            })
                          }
                          style={{ width: 44, height: 36, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                        />
                        <input
                          type="text"
                          value={editingForm.designSettings?.primaryColor || '#1E3A8A'}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              designSettings: { ...editingForm.designSettings, primaryColor: e.target.value },
                            })
                          }
                          style={{ width: 120, padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Button Shape Style</label>
                      <select
                        value={editingForm.designSettings?.buttonStyle || 'rounded'}
                        onChange={(e) =>
                          setEditingForm({
                            ...editingForm,
                            designSettings: { ...editingForm.designSettings, buttonStyle: e.target.value },
                          })
                        }
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                      >
                        <option value="rounded">Rounded Corners (Default)</option>
                        <option value="pill">Pill / Stadium</option>
                        <option value="square">Square / Sharp</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Submit Button Label</label>
                      <input
                        type="text"
                        value={editingForm.submitButtonText || 'Submit Feedback'}
                        onChange={(e) => setEditingForm({ ...editingForm, submitButtonText: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 14px 0' }}>Customer Messaging</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Welcome Banner Message</label>
                      <textarea
                        rows={2}
                        value={editingForm.welcomeMessage || ''}
                        onChange={(e) => setEditingForm({ ...editingForm, welcomeMessage: e.target.value })}
                        placeholder="Greeting shown above the form"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Thank-You Message & Closing</label>
                      <textarea
                        rows={2}
                        value={editingForm.thankYouMessage || ''}
                        onChange={(e) => setEditingForm({ ...editingForm, thankYouMessage: e.target.value })}
                        placeholder="Displayed after customer completes the review"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Privacy Notice Statement</label>
                      <input
                        type="text"
                        value={editingForm.privacyNotice || ''}
                        onChange={(e) => setEditingForm({ ...editingForm, privacyNotice: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CLASSIFICATION POLICY */}
            {editorTab === 'classification' && (
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 8px 0' }}>Overall Review Classification Policy</h4>
                <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px 0' }}>
                  Define how multiple answers combine into the final sentiment (GOOD, OKAY, POOR) used for dashboards, reports, and poor-review alerts.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                  {[
                    {
                      id: 'LOWEST_SCORE',
                      title: 'Lowest Scored Answer (Default)',
                      desc: 'If any classified answer is POOR, the review is marked POOR. If any is OKAY, it is OKAY. Ensures critical feedback is never buried.',
                    },
                    {
                      id: 'AGGREGATE',
                      title: 'Aggregate / Average Score',
                      desc: 'Averages all scores across questions. POOR if average rating is <= 2.5★, OKAY if <= 3.7★, otherwise GOOD.',
                    },
                    {
                      id: 'OVERALL_QUESTION',
                      title: 'Overall Question Designated',
                      desc: 'The classification of a designated star rating or good/okay/poor question determines the overall review status.',
                    },
                  ].map((p) => {
                    const isSelected = editingForm.classificationPolicy === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setEditingForm({ ...editingForm, classificationPolicy: p.id as any })}
                        style={{
                          padding: 16,
                          borderRadius: 10,
                          border: isSelected ? '2px solid #1E3A8A' : '1px solid #CBD5E1',
                          background: isSelected ? '#EFF6FF' : '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0B192C' }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 6, lineHeight: 1.4 }}>{p.desc}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14, fontSize: 12.5, color: '#334155' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Classification Rule Safeguards:</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Star Ratings: 1–2★ = POOR | 3★ = OKAY | 4–5★ = GOOD.</li>
                    <li>Text Comments: Stored as open comments and never silently assumed to be negative.</li>
                    <li>POOR classifications immediately trigger instant push notifications to the business owner and authorized branch managers.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Editor Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
              <div>
                <select
                  value={editingForm.status}
                  onChange={(e) => setEditingForm({ ...editingForm, status: e.target.value as any })}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, fontWeight: 600 }}
                >
                  <option value="PUBLISHED">Status: Published (Active)</option>
                  <option value="DRAFT">Status: Draft (Unpublished)</option>
                  <option value="PAUSED">Status: Paused</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingForm(null)}
                  style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#1E3A8A',
                    color: '#FFFFFF',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Save size={15} /> Save & Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: ASSIGN FORM TO BRANCHES
          ---------------------------------------------------- */}
      {assigningForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 25, 44, 0.65)',
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
              padding: 26,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0B192C', margin: 0 }}>Assign Form to Branches</h3>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>{assigningForm.name}</div>
              </div>
              <button onClick={() => setAssigningForm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.4, margin: '0 0 16px 0' }}>
              Select the branches where this questionnaire will be shown when customers scan the branch QR code.
            </p>

            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {businesses
                .find((b) => b.id === assigningForm.businessId)
                ?.branches.map((br) => {
                  const isChecked = selectedBranchIds.includes(br.id);
                  return (
                    <label
                      key={br.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: isChecked ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                        background: isChecked ? '#EFF6FF' : '#F8FAFC',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0B192C' }}>{br.name}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBranchIds([...selectedBranchIds, br.id]);
                          } else {
                            setSelectedBranchIds(selectedBranchIds.filter((id) => id !== br.id));
                          }
                        }}
                      />
                    </label>
                  );
                })}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setAssigningForm(null)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAssignment}
                onClick={handleSaveBranchAssignments}
                style={{
                  flex: 2,
                  padding: '9px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#1E3A8A',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {savingAssignment ? 'Saving...' : `Assign to ${selectedBranchIds.length} Branch(es)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
