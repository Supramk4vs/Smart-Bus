import React from 'react';
import { useDriverTransportState } from './useDriverTransportState.ts';
import { DriverOverview } from './DriverOverview.tsx';
import { DriverBusGPS } from './DriverBusGPS.tsx';
import { DriverMyTrip } from './DriverMyTrip.tsx';
import { DriverStudents } from './DriverStudents.tsx';
import { DriverTripHistory } from './DriverTripHistory.tsx';
import { DriverBreakdown } from './DriverBreakdown.tsx';
import { DriverNotifications } from './DriverNotifications.tsx';
import { DriverProfile } from './DriverProfile.tsx';
import { DriverSettings } from './DriverSettings.tsx';
import { WelcomeScreen } from '../../components/WelcomeScreen.tsx';

interface DriverPortalProps {
  activeNav: string;
  onNavigate: (nav: string) => void;
}

export const DriverPortal: React.FC<DriverPortalProps> = ({ activeNav, onNavigate }) => {
  const state = useDriverTransportState();

  if (activeNav === 'WELCOME') {
    return (
      <WelcomeScreen
        role="DRIVER"
        userName={state.driver.driver_name}
        onNavigate={onNavigate}
      />
    );
  }

  if (activeNav === 'BUS_GPS') {
    return (
      <DriverBusGPS
        driver={state.driver}
        assignedBus={state.assignedBus}
        assignedRoute={state.assignedRoute}
        operationalBoardingPoints={state.operationalBoardingPoints}
        routeWaypoints={state.routeWaypoints}
        activeTrip={state.activeTrip}
        currentCoords={state.currentCoords}
        students={state.students}
        waitingCount={state.waitingCount}
        boardedCount={state.boardedCount}
        absentCount={state.absentCount}
        isStartingTrip={state.isStartingTrip}
        isEndingTrip={state.isEndingTrip}
        onStartTrip={state.handleStartTrip}
        onEndTrip={state.handleEndTrip}
        onBackToDashboard={() => onNavigate('DASHBOARD')}
      />
    );
  }

  if (activeNav === 'MY_TRIP') {
    return (
      <DriverMyTrip
        driver={state.driver}
        assignedBus={state.assignedBus}
        activeTrip={state.activeTrip}
        waitingCount={state.waitingCount}
        boardedCount={state.boardedCount}
        absentCount={state.absentCount}
        isStartingTrip={state.isStartingTrip}
        isEndingTrip={state.isEndingTrip}
        onStartTrip={state.handleStartTrip}
        onEndTrip={state.handleEndTrip}
        onNavigate={onNavigate}
      />
    );
  }

  if (activeNav === 'STUDENTS') {
    return (
      <DriverStudents
        students={state.students}
        onMarkBoarded={state.handleMarkBoarded}
        busNumber={state.assignedBus?.bus_number || state.driver.bus_number}
      />
    );
  }

  if (activeNav === 'TRIP_HISTORY') {
    return <DriverTripHistory completedTrips={state.completedTrips} />;
  }

  if (activeNav === 'BREAKDOWN') {
    return (
      <DriverBreakdown
        driver={state.driver}
        assignedBus={state.assignedBus}
      />
    );
  }

  if (activeNav === 'NOTIFICATIONS') {
    return <DriverNotifications />;
  }

  if (activeNav === 'PROFILE') {
    return (
      <DriverProfile
        driver={state.driver}
        assignedBus={state.assignedBus}
      />
    );
  }

  if (activeNav === 'SETTINGS') {
    return <DriverSettings />;
  }

  // Default: DASHBOARD
  return (
    <DriverOverview
      driver={state.driver}
      assignedBus={state.assignedBus}
      assignedRoute={state.assignedRoute}
      operationalBoardingPoints={state.operationalBoardingPoints}
      activeTrip={state.activeTrip}
      waitingCount={state.waitingCount}
      boardedCount={state.boardedCount}
      absentCount={state.absentCount}
      notSetCount={state.notSetCount}
      isStartingTrip={state.isStartingTrip}
      isEndingTrip={state.isEndingTrip}
      isGpsActive={state.isGpsActive}
      onStartTrip={state.handleStartTrip}
      onEndTrip={state.handleEndTrip}
      onNavigate={onNavigate}
    />
  );
};
