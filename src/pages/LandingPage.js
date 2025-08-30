import React, { useState } from 'react';

import './LandingPage.css';

const LandingPage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const slides = [
    {
      title: "Level Up Your Day",
      content: "Transform daily tasks into epic quests and watch your productivity soar as you complete challenges and unlock achievements."
    },
    {
      title: "Build Your Character",
      content: "Develop skills, earn experience points, and customize your mom avatar as you tackle everything from household management to personal goals."
    },
    {
      title: "Join the Guild",
      content: "Connect with other adventuring moms, share victories, and support each other through the ultimate RPG: motherhood."
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