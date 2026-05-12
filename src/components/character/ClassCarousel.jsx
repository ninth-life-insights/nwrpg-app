import { getAvatarImage } from '../../data/characterData';
import './ClassCarousel.css';

const ClassCarousel = ({ classes, selectedClass, onSelectClass, selectedColor }) => (
  <div className="class-carousel">
    <div className="class-container">
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

export default ClassCarousel;
