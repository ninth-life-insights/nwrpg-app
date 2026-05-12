import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase/config';
import { useNavigate } from 'react-router-dom';

import ErrorMessage from '../components/ui/ErrorMessage';
import StickyFooter from '../components/ui/StickyFooter';
import { updateThemeColor } from '../utils/themeUtils';
import { PARTY_LEADER_TITLES } from '../data/partyLeaderTitles';
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

  const classes = ['Knight', 'Sorceress', 'Ranger', 'Storm Tamer', 'Entrepreneur', 'Vacationer'];
  const colors = [
    { name: 'blue', value: '#3b82f6' },
    { name: 'green', value: '#10b981' },
    { name: 'purple', value: '#8b5cf6' },
    { name: 'pink', value: '#ec4899' },
    { name: 'red', value: '#ef4444' },
  ];

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid))
      .then(snap => {
        if (snap.exists()) {
          const { character } = snap.data();
          if (character) {
            setName(character.name || '');
            setTitle(character.title || '');
            const classIndex = classes.indexOf(character.class);
            setSelectedClass(classIndex !== -1 ? classIndex : 0);
            setSelectedColor(character.color || 'blue');
            updateThemeColor(character.color || 'blue');
          }
        }
      })
      .catch(() => setLoadError("Couldn't load your character. Try refreshing."));
  }, [currentUser]);

  const getAvatar = (className, colorName) => {
    const classSlug = className.toLowerCase().replace(/\s+/g, '-');
    return `/assets/Avatars/Party-Leader/small/${classSlug}-${colorName}-sm.png`;
  };

  const handleColorChange = (colorName) => {
    setSelectedColor(colorName);
    updateThemeColor(colorName);
  };

  const autoGenerate = () => {
    const randomTitle = PARTY_LEADER_TITLES[Math.floor(Math.random() * PARTY_LEADER_TITLES.length)];
    setTitle(randomTitle);
    const randomClass = Math.floor(Math.random() * classes.length);
    setSelectedClass(randomClass);
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    handleColorChange(randomColor.name);
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
        'character.class': classes[selectedClass],
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
          <div className="class-carousel">
            <div className="class-container">
              <div className="class-slides">
                {classes.map((className, index) => (
                  <div
                    key={index}
                    className={`class-slide ${index === selectedClass ? 'selected' : ''}`}
                    onClick={() => setSelectedClass(index)}
                  >
                    <div className="class-avatar-placeholder">
                      <img
                        src={getAvatar(className, selectedColor)}
                        alt={`${className} ${selectedColor}`}
                        className="class-avatar-image"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                      <span className="class-name with-avatar">{className}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <label className="section-label">Appearance:</label>
          <div className="color-grid">
            {colors.map(color => (
              <button
                key={color.name}
                type="button"
                onClick={() => handleColorChange(color.name)}
                className={`color-option ${selectedColor === color.name ? 'selected' : ''}`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>

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
