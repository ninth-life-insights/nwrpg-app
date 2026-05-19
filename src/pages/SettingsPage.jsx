// src/pages/SettingsPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { db } from '../services/firebase/config';
import { getNotificationPrefs, saveNotificationPrefs } from '../services/notificationPrefsService';
import { requestPermission } from '../services/notificationService';
import { getUserProfile, updateUserProfile } from '../services/userService';
import { getDeletedMissionsCount } from '../services/missionService';
import { DAY_NAMES } from '../utils/weeklyReviewHelpers';
import ErrorMessage from '../components/ui/ErrorMessage';
import StickyFooter from '../components/ui/StickyFooter';
import './SettingsPage.css';

const formatTime = (hour, minute) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

const parseTime = (value) => {
  const [h, m] = value.split(':').map(Number);
  return { hour: h, minute: m };
};

const SettingsPage = () => {
  const { currentUser, logout } = useAuth();
  const { refreshSchedule } = useNotifications();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState(null);
  const [character, setCharacter] = useState(null);
  const [weekStartDay, setWeekStartDay] = useState(0); // default Sunday
  const [storyStyle, setStoryStyle] = useState('balanced');
  const [permissionState, setPermissionState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deletedCount, setDeletedCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    getDeletedMissionsCount(currentUser.uid)
      .then(setDeletedCount)
      .catch(() => setDeletedCount(0));
    getNotificationPrefs(currentUser.uid).then(setPrefs);
    getUserProfile(currentUser.uid).then(profile => {
      if (profile?.weekStartDay != null) {
        const stored = profile.weekStartDay;
        const dayNameMap = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
        const coerced = typeof stored === 'string'
          ? (dayNameMap[stored.toLowerCase()] ?? 0)
          : Number(stored);
        setWeekStartDay(Number.isFinite(coerced) ? coerced : 0);
      }
      if (profile?.storyStyle) setStoryStyle(profile.storyStyle);
    });
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      if (snap.exists()) setCharacter(snap.data().character ?? null);
    });
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
  };

  const handleMasterToggle = async () => {
    const turningOn = !prefs.enabled;

    if (turningOn && Notification.permission !== 'granted') {
      const result = await requestPermission();
      setPermissionState(result);
      if (result !== 'granted') return; // don't turn on if user denied
    }

    setPrefs((prev) => ({ ...prev, enabled: turningOn }));
  };

  const handleSubToggle = (key) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  };

  const handleTimeChange = (key, value) => {
    const { hour, minute } = parseTime(value);
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], hour, minute },
    }));
  };

  const handleSave = async () => {
    if (!currentUser || !prefs) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all([
        saveNotificationPrefs(currentUser.uid, prefs),
        updateUserProfile(currentUser.uid, { weekStartDay, storyStyle }),
      ]);
      await refreshSchedule();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("Your settings didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return (
      <div className="settings-container">
        <p className="settings-loading">Loading...</p>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <header className="settings-header">
        <button className="settings-back-button" onClick={() => navigate('/home')}>
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="settings-title">Settings</h1>
      </header>

      {character && (
        <section className="settings-section">
          <h2 className="settings-section-title">Character</h2>
          <button className="settings-character-preview" onClick={() => navigate('/edit-character')}>
            <img
              src={`/assets/Avatars/Party-Leader/small/${character.class.toLowerCase().replace(/\s+/g, '-')}-${character.color}-sm.png`}
              alt={character.class}
              className="settings-character-avatar"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="settings-character-info">
              <span className="settings-character-name">{character.name}</span>
              <span className="settings-character-title">{character.title}</span>
            </div>
            <span className="settings-character-edit-hint">
              Edit
              <span className="material-icons-outlined">chevron_right</span>
            </span>
          </button>
        </section>
      )}

      <section className="settings-section">
        <h2 className="settings-section-title">Notifications</h2>

        {permissionState === 'denied' && (
          <div className="settings-permission-banner">
            <span className="material-icons-outlined">notifications_off</span>
            <p>
              Notifications are blocked in your browser. To enable them, open your browser's
              site settings and allow notifications for this app.
            </p>
          </div>
        )}

        <div className="settings-row">
          <span className="settings-label">Enable notifications</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={handleMasterToggle}
              disabled={permissionState === 'denied'}
            />
            <span className="toggle-track" />
          </label>
        </div>

        {prefs.enabled && (
          <div className="settings-sub-section">
            <div className="settings-row">
              <div className="settings-row-label-group">
                <span className="settings-label">Plan your day</span>
                <span className="settings-hint">Opens daily planning</span>
              </div>
              <div className="settings-row-controls">
                <input
                  type="time"
                  className="settings-time-input"
                  value={formatTime(prefs.planYourDay.hour, prefs.planYourDay.minute)}
                  onChange={(e) => handleTimeChange('planYourDay', e.target.value)}
                  disabled={!prefs.planYourDay.enabled}
                />
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={prefs.planYourDay.enabled}
                    onChange={() => handleSubToggle('planYourDay')}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-label-group">
                <span className="settings-label">Review your day</span>
                <span className="settings-hint">Opens daily review</span>
              </div>
              <div className="settings-row-controls">
                <input
                  type="time"
                  className="settings-time-input"
                  value={formatTime(prefs.reviewYourDay.hour, prefs.reviewYourDay.minute)}
                  onChange={(e) => handleTimeChange('reviewYourDay', e.target.value)}
                  disabled={!prefs.reviewYourDay.enabled}
                />
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={prefs.reviewYourDay.enabled}
                    onChange={() => handleSubToggle('reviewYourDay')}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-label-group">
                <span className="settings-label">Due today reminders</span>
                <span className="settings-hint">Alert at 9 AM if missions are due</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={prefs.dueTodayAlerts.enabled}
                  onChange={() => handleSubToggle('dueTodayAlerts')}
                />
                <span className="toggle-track" />
              </label>
            </div>

            {/* <div className="settings-row">
              <div className="settings-row-label-group">
                <span className="settings-label">Overdue alerts</span>
                <span className="settings-hint">Alert at 9 AM if missions are overdue</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={prefs.overdueAlerts.enabled}
                  onChange={() => handleSubToggle('overdueAlerts')}
                />
                <span className="toggle-track" />
              </label>
            </div> */}
          </div>
        )}

      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Weekly Review</h2>

        <div className="settings-row">
          <div className="settings-row-label-group">
            <span className="settings-label">Week starts on</span>
            <span className="settings-hint">Your review window opens 2 days before this day</span>
          </div>
          <select
            value={weekStartDay}
            onChange={e => setWeekStartDay(Number(e.target.value))}
            className="settings-select"
          >
            {[6, 0, 1].map(i => (
              <option key={i} value={i}>{DAY_NAMES[i]}</option>
            ))}
          </select>
        </div>

        <StickyFooter>
          {saveError && <ErrorMessage message={saveError} />}
          <button
            className="settings-save-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </StickyFooter>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Review Stories</h2>
        <div className="settings-row-label-group">
          <span className="settings-label">Chronicle style</span>
          <span className="settings-hint">Controls the tone of your daily and weekly summaries</span>
        </div>
        <div className="settings-style-picker" role="group" aria-label="Chronicle style">
          {[
            { value: 'plain', label: 'Minimal', hint: 'Clear and simple' },
            { value: 'balanced', label: 'Balanced', hint: 'Light RPG flavor' },
            { value: 'high-fantasy', label: 'Epic', hint: 'Full fantasy mode' },
          ].map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              className={`settings-style-option${storyStyle === value ? ' settings-style-option--active' : ''}`}
              onClick={() => setStoryStyle(value)}
            >
              <span className="settings-style-option-label">{label}</span>
              <span className="settings-style-option-hint">{hint}</span>
            </button>
          ))}
        </div>
      </section>

      {deletedCount > 0 && (
        <section className="settings-section">
          <button
            className="settings-nav-row"
            onClick={() => navigate('/deleted-missions')}
          >
            <div className="settings-row-label-group">
              <span className="settings-label">Deleted missions</span>
              <span className="settings-hint">
                {deletedCount} {deletedCount === 1 ? 'mission' : 'missions'} ready to restore
              </span>
            </div>
            <span className="material-icons-outlined settings-nav-row-chevron">chevron_right</span>
          </button>
        </section>
      )}

      <section className="settings-section">
        <h2 className="settings-section-title">Account</h2>
        <div className="settings-row">
          <span className="settings-label">Email</span>
          <span className="settings-value">{currentUser?.email}</span>
        </div>
        <button className="settings-logout-btn" onClick={handleLogout}>
          Log out
        </button>
      </section>
    </div>
  );
};

export default SettingsPage;
