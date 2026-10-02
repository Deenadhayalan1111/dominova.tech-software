import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { Spinner, Alert } from './shared';

const LEAD_SOURCES = [
  'WhatsApp', 'Instagram DM', 'Facebook', 'Google Ads', 'Referral',
  'Cold Call', 'Website Inquiry', 'Walk-in', 'LinkedIn', 'Manual', 'Other'
];

const BUSINESS_CATEGORIES = [
  'Restaurant / Food', 'Retail / Shop', 'Real Estate', 'Healthcare / Clinic',
  'Education / Coaching', 'Fashion / Apparel', 'Beauty & Salon', 'Automobile',
  'Travel & Tourism', 'Construction', 'Finance & Insurance', 'Technology',
  'Logistics', 'Manufacturing', 'Other'
];

const SECTION = ({ title, children }) => (
  <div style={{ marginBottom: '28px' }}>
    <div style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--brand-primary)', marginBottom: '16px', paddingBottom: '8px',
      borderBottom: '1px solid var(--border)',
    }}>
      {title}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {children}
    </div>
  </div>
);

const Field = ({ label, required, full, children }) => (
  <div className="form-group" style={{ gridColumn: full ? '1 / -1' : undefined, marginBottom: 0 }}>
    <label>
      {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
    </label>
    {children}
  </div>
);

export default function NewLeadModal({ open, onClose, onCreated, userRole, userId }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [salespeople, setSalespeople] = useState([]);
  const overlayRef = useRef(null);

  const EMPTY = {
    // Client
    client_name: '', org_name: '', phone: '', email: '',
    // Business
    business_category: '', location: '', google_business_url: '', instagram_url: '',
    // Sales
    lead_source: 'Manual', assigned_to: '', quoted_amount: '', advance_amount: '', advance_received: false,
    // Requirements
    requirements: '', website_expectations: '', notes: '',
    // Follow-up
    followup_date: '', followup_time: '', followup_notes: '',
  };

  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setStep(1);
    setError('');
    // Load salespeople for admin
    if (userRole === 'admin') {
      api.getSalespeople().then(d => setSalespeople(d.users || [])).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const onField = e => set(e.target.name, e.target.value);

  const validateStep1 = () => {
    if (!form.client_name.trim()) return 'Client name is required.';
    if (!form.phone.trim()) return 'Contact number is required.';
    return null;
  };

  const handleNext = () => {
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    setError('');
    setStep(s => s + 1);
  };

  const handleBack = () => { setError(''); setStep(s => s - 1); };

  const handleSubmit = async () => {
    const err = validateStep1();
    if (err) { setStep(1); setError(err); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        client_name: form.client_name.trim(),
        org_name: form.org_name.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        google_business_url: form.google_business_url.trim() || undefined,
        instagram_url: form.instagram_url.trim() || undefined,
        other_url: form.location.trim() || undefined,
        lead_source: form.lead_source,
        assigned_to: form.assigned_to || undefined,
        notes: [
          form.notes ? `Notes: ${form.notes}` : '',
          form.business_category ? `Category: ${form.business_category}` : '',
        ].filter(Boolean).join(' | ') || undefined,
        requirements: [
          form.requirements,
          form.website_expectations ? `Website: ${form.website_expectations}` : '',
        ].filter(Boolean).join('\n') || undefined,
        quoted_amount: form.quoted_amount ? parseFloat(form.quoted_amount) : undefined,
        advance_amount: form.advance_amount ? parseFloat(form.advance_amount) : undefined,
        advance_received: form.advance_received,
      };

      const created = await api.createLead(payload);

      // Create follow-up if date is set
      if (form.followup_date && created.lead) {
        await api.createFollowup(created.lead.id, {
          followup_date: form.followup_date,
          followup_time: form.followup_time || undefined,
          reason: 'Initial follow-up',
          notes: form.followup_notes || undefined,
        }).catch(() => {}); // Non-blocking, lead already saved
      }

      onCreated(created.lead);
      onClose();
    } catch (ex) {
      setError(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const STEPS = ['Client', 'Business', 'Sales', 'Requirements', 'Follow-up'];

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        animation: 'slideUp 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px 0',
          background: 'linear-gradient(135deg, var(--bg-dark-base) 0%, #1a1812 100%)',
          borderBottom: '1px solid rgba(212,175,55,0.2)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-on-dark)' }}>Create New Lead</div>
              <div style={{ fontSize: '12px', color: 'var(--text-on-dark-muted)', marginTop: '2px' }}>
                Step {step} of {STEPS.length} — {STEPS[step - 1]} Details
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text-on-dark)', borderRadius: '8px', width: '32px', height: '32px',
                cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
          {/* Step Indicator */}
          <div style={{ display: 'flex', gap: '4px', paddingBottom: '0' }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{
                flex: 1, height: '3px',
                background: i + 1 <= step ? 'var(--brand-primary)' : 'rgba(255,255,255,0.12)',
                borderRadius: '2px',
                transition: 'background 0.3s ease',
              }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          {error && (
            <Alert type="error" onClose={() => setError('')} style={{ marginBottom: '20px' }}>
              {error}
            </Alert>
          )}

          {/* STEP 1 — Client Details */}
          {step === 1 && (
            <SECTION title="Client Details">
              <Field label="Person Name" required>
                <input className="form-control" name="client_name" value={form.client_name} onChange={onField} placeholder="e.g. Rahul Sharma" autoFocus />
              </Field>
              <Field label="Organization / Business Name">
                <input className="form-control" name="org_name" value={form.org_name} onChange={onField} placeholder="e.g. Sharma Enterprises" />
              </Field>
              <Field label="Contact Number" required>
                <input className="form-control" name="phone" value={form.phone} onChange={onField} placeholder="+91 98765 43210" type="tel" />
              </Field>
              <Field label="Email Address">
                <input className="form-control" name="email" value={form.email} onChange={onField} placeholder="rahul@business.com" type="email" />
              </Field>
            </SECTION>
          )}

          {/* STEP 2 — Business Details */}
          {step === 2 && (
            <SECTION title="Business Details">
              <Field label="Business Category">
                <select className="form-control" name="business_category" value={form.business_category} onChange={onField}>
                  <option value="">Select category...</option>
                  {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Location / City">
                <input className="form-control" name="location" value={form.location} onChange={onField} placeholder="e.g. Mumbai, Maharashtra" />
              </Field>
              <Field label="Google Business Profile URL" full>
                <input className="form-control" name="google_business_url" value={form.google_business_url} onChange={onField} placeholder="https://maps.google.com/..." />
              </Field>
              <Field label="Instagram Profile URL" full>
                <input className="form-control" name="instagram_url" value={form.instagram_url} onChange={onField} placeholder="https://instagram.com/..." />
              </Field>
            </SECTION>
          )}

          {/* STEP 3 — Sales Details */}
          {step === 3 && (
            <SECTION title="Sales Details">
              <Field label="Lead Source">
                <select className="form-control" name="lead_source" value={form.lead_source} onChange={onField}>
                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              {userRole === 'admin' && (
                <Field label="Assign to Salesperson">
                  <select className="form-control" name="assigned_to" value={form.assigned_to} onChange={onField}>
                    <option value="">Unassigned (NEW)</option>
                    {salespeople.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Quoted Amount (₹)">
                <input className="form-control" name="quoted_amount" value={form.quoted_amount} onChange={onField} placeholder="e.g. 25000" type="number" min="0" />
              </Field>
              <Field label="Advance Amount (₹)">
                <input className="form-control" name="advance_amount" value={form.advance_amount} onChange={onField} placeholder="e.g. 5000" type="number" min="0" />
              </Field>
              <Field label="Advance Received?">
                <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '8px' }}>
                  <button
                    className={`btn w-full ${form.advance_received ? 'btn-success' : 'btn-ghost'}`}
                    onClick={() => set('advance_received', true)}
                    style={{ flex: 1, textAlign: 'center', padding: '8px', transition: 'all 0.2s' }}
                  >
                    ✓ Yes
                  </button>
                  <button
                    className={`btn w-full ${!form.advance_received ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => set('advance_received', false)}
                    style={{ flex: 1, textAlign: 'center', padding: '8px', transition: 'all 0.2s' }}
                  >
                    ✕ No
                  </button>
                </div>
              </Field>
            </SECTION>
          )}

          {/* STEP 4 — Requirements */}
          {step === 4 && (
            <SECTION title="Requirements & Notes">
              <Field label="Client Requirements / Specifications" full>
                <textarea className="form-control" name="requirements" value={form.requirements} onChange={onField} placeholder="Describe what the client needs — type of website, pages required, features, etc." rows={4} />
              </Field>
              <Field label="Website Requirements / Expectations" full>
                <textarea className="form-control" name="website_expectations" value={form.website_expectations} onChange={onField} placeholder="e.g. E-commerce site, mobile-friendly, payment gateway, admin panel..." rows={3} />
              </Field>
              <Field label="Sales Notes" full>
                <textarea className="form-control" name="notes" value={form.notes} onChange={onField} placeholder="Any internal notes, observations or important client comments..." rows={3} />
              </Field>
            </SECTION>
          )}

          {/* STEP 5 — Follow-up */}
          {step === 5 && (
            <SECTION title="Follow-up Scheduling">
              <Field label="Follow-up Date">
                <input className="form-control" name="followup_date" value={form.followup_date} onChange={onField} type="date" min={new Date().toISOString().split('T')[0]} />
              </Field>
              <Field label="Follow-up Time">
                <input className="form-control" name="followup_time" value={form.followup_time} onChange={onField} type="time" />
              </Field>
              <Field label="Follow-up Notes" full>
                <textarea className="form-control" name="followup_notes" value={form.followup_notes} onChange={onField} placeholder="What to discuss, questions to ask, reminders..." rows={4} />
              </Field>

              {/* Summary Preview */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '16px',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Lead Summary
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                    {[
                      ['Client', form.client_name],
                      ['Business', form.org_name || '—'],
                      ['Phone', form.phone],
                      ['Email', form.email || '—'],
                      ['Category', form.business_category || '—'],
                      ['Source', form.lead_source],
                      ['Quoted', form.quoted_amount ? `₹${Number(form.quoted_amount).toLocaleString('en-IN')}` : '—'],
                      ['Advance', form.advance_amount ? `₹${Number(form.advance_amount).toLocaleString('en-IN')} (${form.advance_received ? '✓' : '✕'})` : '—'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                        <span style={{ fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SECTION>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-surface)',
        }}>
          <button
            className="btn btn-ghost"
            onClick={step === 1 ? onClose : handleBack}
            disabled={saving}
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {step} / {STEPS.length}
            </span>
            {step < STEPS.length ? (
              <button className="btn btn-primary" onClick={handleNext}>
                Continue →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ minWidth: '140px' }}>
                {saving ? <><Spinner /> Creating...</> : '✓ Create Lead'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
