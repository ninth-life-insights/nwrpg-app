import { PARTY_LEADER_TITLES } from './partyLeaderTitles';

export const CHARACTER_CLASSES = ['Knight', 'Sorceress', 'Ranger', 'Storm Tamer', 'Entrepreneur', 'Vacationer'];

export const CHARACTER_COLORS = [
  { name: 'blue',   value: '#3b82f6' },
  { name: 'green',  value: '#10b981' },
  { name: 'purple', value: '#8b5cf6' },
  { name: 'pink',   value: '#ec4899' },
  { name: 'red',    value: '#ef4444' },
];

export const getAvatarImage = (className, colorName) => {
  const classSlug = className.toLowerCase().replace(/\s+/g, '-');
  return `/assets/Avatars/Party-Leader/small/${classSlug}-${colorName}-sm.png`;
};

export const generateRandomCharacter = () => ({
  title:      PARTY_LEADER_TITLES[Math.floor(Math.random() * PARTY_LEADER_TITLES.length)],
  classIndex: Math.floor(Math.random() * CHARACTER_CLASSES.length),
  color:      CHARACTER_COLORS[Math.floor(Math.random() * CHARACTER_COLORS.length)].name,
});
