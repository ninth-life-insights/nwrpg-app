import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useQuests } from '../../contexts/QuestsContext';
import { useMissions } from '../../contexts/MissionsContext';
import { useDailyMissions } from '../../contexts/DailyMissionsContext';
import { db } from '../../services/firebase/config';
import { useNavigate } from 'react-router-dom';
import { initializeTutorialQuest } from '../../services/tutorialService';

import ErrorMessage from '../../components/ui/ErrorMessage';
import StickyFooter from '../../components/ui/StickyFooter';
import ClassCarousel from '../../components/character/ClassCarousel';
import ColorPicker from '../../components/character/ColorPicker';
import { CHARACTER_CLASSES, CHARACTER_COLORS, generateRandomTitle, generateRandomLook } from '../../data/characterData';
import { updateThemeColor } from '../../utils/themeUtils';
import '../../components/character/CharacterForm.css';
import './CharacterCreationPage.css';

const CharacterCreationPage = () => {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState(0);
  const [selectedColor, setSelectedColor] = useState('blue');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { currentUser, markCharacterCreated } = useAuth();
  const { refreshQuests } = useQuests();
  const { refresh: refreshMissions } = useMissions();
  const { refreshDailyMissions } = useDailyMissions();
  const navigate = useNavigate();

  useEffect(() => {
    updateThemeColor(selectedColor);
  }, []);

  const handleColorChange = (colorName) => {
    setSelectedColor(colorName);
    updateThemeColor(colorName);
  };

  const shuffleTitle = () => {
    setTitle(generateRandomTitle());
  };

  const shuffleLook = () => {
    const { classIndex, color } = generateRandomLook();
    setSelectedClass(classIndex);
    handleColorChange(color);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!title.trim()) {
      setError('Please enter your title');
      return;
    }

    try {
      setError('');
      setLoading(true);

      const characterData = {
        name: name.trim(),
        title: title.trim(),
        class: CHARACTER_CLASSES[selectedClass],
        color: selectedColor,
        createdAt: new Date(),
        level: 1,
        experience: 0,
      };

      await setDoc(doc(db, 'users', currentUser.uid), {
        character: characterData,
        onboardingCompleted: false,
        updatedAt: new Date(),
      }, { merge: true });

      markCharacterCreated();

      // Seed the onboarding tutorial quest. Don't block signup on failure —
      // HomePage retries on mount when tutorialSeedFailed is set.
      let seedSucceeded = false;
      try {
        await initializeTutorialQuest(currentUser.uid);
        seedSucceeded = true;
      } catch (seedError) {
        console.error('Tutorial quest seed failed:', seedError);
        await setDoc(doc(db, 'users', currentUser.uid), {
          tutorialSeedFailed: true,
        }, { merge: true }).catch(() => {});
      }

      // After a successful seed, refresh the shared contexts so they pick up
      // the freshly-written quest, missions, and daily config. They were
      // already populated (empty) when the user landed here, and don't
      // refetch on their own without something forcing them to.
      if (seedSucceeded) {
        await Promise.all([
          refreshQuests?.(),
          refreshMissions?.(),
          refreshDailyMissions?.(),
        ].map(p => Promise.resolve(p).catch(() => {})));
      }

      navigate('/home');
    } catch (error) {
      console.error('Error creating character:', error);
      setError("Your character didn't save. Your choices are still here — try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="character-creation-container">
      <header className="character-header">
        <h1 className="character-title">Create Your Character</h1>
        <p className="character-subtitle">Every adventuring party needs a leader, and you're just the mom for the job!</p>
      </header>

      {error && <ErrorMessage message={error} />}

      <div className="character-form">
        <div className="form-section">
          <div className="form-grouping">
            <label htmlFor="name" className="section-label">Name:</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              className="character-input"
              placeholder="Enter your name"
            />
          </div>
          <div className="form-grouping">
            <label htmlFor="title" className="section-label">Title:</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={60}
              className="character-input"
              placeholder="Enter your RPG title"
            />
            <button type="button" className="title-shuffle-btn" onClick={shuffleTitle} title="Random title">
              <span className="material-icons-outlined">sync</span>
            </button>
          </div>

          <label className="section-label">Class:</label>
          <ClassCarousel
            classes={CHARACTER_CLASSES}
            selectedClass={selectedClass}
            onSelectClass={setSelectedClass}
            selectedColor={selectedColor}
          />

          <label className="section-label">Appearance:</label>
          <ColorPicker
            colors={CHARACTER_COLORS}
            selectedColor={selectedColor}
            onSelectColor={handleColorChange}
          />

          <div className="look-shuffle-row">
            <button type="button" className="look-shuffle-btn" onClick={shuffleLook}>
              <span className="material-icons-outlined">sync</span>
              Shuffle look
            </button>
          </div>
        </div>

        <StickyFooter>
          <button onClick={handleSubmit} className="create-character-btn" disabled={loading}>
            Begin Your Adventure
          </button>
        </StickyFooter>
      </div>
    </div>
  );
};

export default CharacterCreationPage;
