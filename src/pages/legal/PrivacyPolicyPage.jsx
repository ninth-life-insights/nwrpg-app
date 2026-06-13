// DRAFT — review and edit before public beta. The data inventory below was
// derived from the current Firestore schema (see CLAUDE.md "Firestore Data
// Model"). If you add new collections or third-party services, update this
// page so it stays accurate.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LegalPage.css';

const EFFECTIVE_DATE = '6/30/26';
const CONTACT_EMAIL = 'cat@ninthlifeinsights.com';

export default function PrivacyPolicyPage() {
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
          <h1 className="legal-page-title">Privacy Policy</h1>
        </header>

        <p className="legal-page-meta">Effective {EFFECTIVE_DATE}</p>

        <div className="legal-page-content">
          <h2>The short version</h2>
          <p>
            We collect what's needed to run the app and nothing more. We don't
            sell your data. You can request a copy or deletion of your account
            at any time by emailing{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Account info:</strong> the email address you sign up with,
              and a password hashed by our authentication provider (we never
              see your plaintext password).
            </li>
            <li>
              <strong>Character profile:</strong> the name, title, class, and
              theme color you choose at character creation.
            </li>
            <li>
              <strong>Your content:</strong> missions, quests, routines,
              encounters, rooms, daily and weekly review entries, and any text
              you write into the app.
            </li>
            <li>
              <strong>Activity:</strong> mission completions, XP earned, skill
              progression, and the timestamps of those events.
            </li>
            <li>
              <strong>Preferences:</strong> notification times, week start day,
              review tone, and similar settings.
            </li>
          </ul>
          <p>
            We do <strong>not</strong> collect: location data, contacts, photos
            from your device, browsing history outside this app, or analytics
            cookies for advertising.
          </p>

          <h2>How we use it</h2>
          <ul>
            <li>To run the app's features for you (showing your missions, computing XP, etc.)</li>
            <li>To send transactional emails (email verification, password reset)</li>
            <li>To generate AI summary stories of your week and day (see below)</li>
            <li>To debug crashes and improve the app</li>
          </ul>

          <h2>Research and product improvement</h2>
          <p>
            To make the app better, we may analyze patterns of how the app is
            used — which features are popular, where people get stuck, what
            kinds of missions or quests are common. When we do this, we work
            with the data in aggregated and de-identified form: we look at
            "what's typical across users," not "what did one specific person
            do." We do not publish or share individual content, and we do not
            use your content to train AI models.
          </p>

          <h2>Third parties that process your data</h2>
          <p>
            We use the following services as data processors. They operate
            under their own privacy policies, which we encourage you to review.
          </p>
          <ul>
            <li>
              <strong>Google (Firebase):</strong> authentication, database
              (Firestore), file storage, and analytics. Your account and all
              your content is stored on Google Cloud infrastructure.{' '}
              <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">
                Firebase privacy
              </a>
            </li>
            <li>
              <strong>Vercel:</strong> hosts the app's web frontend and
              serverless functions. Receives request metadata (IP, user agent)
              for routing and abuse prevention.{' '}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                Vercel privacy
              </a>
            </li>
            <li>
              <strong>Anthropic (Claude):</strong> when you generate a daily or
              weekly review story, a summary of your day's activity (mission
              titles, completions, encounters) is sent to Anthropic's API to
              produce the story. We do not send your email or character
              identity.{' '}
              <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">
                Anthropic privacy
              </a>
            </li>
            <li>
              <strong>Sentry:</strong> receives crash reports when the app
              errors out, so we can fix bugs. Reports include the error
              message, stack trace, the page you were on, and your account ID
              (not your email). They do not include the contents of your
              missions, encounters, or other personal text.{' '}
              <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer">
                Sentry privacy
              </a>
            </li>
          </ul>

          <h2>Where your data lives</h2>
          <p>
            Data is stored in Google Cloud regions managed by Firebase. By
            using the app you understand that data may be transferred to and
            processed in countries other than your own, including the United
            States.
          </p>

          <h2>How long we keep it</h2>
          <p>
            We keep your data for as long as your account is active. If you
            ask us to delete your account, we'll mark it for deletion and
            remove the underlying data within 30 days, except where we're
            legally required to retain something (e.g. abuse logs).
          </p>

          <h2>Your rights</h2>
          <p>You can ask us to:</p>
          <ul>
            <li>Send you a copy of the data we hold about you</li>
            <li>Correct anything that's wrong</li>
            <li>Delete your account and associated data</li>
          </ul>
          <p>
            Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with
            your request. We'll respond within 30 days.
          </p>

          <h2>Children</h2>
          <p>
            This app is not intended for users under 13. If we learn we've
            collected data from a child under 13, we'll delete it.
          </p>

          <h2>Security</h2>
          <p>
            We use industry-standard protections including encrypted transport
            (HTTPS), per-user access rules on our database, and authentication
            tokens that expire. No system is perfect — if you believe your
            account or our service has been compromised, please email us
            immediately.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            If we change this policy in a way that materially affects you,
            we'll notify you in the app or by email before the change takes
            effect.
          </p>

          <h2>Contact</h2>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
