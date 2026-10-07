import React, { useState } from 'react';
import {
  AlertTriangle,
  Send,
  CheckCircle2,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { StudentUser, Complaint, ComplaintCategory } from '../../types/index.ts';

interface StudentComplaintsProps {
  student: StudentUser;
  complaints: Complaint[];
  onSubmitComplaint: (category: ComplaintCategory, description: string) => Promise<boolean>;
}

export const StudentComplaints: React.FC<StudentComplaintsProps> = ({
  student,
  complaints,
  onSubmitComplaint,
}) => {
  const [showForm, setShowForm] = useState<boolean>(false);
  const [category, setCategory] = useState<ComplaintCategory>('Seat Availability');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const categories: ComplaintCategory[] = [
    'Seat Availability',
    'Driver Behaviour',
    'Speeding',
    'Bus Condition',
    'Cleanliness',
    'Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    const ok = await onSubmitComplaint(category, description.trim());
    setIsSubmitting(false);

    if (ok) {
      setFeedback({
        type: 'success',
        text: 'Complaint submitted successfully to Transport Administration.',
      });
      setDescription('');
      setTimeout(() => setShowForm(false), 1500);
    } else {
      setFeedback({
        type: 'error',
        text: 'Failed to submit complaint. Please try again.',
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>⚠️ Transport Grievances & Complaints</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Report bus delays, seat shortages, route issues, or vehicle feedback directly to transport admin
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm);
            setFeedback(null);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? 'Cancel Form' : 'File New Grievance'}</span>
        </button>
      </div>

      {/* Complaint Submission Form */}
      {showForm && (
        <div className="rounded-3xl bg-white p-6 border border-purple-200 shadow-md space-y-4 animate-in fade-in">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <MessageSquare className="h-5 w-5 text-purple-700" />
            <h2 className="font-bold text-sm text-slate-900">File Transport Grievance</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Issue Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-center border transition cursor-pointer ${
                      category === cat
                        ? 'bg-purple-100 border-purple-600 text-purple-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Description & Incident Details
              </label>
              <textarea
                rows={4}
                required
                placeholder="Describe what occurred, date/time, and specific bus or stop details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3.5 text-xs focus:outline-hidden focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              />
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-2xl text-xs font-semibold flex items-center space-x-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Dismiss
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !description.trim()}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Grievance'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Submitted Complaints List */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>My Submitted Grievances</span>
          </h2>
          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
            {complaints.length} Total
          </span>
        </div>

        {complaints.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p>No complaints filed. You have no pending transport grievances.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {complaints.map((c) => (
              <div key={c.complaint_id} className="p-5 space-y-2.5 hover:bg-slate-50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-black text-xs text-slate-900">{c.category}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        c.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(c.timestamp).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {c.description}
                </p>

                {c.admin_remarks && (
                  <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1">
                      <span>Transport Admin Response:</span>
                    </div>
                    <p className="text-[11px] text-purple-800">{c.admin_remarks}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
