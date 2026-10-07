import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { DriverUser, Bus as BusType } from '../../types/index.ts';
import { Api } from '../../lib/api.ts';
import { DriverSosButton } from '../../components/DriverSosButton.tsx';

interface DriverBreakdownProps {
  driver: DriverUser;
  assignedBus: BusType | null;
}

export const DriverBreakdown: React.FC<DriverBreakdownProps> = ({ driver, assignedBus }) => {
  const [issueType, setIssueType] = useState<string>('MECHANICAL_FAILURE');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    const busId = assignedBus?.bus_id || driver.assigned_bus_id || 'BUS-01';

    try {
      await Api.reportBreakdown(
        driver.driver_id,
        busId,
        assignedBus?.current_lat ?? null,
        assignedBus?.current_lng ?? null,
        `[${issueType}] ${description.trim()}`
      );
      setFeedback({
        type: 'success',
        text: 'Breakdown / delay broadcasted immediately to Transport Control and waiting students.',
      });
      setDescription('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to submit breakdown report.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>⚠️ Breakdown & Emergency Protocol</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Notify campus administration instantly regarding delays, punctures, mechanical stops, or road incidents
          </p>
        </div>

        {assignedBus?.bus_id && (
          <DriverSosButton busId={assignedBus.bus_id} driverId={driver.driver_id} />
        )}
      </div>

      <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="h-10 w-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Incident / Delay Report</h2>
            <p className="text-[11px] text-slate-500">
              Bus {assignedBus?.bus_number || 'College Bus'} &bull; Driver {driver.driver_name}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Type of Incident / Delay
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'MECHANICAL_FAILURE', label: 'Engine / Breakdown' },
                { id: 'FLAT_TIRE', label: 'Flat Tire / Puncture' },
                { id: 'TRAFFIC_JAM', label: 'Severe Traffic Delay' },
                { id: 'ROAD_BLOCK', label: 'Road Block / Diversion' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIssueType(item.id)}
                  className={`p-3 rounded-2xl text-xs font-bold text-center border transition cursor-pointer ${
                    issueType === item.id
                      ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-xs ring-1 ring-rose-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Current Location & Incident Details
            </label>
            <textarea
              rows={4}
              required
              placeholder="Detail your current location, estimated delay, whether backup bus is required..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 p-3.5 text-xs focus:outline-hidden focus:border-rose-600 focus:ring-1 focus:ring-rose-600"
            />
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center space-x-2 ${
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

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !description.trim()}
              className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{isSubmitting ? 'Transmitting Alert...' : 'Broadcast Delay / Breakdown Alert'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
