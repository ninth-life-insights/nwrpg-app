import React, { useState } from 'react';

import './LandingPage.css';

const LandingPage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const slides = [
    {
      title: "Manage Your Priorities",
      content: "Plan your day like a pro tactician. Track the status of your base (home), adventuring party (family), missions (to-dos), and quests (projects)."
    },
    {
      title: "Track Your Progress",
      content: "Feel a sense of accomplishment with daily, weekly, and monthly reviews that combine stats with storytelling."
    },
    {
      title: "Make Life More Magical",
      content: "Add a dose of creativity or silliness to your day with avatars, achievements, and encounters! Where a tough day with a teething baby becomes 'curing the curse of the incisor!'"
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Handle touch events
  const minSwipeDistance = 50;

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

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  return (
    <div className="landing-container">
      {/* Header */}
      <header className="landing-header">
        <h1 className="landing-title">
          Make Motherhood an Adventure
        </h1>
      </header>

      {/* Card Slider */}
      <div className="slider-container">
        <div className="slider-wrapper">
          <div className="slides-container" style={{
            transform: `translateX(-${currentSlide * 100}%)`
          }}>
            {slides.map((slide, index) => (
              <div key={index} className="slide">
                <h2 className="slide-title">
                  {slide.title}
                </h2>
                <p className="slide-content">
                  {slide.content}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={prevSlide}
            className="nav-button prev"
          >
            ‹
          </button>

          <button
            onClick={nextSlide}
            className="nav-button next"
          >
            ›
          </button>
        </div>

        <div className="dots-container">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`dot ${index === currentSlide ? 'active' : 'inactive'}`}
            />
          ))}
        </div>
      </div>

      <div className="actions-container">
        <button className="primary-button"
        onClick={() => {
          // TODO: Navigate to signup flow
          console.log('Navigate to signup');
        }}
        >
          Begin the Journey
        </button>

        <div className="secondary-action">
          <span className="secondary-text">
            Already have an account?{' '}
          </span>
          <button className="secondary-button"
          onClick={() => {
            // TODO: Navigate to login
            console.log('Navigate to login');
          }}
          >
            Log in
          </button>
        </div>
      </div>


    </div>
  );
};

export default LandingPage;