// src/pages/SettingsPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getNotificationPrefs, saveNotificationPrefs } from '../services/notificationPrefsService';
import { requestPermission } from '../services/notificationService';
import { getUserProfile, updateUserProfile } from '../services/userService';
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
  const { currentUser } = useAuth();
  const { refreshSchedule } = useNotifications();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState(null);
  const [weekStartDay, setWeekStartDay] = useState('monday');
  const [permissionState, setPermissionState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    getNotificationPrefs(currentUser.uid).then(setPrefs);
    getUserProfile(currentUser.uid).then(profile => {
      if (profile?.weekStartDay) setWeekStartDay(profile.weekStartDay);
    });
  }, [currentUser]);

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
        updateUserProfile(currentUser.uid, { weekStartDay }),
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
            <span className="settings-hint">Your review window opens the day before your week ends</span>
          </div>
          <select
            className="settings-select"
            value={weekStartDay}
            onChange={(e) => setWeekStartDay(e.target.value)}
          >
            <option value="saturday">Saturday</option>
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
          </select>
        </div>
      </section>

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
    </div>
  );
};

export default SettingsPage;
