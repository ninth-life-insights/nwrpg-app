import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase/config';
import { useNavigate } from 'react-router-dom';

import './CharacterCreationPage.css';

import { updateThemeColor } from '../utils/themeUtils';

import { PARTY_LEADER_TITLES } from '../data/partyLeaderTitles';

const CharacterCreationPage = () => {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState(0);
  const [selectedColor, setSelectedColor] = useState('blue');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { currentUser } = useAuth();

  const classes = ['Knight', 'Sorceress', 'Ranger', 'Storm Tamer', "Entrepreneur", "Vacationer"];
  const colors = [
    { name: 'blue', value: '#3b82f6' },
    { name: 'green', value: '#10b981' },
    { name: 'purple', value: '#8b5cf6' },
    { name: 'pink', value: '#ec4899' },
    { name: 'red', value: '#ef4444' }
  ];

  // Helper to darken color for hover state
  const adjustColorBrightness = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  };

  // Apply theme color on mount
  useEffect(() => {
    updateThemeColor(selectedColor);
  }, []);

  const handleColorChange = (colorName) => {
    setSelectedColor(colorName);
    updateThemeColor(colorName);
  };

  const getAvatar = (className, colorName) => {
    const classSlug = className.toLowerCase().replace(/\s+/g, '-');
    return `/assets/Avatars/Party-Leader/small/${classSlug}-${colorName}-sm.png`;
  };

  const nextClass = () => {
    setSelectedClass((prev) => (prev + 1) % classes.length);
  };

  const prevClass = () => {
    setSelectedClass((prev) => (prev - 1 + classes.length) % classes.length);
  };

  const goToClass = (index) => {
    setSelectedClass(index);
  };

  const [currentIndex, setCurrentIndex] = useState(0);

  // Handle touch events for class carousel
  const minSwipeDistance = 50;

  const autoGenerate = () => {
    // Generate random title
    const randomTitle = PARTY_LEADER_TITLES[Math.floor(Math.random() * PARTY_LEADER_TITLES.length)];
    setTitle(randomTitle);

    // Generate random class
    const randomClass = Math.floor(Math.random() * classes.length);
    setSelectedClass(randomClass);

    // Generate random color
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    handleColorChange(randomColor.name);
  };

  const navigate = useNavigate();

  const navigateToHome = () => {
    navigate('/home');
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
        class: classes[selectedClass],
        color: selectedColor,
        createdAt: new Date(),
        level: 1,
        experience: 0
      };

      // Save character data to Firestore
      await setDoc(doc(db, 'users', currentUser.uid), {
        character: characterData,
        onboardingCompleted: false,
        updatedAt: new Date()
      }, { merge: true });

      navigateToHome();

      console.log('Character created successfully:', characterData);
      // TODO: Navigate to next onboarding step
      
    } catch (error) {
      console.error('Error creating character:', error);
      setError('Failed to create character. Please try again.');
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

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="character-form">
        {/* Name Field */}
        <div className="form-section">
            <div className="form-grouping">
          <label htmlFor="name" className="section-label">Name:</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
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
                          onError={(e) => {
                            console.warn(`Failed to load avatar for ${className} ${selectedColor}`);
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                        <span className="class-name with-avatar">
                          {className}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Color Select */}
          <label className="section-label">Appearance:</label>
          <div className="color-grid">
            {colors.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => handleColorChange(color.name)}
                className={`color-option ${selectedColor === color.name ? 'selected' : ''}`}
                style={{ backgroundColor: color.value }}

              />
            ))}
          </div>
          
          {/* Auto-Generate Button */}
        <div className="auto-generate-section">
          <button 
            type="button"
            onClick={autoGenerate}
            className="auto-generate-btn"
            title="Auto-generate character"
          >
            🎲 Auto-Generate
          </button>
        </div>
        </div>

        {/* Submit Button */}
        <button onClick={handleSubmit} className="create-character-btn">
          Begin Your Adventure
        </button>
      </div>
    </div>
  );
};

export default CharacterCreationPage;