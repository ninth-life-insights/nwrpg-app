import './Skeleton.css';

// A single pulsing placeholder block. Compose into page- or card-shaped
// skeletons. Sits at low contrast on either warm or white surfaces.
const Skeleton = ({
  width,
  height,
  radius = 'var(--radius-sm)',
  className = '',
  style = {},
  inline = false,
}) => {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${inline ? 'skeleton-inline' : ''} ${className}`}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
};

export default Skeleton;
