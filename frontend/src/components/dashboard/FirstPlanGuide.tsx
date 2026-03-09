import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, X } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';
import { tripAPI } from '@/services/api';
import {
  emitGuideChanged,
  getGuideEventName,
  isGuideCompleted,
  isGuideDismissed,
  isGuideExportDone,
  setGuideCompleted,
  setGuideDismissed,
} from '@/utils/firstPlanGuide';

type GuideFlags = {
  dismissed: boolean;
  completed: boolean;
  exportDone: boolean;
};

function readFlags(tripId: string): GuideFlags {
  return {
    dismissed: isGuideDismissed(tripId),
    completed: isGuideCompleted(tripId),
    exportDone: isGuideExportDone(tripId),
  };
}

export default function FirstPlanGuide() {
  const { currentTrip, setActiveTab, setSelectedDay } = useTripStore();
  const [flags, setFlags] = useState<GuideFlags>({ dismissed: false, completed: false, exportDone: false });

  useEffect(() => {
    if (!currentTrip) return;
    setFlags(readFlags(currentTrip.id));
  }, [currentTrip?.id]);

  useEffect(() => {
    if (!currentTrip) return;
    const eventName = getGuideEventName();
    const onGuideChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ tripId?: string }>).detail;
      if (detail?.tripId && detail.tripId !== currentTrip.id) return;
      setFlags(readFlags(currentTrip.id));
    };
    window.addEventListener(eventName, onGuideChanged);
    return () => window.removeEventListener(eventName, onGuideChanged);
  }, [currentTrip?.id]);

  if (!currentTrip) return null;

  const hasAnyContent =
    currentTrip.plan.length > 0 ||
    currentTrip.flights.length > 0 ||
    currentTrip.stays.length > 0 ||
    currentTrip.activities.length > 0 ||
    currentTrip.weather.length > 0 ||
    !!currentTrip.overview;
  if (!hasAnyContent) return null;

  const totalPlanActivities = currentTrip.plan.reduce((sum, day) => sum + day.activities.length, 0);
  const hasPrimaryFlight = currentTrip.flights.length === 0 || !!currentTrip.selectedFlightId;
  const hasPrimaryStay = currentTrip.stays.length === 0 || !!currentTrip.selectedStayId;

  const steps = useMemo(() => {
    return [
      {
        id: 'primary',
        title: 'Select primary flight and stay',
        description: 'Lock the main transport and accommodation.',
        done: hasPrimaryFlight && hasPrimaryStay,
        onClick: () => {
          setSelectedDay(null);
          if (!hasPrimaryFlight) {
            setActiveTab('flights');
            return;
          }
          if (!hasPrimaryStay) {
            setActiveTab('stays');
            return;
          }
          setActiveTab('overview');
        },
      },
      {
        id: 'activities',
        title: 'Add at least 3 activities to plan days',
        description: `Current progress: ${totalPlanActivities}/3 added.`,
        done: totalPlanActivities >= 3,
        onClick: () => {
          setSelectedDay(null);
          setActiveTab('activities');
        },
      },
      {
        id: 'export',
        title: 'Export your overview',
        description: 'Use the Export button in the top-right corner.',
        done: flags.exportDone,
        onClick: () => {
          setSelectedDay(null);
          setActiveTab('overview');
        },
      },
    ];
  }, [flags.exportDone, hasPrimaryFlight, hasPrimaryStay, setActiveTab, setSelectedDay, totalPlanActivities]);

  const doneCount = steps.filter((step) => step.done).length;
  const isFullyDone = doneCount === steps.length;
  const firstIncomplete = steps.find((step) => !step.done);

  useEffect(() => {
    if (!isFullyDone || flags.completed) return;
    setGuideCompleted(currentTrip.id, true);
    emitGuideChanged(currentTrip.id);
    setFlags((prev) => ({ ...prev, completed: true }));
    tripAPI.trackUsageEvent(currentTrip.id, 'first_plan_guide_completed', {
      stepsCompleted: doneCount,
    }).catch(() => undefined);
  }, [currentTrip.id, doneCount, flags.completed, isFullyDone]);

  if (flags.dismissed || flags.completed) return null;

  return (
    <div className="card print-hide" style={{ padding: 16, marginBottom: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--navy-900)' }}>First-plan guide</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--navy-500)' }}>
            Complete these 3 steps once to finish your first usable trip.
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setGuideDismissed(currentTrip.id, true);
            emitGuideChanged(currentTrip.id);
            setFlags((prev) => ({ ...prev, dismissed: true }));
            tripAPI.trackUsageEvent(currentTrip.id, 'first_plan_guide_dismissed').catch(() => undefined);
          }}
          title="Dismiss guide"
        >
          <X size={14} /> Dismiss
        </button>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {steps.map((step) => (
          <div
            key={step.id}
            style={{
              border: '1px solid var(--navy-100)',
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: step.done ? 'var(--success-50)' : 'var(--surface)',
            }}
          >
            {step.done ? (
              <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
            ) : (
              <Circle size={15} style={{ color: 'var(--navy-400)' }} />
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>{step.title}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--navy-500)' }}>{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {firstIncomplete && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              firstIncomplete.onClick();
              tripAPI.trackUsageEvent(currentTrip.id, 'first_plan_guide_step_clicked', {
                stepId: firstIncomplete.id,
              }).catch(() => undefined);
            }}
          >
            Continue <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
