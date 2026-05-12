import './ColorPicker.css';

const ColorPicker = ({ colors, selectedColor, onSelectColor }) => (
  <div className="color-grid">
    {colors.map(color => (
      <button
        key={color.name}
        type="button"
        onClick={() => onSelectColor(color.name)}
        className={`color-option ${selectedColor === color.name ? 'selected' : ''}`}
        style={{ backgroundColor: color.value }}
      />
    ))}
  </div>
);

export default ColorPicker;
