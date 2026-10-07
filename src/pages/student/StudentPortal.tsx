import React from 'react';
import { useStudentTransportState } from './useStudentTransportState.ts';
import { StudentOverview } from './StudentOverview.tsx';
import { StudentLiveGPS } from './StudentLiveGPS.tsx';
import { StudentMyBus } from './StudentMyBus.tsx';
import { StudentScanQR } from './StudentScanQR.tsx';
import { StudentTripHistory } from './StudentTripHistory.tsx';
import { StudentComplaints } from './StudentComplaints.tsx';
import { StudentNotifications } from './StudentNotifications.tsx';
import { StudentProfile } from './StudentProfile.tsx';
import { StudentSettings } from './StudentSettings.tsx';
import { WelcomeScreen } from '../../components/WelcomeScreen.tsx';

interface StudentPortalProps {
  activeNav: string;
  onNavigate: (nav: string) => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ activeNav, onNavigate }) => {
  const state = useStudentTransportState();

  if (activeNav === 'WELCOME') {
    return (
      <WelcomeScreen
        role="STUDENT"
        userName={state.student.full_name}
        onNavigate={onNavigate}
      />
    );
  }

  if (activeNav === 'LIVE_GPS') {
    return (
      <StudentLiveGPS
        student={state.student}
        studentData={state.studentData}
        assignedBus={state.assignedBus}
        assignedRoute={state.assignedRoute}
        todayStatus={state.todayStatus}
        studentCoords={state.studentCoords}
        busLive={state.busLive}
        onUpdateStatus={state.handleStatusUpdate}
        onBackToDashboard={() => onNavigate('DASHBOARD')}
      />
    );
  }

  if (activeNav === 'MY_BUS') {
    return (
      <StudentMyBus
        student={state.student}
        assignedBus={state.assignedBus}
        assignedRoute={state.assignedRoute}
        busLive={state.busLive}
        onNavigate={onNavigate}
      />
    );
  }

  if (activeNav === 'SCAN_QR') {
    return (
      <StudentScanQR
        student={state.student}
        assignedBus={state.assignedBus}
        onAttendanceVerified={() => {
          state.loadStudentInfo();
          state.loadBoardingHistory();
        }}
        onNavigate={onNavigate}
      />
    );
  }

  if (activeNav === 'TRIP_HISTORY') {
    return (
      <StudentTripHistory
        boardingRecords={state.boardingRecords}
        isLoading={state.isLoadingHistory}
        onRefresh={state.loadBoardingHistory}
      />
    );
  }

  if (activeNav === 'COMPLAINTS') {
    return (
      <StudentComplaints
        student={state.student}
        complaints={state.complaints}
        onSubmitComplaint={state.fileComplaint}
      />
    );
  }

  if (activeNav === 'NOTIFICATIONS') {
    return <StudentNotifications />;
  }

  if (activeNav === 'PROFILE') {
    return (
      <StudentProfile
        student={state.student}
        assignedBus={state.assignedBus}
        onNavigate={onNavigate}
      />
    );
  }

  if (activeNav === 'SETTINGS') {
    return <StudentSettings />;
  }

  // Default: DASHBOARD
  return (
    <StudentOverview
      student={state.student}
      studentData={state.studentData}
      assignedBus={state.assignedBus}
      assignedRoute={state.assignedRoute}
      todayStatus={state.todayStatus}
      busLive={state.busLive}
      isUpdatingStatus={state.isUpdatingStatus}
      statusFeedbackBanner={state.statusFeedbackBanner}
      onUpdateStatus={state.handleStatusUpdate}
      onNavigate={onNavigate}
    />
  );
};
