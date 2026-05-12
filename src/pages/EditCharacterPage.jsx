import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase/config';
import { useNavigate } from 'react-router-dom';

import ErrorMessage from '../components/ui/ErrorMessage';
import StickyFooter from '../components/ui/StickyFooter';
import ClassCarousel from '../components/character/ClassCarousel';
import ColorPicker from '../components/character/ColorPicker';
import { CHARACTER_CLASSES, CHARACTER_COLORS, generateRandomCharacter } from '../data/characterData';
import { updateThemeColor } from '../utils/themeUtils';
import '../components/character/CharacterForm.css';
import './EditCharacterPage.css';

const EditCharacterPage = () => {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState(0);
  const [selectedColor, setSelectedColor] = useState('blue');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid))
      .then(snap => {
        if (snap.exists()) {
          const { character } = snap.data();
          if (character) {
            setName(character.name || '');
            setTitle(character.title || '');
            const classIndex = CHARACTER_CLASSES.indexOf(character.class);
            setSelectedClass(classIndex !== -1 ? classIndex : 0);
            setSelectedColor(character.color || 'blue');
            updateThemeColor(character.color || 'blue');
          }
        }
      })
      .catch(() => setLoadError("Couldn't load your character. Try refreshing."));
  }, [currentUser]);

  const handleColorChange = (colorName) => {
    setSelectedColor(colorName);
    updateThemeColor(colorName);
  };

  const autoGenerate = () => {
    const { title: randomTitle, classIndex, color } = generateRandomCharacter();
    setTitle(randomTitle);
    setSelectedClass(classIndex);
    handleColorChange(color);
  };

  const handleSave = async () => {
    if (!name.trim()) { setSaveError('Please enter your name'); return; }
    if (!title.trim()) { setSaveError('Please enter your title'); return; }

    setSaveError(null);
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        'character.name': name.trim(),
        'character.title': title.trim(),
        'character.class': CHARACTER_CLASSES[selectedClass],
        'character.color': selectedColor,
        updatedAt: serverTimestamp(),
      });
      navigate('/settings');
    } catch {
      setSaveError("Your character didn't save. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-character-container">
      <header className="edit-character-header">
        <button className="edit-character-back-button" onClick={() => navigate('/settings')}>
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="edit-character-title">Edit Character</h1>
      </header>

      {loadError && <ErrorMessage message={loadError} />}

      <div className="edit-character-form">
        <div className="form-section">
          <div className="form-grouping">
            <label htmlFor="ec-name" className="section-label">Name:</label>
            <input
              id="ec-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="character-input"
              placeholder="Enter your name"
            />
          </div>
          <div className="form-grouping">
            <label htmlFor="ec-title" className="section-label">Title:</label>
            <input
              id="ec-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="character-input"
              placeholder="Enter your RPG title"
            />
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

          <div className="auto-generate-section">
            <button type="button" onClick={autoGenerate} className="auto-generate-btn">
              🎲 Auto-Generate
            </button>
          </div>
        </div>

        <StickyFooter>
          {saveError && <ErrorMessage message={saveError} />}
          <button
            className="save-character-btn"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </StickyFooter>
      </div>
    </div>
  );
};

export default EditCharacterPage;
