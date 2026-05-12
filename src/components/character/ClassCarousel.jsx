import { useRef, useEffect } from 'react';
import { getAvatarImage } from '../../data/characterData';
import './ClassCarousel.css';

const ClassCarousel = ({ classes, selectedClass, onSelectClass, selectedColor }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slide = container.querySelectorAll('.class-slide')[selectedClass];
    if (!slide) return;
    const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
    container.scrollTo({ left: slideCenter - container.offsetWidth / 2, behavior: 'smooth' });
  }, [selectedClass]);

  return (
    <div className="class-carousel">
      <div className="class-container" ref={containerRef}>
        <div className="class-slides">
          {classes.map((className, index) => (
            <div
              key={index}
              className={`class-slide ${index === selectedClass ? 'selected' : ''}`}
              onClick={() => onSelectClass(index)}
            >
              <div className="class-avatar-placeholder">
                <img
                  src={getAvatarImage(className, selectedColor)}
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
  );
};

export default ClassCarousel;
