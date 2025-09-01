import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase/config';
import { useNavigate } from 'react-router-dom';

import './CharacterCreationPage.css';

import { PARTY_LEADER_TITLES } from '../data/partyLeaderTitles';

const CharacterCreationPage = () => {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState(0);
  const [selectedColor, setSelectedColor] = useState('blue');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { currentUser } = useAuth();

  const classes = ['Knight', 'Sorceress', 'Storm Tamer', "l'Artiste"];
  const colors = [
    { name: 'blue', value: '#3b82f6' },
    { name: 'green', value: '#10b981' },
    { name: 'purple', value: '#8b5cf6' },
    { name: 'pink', value: '#ec4899' },
    { name: 'red', value: '#ef4444' }
  ];

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

  // Updated touch handlers for multi-card carousel
    const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentIndex < classes.length - 3) {
        // Swipe left - move to next set of cards
        setCurrentIndex(prev => Math.min(prev + 1, classes.length - 3));
    } else if (isRightSwipe && currentIndex > 0) {
        // Swipe right - move to previous set of cards
        setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
    };

  const autoGenerate = () => {
    // Generate random title
    const randomTitle = PARTY_LEADER_TITLES[Math.floor(Math.random() * PARTY_LEADER_TITLES.length)];
    setTitle(randomTitle);

    // Generate random class
    const randomClass = Math.floor(Math.random() * classes.length);
    setSelectedClass(randomClass);

    // Generate random color
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setSelectedColor(randomColor.name);
  };

  const navigateToHome = () => {
    useNavigate('/home');
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

      navigateToHome;

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
    <label htmlFor="name" className="section-label">Title:</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="character-input"
            placeholder="Enter your RPG title"
          />

          <label className="section-label">Class:</label>
            <div 
            className="class-carousel"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            >
            <div className="class-container">
                <div className="class-slides" style={{
                transform: `translateX(-${currentIndex * (100 / 3)}%)`
                }}>
                {classes.map((className, index) => (
                    <div 
                    key={index} 
                    className={`class-slide ${index === selectedClass ? 'selected' : ''}`}
                    onClick={() => setSelectedClass(index)}
                    >
                    <div className="class-avatar-placeholder">
                        <span className="class-name">{className}</span>
                    </div>
                    </div>
                ))}
                </div>
                {/* Gradient overlays for fade effect */}
                <div className="gradient-overlay gradient-left"></div>
                <div className="gradient-overlay gradient-right"></div>
            </div>

            {/* Class dots indicator */}



            <div className="class-dots">
                {classes.map((_, index) => (
                <button
                // TODO: Update for relevance to multiple visible scroll carousel
                    key={index}
                    type="button"
                    onClick={() => {
                    setSelectedClass(index);
                    // Auto-scroll to show selected item if it's not visible
                    const newIndex = Math.max(0, Math.min(index - 1, classes.length - 3));
                    setCurrentIndex(newIndex);
                    }}
                    className={`class-dot ${index === selectedClass ? 'active' : 'inactive'}`}
                />
                ))}
            </div>
            </div>

            {/* Color Select */}
          <label className="section-label">Appearance:</label>
          <div className="color-grid">
            {colors.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => setSelectedColor(color.name)}
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