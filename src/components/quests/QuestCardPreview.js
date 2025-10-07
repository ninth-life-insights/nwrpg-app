// src/components/quests/QuestCardPreview.js
// This is a test/preview component to see how QuestCard looks with sample data

import React from 'react';
import QuestCard from './QuestCard';
import { QUEST_STATUS, QUEST_DIFFICULTY } from '../../types/Quests';

const QuestCardPreview = () => {
  // Mock quest data
  const mockActiveQuest = {
    id: 'quest-1',
    title: 'Spring Cleaning',
    status: QUEST_STATUS.ACTIVE,
    difficulty: QUEST_DIFFICULTY.MEDIUM,
    xpReward: 20,
    xpAwarded: null,
    missionIds: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
    missionOrder: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
    completedMissionIds: ['m1', 'm2', 'm3'],
    totalMissions: 7,
    completedMissions: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null
  };

  const mockPlanningQuest = {
    id: 'quest-2',
    title: 'Plan Family Vacation',
    status: QUEST_STATUS.PLANNING,
    difficulty: QUEST_DIFFICULTY.EASY,
    xpReward: 10,
    xpAwarded: null,
    missionIds: ['m8', 'm9', 'm10'],
    missionOrder: ['m8', 'm9', 'm10'],
    completedMissionIds: [],
    totalMissions: 3,
    completedMissions: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null
  };

  const mockCompletedQuest = {
    id: 'quest-3',
    title: 'Organize Home Office',
    status: QUEST_STATUS.COMPLETED,
    difficulty: QUEST_DIFFICULTY.HARD,
    xpReward: 40,
    xpAwarded: 40,
    missionIds: ['m11', 'm12', 'm13', 'm14', 'm15'],
    missionOrder: ['m11', 'm12', 'm13', 'm14', 'm15'],
    completedMissionIds: ['m11', 'm12', 'm13', 'm14', 'm15'],
    totalMissions: 5,
    completedMissions: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date()
  };

  // Mock next mission for active quest
  const mockNextMission = {
    id: 'm4',
    title: 'Clean kitchen thoroughly',
    description: 'Deep clean all kitchen surfaces, appliances, and organize pantry',
    status: 'active',
    difficulty: 'medium',
    xpReward: 10,
    completionType: 'simple',
    dueDate: '',
    questId: 'quest-1',
    questOrder: 3,
    isDailyMission: false
  };

  const handleMissionToggleComplete = (missionId, isCompleted, xpReward) => {
    console.log('Toggle complete:', missionId, isCompleted, xpReward);
    alert(`Mission ${missionId} ${isCompleted ? 'completed' : 'uncompleted'}`);
  };

  const handleMissionViewDetails = (mission) => {
    console.log('View details:', mission);
    alert(`Viewing details for: ${mission.title}`);
  };

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>Quest Card Preview</h1>
      
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
          Active Quest (with next mission)
        </h2>
        <QuestCard
          quest={mockActiveQuest}
          nextMission={mockNextMission}
          onMissionToggleComplete={handleMissionToggleComplete}
          onMissionViewDetails={handleMissionViewDetails}
        />
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
          Planning Quest (no missions started)
        </h2>
        <QuestCard
          quest={mockPlanningQuest}
          nextMission={null}
          onMissionToggleComplete={handleMissionToggleComplete}
          onMissionViewDetails={handleMissionViewDetails}
        />
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
          Completed Quest
        </h2>
        <QuestCard
          quest={mockCompletedQuest}
          nextMission={null}
          onMissionToggleComplete={handleMissionToggleComplete}
          onMissionViewDetails={handleMissionViewDetails}
        />
      </div>

      <div style={{ 
        marginTop: '40px', 
        padding: '20px', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        maxWidth: '600px',
        margin: '40px auto'
      }}>
        <h3>Notes:</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>The first quest shows an active quest with 3/7 missions completed</li>
          <li>It displays the next uncompleted mission in the "Next up" section</li>
          <li>The second quest is in planning mode with no missions started</li>
          <li>The third quest is completed and shows the completion message</li>
          <li>Click "View Full Quest →" to navigate (will show route in console)</li>
          <li>Mission interactions will show alerts (for testing)</li>
        </ul>
      </div>
    </div>
  );
};

export default QuestCardPreview;