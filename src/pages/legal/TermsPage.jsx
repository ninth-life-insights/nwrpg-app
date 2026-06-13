// DRAFT — review and edit before public beta. Effective date below should be
// the date these terms first apply to users (i.e. when the beta opens).
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LegalPage.css';

const EFFECTIVE_DATE = 'TBD';
const CONTACT_EMAIL = 'catharinepace@gmail.com';

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <div className="legal-page-container">
        <header className="legal-page-header">
          <button
            className="legal-page-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          <h1 className="legal-page-title">Terms of Use</h1>
        </header>

        <p className="legal-page-meta">Effective {EFFECTIVE_DATE}</p>

        <div className="legal-page-content">
          <h2>1. What this is</h2>
          <p>
            This app is a personal productivity tool for managing daily tasks,
            quests, and home life, framed as an RPG adventure. It is currently
            in a closed beta and is provided as-is. Features may change, break,
            or be removed without notice.
          </p>

          <h2>2. Your account</h2>
          <p>
            You're responsible for keeping your login credentials safe and for
            anything that happens under your account. Don't share your account
            with others, and let us know at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if
            you think someone else has accessed it.
          </p>
          <p>
            You must be at least 13 years old to use this app.
          </p>

          <h2>3. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the app for illegal activity</li>
            <li>Attempt to access other users' data</li>
            <li>Probe, scan, or attempt to overwhelm the service</li>
            <li>Reverse-engineer, copy, or redistribute the app without permission</li>
            <li>Upload content that's abusive, harassing, or unlawful</li>
          </ul>
          <p>
            We may suspend or remove accounts that violate these terms, with or
            without notice.
          </p>

          <h2>4. Your content</h2>
          <p>
            You own the content you create in the app — missions, encounters,
            notes, character details, and so on. We need a limited license to
            store and display that content back to you in order to run the app.
            We don't claim ownership and we don't sell it. Your content is sent
            to third-party services to power features (see the{' '}
            <a href="/privacy">Privacy Policy</a> for the list).
          </p>

          <h2>5. AI-generated content</h2>
          <p>
            Some features use a large language model (currently Anthropic's
            Claude) to generate summary stories from your activity. AI output
            can be wrong, surprising, or unintentionally similar to other
            content. Don't rely on it for anything important.
          </p>

          <h2>6. No warranty</h2>
          <p>
            The app is provided "as-is" without warranties of any kind. We
            don't guarantee uptime, accuracy, or that the app will be free of
            bugs or data loss. You should keep your own backups of anything
            you can't afford to lose.
          </p>

          <h2>7. Limitation of liability</h2>
          <p>
            To the maximum extent allowed by law, we are not liable for any
            indirect, incidental, or consequential damages arising from your
            use of the app. Our total liability to you for any claim is
            limited to the amount you've paid us in the past 12 months (which,
            in the beta, is zero).
          </p>

          <h2>8. Changes to these terms</h2>
          <p>
            We may update these terms as the app evolves. If we make material
            changes, we'll notify you in the app or by email. Continued use
            after the change means you accept the new terms.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions, complaints, or feedback:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
