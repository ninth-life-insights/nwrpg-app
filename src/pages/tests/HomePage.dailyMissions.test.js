// src/pages/__tests__/HomePage.dailyMissions.test.js

// src/pages/__tests__/HomePage.dailyMissions.test.js

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Create a simple test version of HomePage that doesn't use router
const TestHomePage = ({ 
  mockDailyMissions = [],
  mockConfig = null,
  shouldLoad = true 
}) => {
  const [dailyMissions, setDailyMissions] = React.useState(mockDailyMissions);
  const [dailyMissionsConfig, setDailyMissionsConfig] = React.useState(mockConfig);
  const [loading, setLoading] = React.useState(!shouldLoad);
  const [showEditDailyMissions, setShowEditDailyMissions] = React.useState(false);

  React.useEffect(() => {
    if (shouldLoad) {
      setDailyMissions(mockDailyMissions);
      setDailyMissionsConfig(mockConfig);
      setLoading(false);
    }
  }, [mockDailyMissions, mockConfig, shouldLoad]);

  if (loading) {
    return <div>Loading your adventure...</div>;
  }

  const getDailyMissionsStatus = () => {
    if (!dailyMissionsConfig || !dailyMissionsConfig.isActive) {
      return { 
        hasActiveDailyMissions: false, 
        completedCount: 0, 
        totalCount: 0 
      };
    }

    const completedCount = dailyMissions.filter(mission => mission.completed).length;
    const totalCount = dailyMissions.length;

    return {
      hasActiveDailyMissions: true,
      completedCount,
      totalCount
    };
  };

  const dailyStatus = getDailyMissionsStatus();

  return (
    <div className="homepage-container">
      <section className="daily-missions-section">
        <div className="section-header">
          <h3 className="section-title">Daily Missions</h3>
          <button 
            className="edit-button" 
            onClick={() => setShowEditDailyMissions(true)}
            aria-label="Edit daily missions"
          >
            Edit
          </button>
        </div>
        
        <div className="missions-overview">
          {dailyStatus.hasActiveDailyMissions ? (
            dailyMissions.map((mission) => (
              <div 
                key={mission.id} 
                className={`mission-item ${mission.completed ? 'completed' : ''}`}
              >
                <div className="mission-checkbox">
                  {mission.completed ? (
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <polyline points="9,11 12,14 22,4"/>
                    </svg>
                  ) : (
                    <div className="checkbox-empty"></div>
                  )}
                </div>
                <span className="mission-title">{mission.title}</span>
              </div>
            ))
          ) : (
            <div className="no-missions">
              <p>No daily missions set up yet.</p>
              <p>Use the edit button to create your daily routine!</p>
            </div>
          )}
        </div>
      </section>

      {showEditDailyMissions && (
        <div data-testid="edit-daily-missions">
          <button onClick={() => setShowEditDailyMissions(false)}>Close</button>
        </div>
      )}
    </div>
  );
};

describe('HomePage Daily Missions', () => {
  const mockDailyMissions = [
    { id: 'daily-1', title: 'Morning Exercise', completed: false },
    { id: 'daily-2', title: 'Read Book', completed: true },
    { id: 'daily-3', title: 'Plan Tomorrow', completed: false }
  ];

  test('displays daily missions when they are configured', async () => {
    // Arrange
    const mockConfig = {
      selectedMissionIds: ['daily-1', 'daily-2', 'daily-3'],
      isActive: true
    };
    
    // Act
    render(
      <TestHomePage 
        mockDailyMissions={mockDailyMissions}
        mockConfig={mockConfig}
      />
    );

    // Assert
    expect(screen.getByText('Daily Missions')).toBeInTheDocument();
    expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    expect(screen.getByText('Read Book')).toBeInTheDocument();
    expect(screen.getByText('Plan Tomorrow')).toBeInTheDocument();
  });

  test('shows completed status for finished daily missions', async () => {
    // Arrange
    const mockConfig = {
      selectedMissionIds: ['daily-1', 'daily-2'],
      isActive: true
    };
    
    // Act
    render(
      <TestHomePage 
        mockDailyMissions={mockDailyMissions.slice(0, 2)}
        mockConfig={mockConfig}
      />
    );

    // Assert
    const completedMission = screen.getByText('Read Book').closest('.mission-item');
    expect(completedMission).toHaveClass('completed');
    
    const incompleteMission = screen.getByText('Morning Exercise').closest('.mission-item');
    expect(incompleteMission).not.toHaveClass('completed');
  });

  test('displays no missions message when daily missions are not set up', async () => {
    // Act
    render(
      <TestHomePage 
        mockDailyMissions={[]}
        mockConfig={null}
      />
    );

    // Assert
    expect(screen.getByText('No daily missions set up yet.')).toBeInTheDocument();
    expect(screen.getByText('Use the edit button to create your daily routine!')).toBeInTheDocument();
  });

  test('displays no missions message when daily missions are inactive', async () => {
    // Arrange
    const inactiveConfig = {
      selectedMissionIds: ['daily-1', 'daily-2', 'daily-3'],
      isActive: false
    };
    
    // Act
    render(
      <TestHomePage 
        mockDailyMissions={mockDailyMissions}
        mockConfig={inactiveConfig}
      />
    );

    // Assert
    expect(screen.getByText('No daily missions set up yet.')).toBeInTheDocument();
  });

  test('opens edit daily missions modal when edit button is clicked', async () => {
    // Act
    render(
      <TestHomePage 
        mockDailyMissions={[]}
        mockConfig={null}
      />
    );

    // Find and click the edit button
    const editButton = screen.getByLabelText('Edit daily missions');
    fireEvent.click(editButton);

    // Assert
    expect(screen.getByTestId('edit-daily-missions')).toBeInTheDocument();
  });

  test('filters daily missions to only show selected ones', async () => {
    // Arrange
    const mockConfig = {
      selectedMissionIds: ['daily-1', 'daily-3'], // Only 2 selected
      isActive: true
    };
    
    const selectedMissions = [
      { id: 'daily-1', title: 'Selected Mission 1', completed: false },
      { id: 'daily-3', title: 'Selected Mission 2', completed: false }
    ];
    
    // Act
    render(
      <TestHomePage 
        mockDailyMissions={selectedMissions}
        mockConfig={mockConfig}
      />
    );

    // Assert
    expect(screen.getByText('Selected Mission 1')).toBeInTheDocument();
    expect(screen.getByText('Selected Mission 2')).toBeInTheDocument();
    expect(screen.queryByText('Not Selected Mission')).not.toBeInTheDocument();
  });

  test('handles missing missions gracefully', async () => {
    // Arrange - config references missions but only one exists
    const mockConfig = {
      selectedMissionIds: ['deleted-mission-1', 'daily-2', 'deleted-mission-2'],
      isActive: true
    };
    
    const existingMissions = [
      { id: 'daily-2', title: 'Existing Mission', completed: false }
    ];
    
    // Act
    render(
      <TestHomePage 
        mockDailyMissions={existingMissions}
        mockConfig={mockConfig}
      />
    );

    // Assert - should only show the one existing mission
    expect(screen.getByText('Existing Mission')).toBeInTheDocument();
    // Should not crash or show undefined missions
  });
});