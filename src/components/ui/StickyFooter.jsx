import './StickyFooter.css';

/**
 * StickyFooter — fixed bottom action area for form pages.
 *
 * Use this for pages with a single primary save/submit/confirm action
 * that should stay visible regardless of scroll position.
 *
 * The parent scroll container must add `padding-bottom: 120px` so content
 * isn't hidden behind the footer.
 *
 * Props:
 *   children  — button(s) and any supporting text (e.g. validation hints, errors)
 *   bgColor   — CSS color value for the gradient base (default: var(--color-bg-main))
 *               Pass "var(--color-bg-white)" for pages with white backgrounds.
 *   className — optional extra class on the footer element
 */
const StickyFooter = ({ children, bgColor = 'var(--color-bg-main)', className = '' }) => {
  return (
    <div
      className={`sticky-footer ${className}`.trim()}
      style={{ background: `linear-gradient(to top, ${bgColor} 80%, transparent)` }}
    >
      {children}
    </div>
  );
};

export default StickyFooter;
