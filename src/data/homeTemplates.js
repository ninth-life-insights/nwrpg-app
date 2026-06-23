// Starter home templates. Each is a named grouping of rooms the user can
// batch-create instead of adding them one at a time. Edit freely — this is
// content, not contract.
//
// Each room declares the icon value the AddRoomModal would have used,
// matching ROOM_ICONS in src/components/base/AddRoomModal.jsx.
//
// Bedroom and bathroom icons cycle through visual variants so multiple of
// the same room type don't look identical in the bank.

export const HOME_TEMPLATES = [
  {
    id: 'studio',
    name: 'Studio',
    description: 'Open-plan single room with kitchen and bathroom.',
    rooms: [
      { name: 'Studio',   icon: 'Room-couch.jpg' },
      { name: 'Kitchen',  icon: 'Room-kitchen.png' },
      { name: 'Bathroom', icon: 'Room-Shower.jpg' },
    ],
  },
  {
    id: '1-bed-1-bath',
    name: '1 bed, 1 bath',
    description: 'Bedroom, bathroom, kitchen, and living room.',
    rooms: [
      { name: 'Bedroom',     icon: 'Room-bed.jpg' },
      { name: 'Bathroom',    icon: 'Room-Shower.jpg' },
      { name: 'Kitchen',     icon: 'Room-kitchen.png' },
      { name: 'Living Room', icon: 'Room-couch.jpg' },
      { name: 'Entryway',    icon: 'Room-entry.jpg' },
    ],
  },
  {
    id: '2-bed-1-bath-apt',
    name: '2 bed, 1 bath apartment',
    description: 'Two bedrooms, one bathroom, kitchen, and living room.',
    rooms: [
      { name: 'Primary Bedroom', icon: 'Room-bed.jpg' },
      { name: 'Second Bedroom',  icon: 'Room-sleep.png' },
      { name: 'Bathroom',        icon: 'Room-Shower.jpg' },
      { name: 'Kitchen',         icon: 'Room-kitchen.png' },
      { name: 'Living Room',     icon: 'Room-couch.jpg' },
      { name: 'Entryway',        icon: 'Room-entry.jpg' },
    ],
  },
  {
    id: '2-bed-2-bath',
    name: '2 bed, 2 bath',
    description: 'Two bedrooms, two bathrooms, kitchen, living and dining.',
    rooms: [
      { name: 'Primary Bedroom',  icon: 'Room-bed.jpg' },
      { name: 'Second Bedroom',   icon: 'Room-sleep.png' },
      { name: 'Primary Bathroom', icon: 'Room-Shower.jpg' },
      { name: 'Guest Bathroom',   icon: 'Room-toilet.jpg' },
      { name: 'Kitchen',          icon: 'Room-kitchen.png' },
      { name: 'Living Room',      icon: 'Room-couch.jpg' },
      { name: 'Dining Room',      icon: 'Room-dining.jpg' },
      { name: 'Entryway',         icon: 'Room-entry.jpg' },
    ],
  },
  {
    id: '3-bed-2-bath',
    name: '3 bed, 2 bath home',
    description: 'Three bedrooms, two bathrooms, kitchen, living, dining, and laundry.',
    rooms: [
      { name: 'Primary Bedroom',  icon: 'Room-bed.jpg' },
      { name: 'Second Bedroom',   icon: 'Room-sleep.png' },
      { name: 'Third Bedroom',    icon: 'Room-books.png' },
      { name: 'Primary Bathroom', icon: 'Room-Shower.jpg' },
      { name: 'Guest Bathroom',   icon: 'Room-toilet.jpg' },
      { name: 'Kitchen',          icon: 'Room-kitchen.png' },
      { name: 'Living Room',      icon: 'Room-couch.jpg' },
      { name: 'Dining Room',      icon: 'Room-dining.jpg' },
      { name: 'Laundry Room',     icon: 'Room-laundry.png' },
      { name: 'Entryway',         icon: 'Room-entry.jpg' },
    ],
  },
  {
    id: '3-bed-2-bath-family',
    name: '3 bed, 2 bath with kids',
    description: 'Family layout — adds a nursery and playroom, no separate dining room.',
    rooms: [
      { name: 'Primary Bedroom',  icon: 'Room-bed.jpg' },
      { name: 'Kid\'s Bedroom',   icon: 'Room-sleep.png' },
      { name: 'Nursery',          icon: 'Room-crib.png' },
      { name: 'Primary Bathroom', icon: 'Room-Shower.jpg' },
      { name: 'Guest Bathroom',   icon: 'Room-toilet.jpg' },
      { name: 'Kitchen',          icon: 'Room-kitchen.png' },
      { name: 'Living Room',      icon: 'Room-couch.jpg' },
      { name: 'Playroom',         icon: 'Room-toys.png' },
      { name: 'Laundry Room',     icon: 'Room-laundry.png' },
      { name: 'Entryway',         icon: 'Room-entry.jpg' },
    ],
  },
  {
    id: '4-bed-3-bath',
    name: '4 bed, 3 bath house',
    description: 'Larger home with garage and outdoor space.',
    rooms: [
      { name: 'Primary Bedroom',  icon: 'Room-bed.jpg' },
      { name: 'Second Bedroom',   icon: 'Room-sleep.png' },
      { name: 'Third Bedroom',    icon: 'Room-books.png' },
      { name: 'Fourth Bedroom',   icon: 'Room-bed.jpg' },
      { name: 'Primary Bathroom', icon: 'Room-Shower.jpg' },
      { name: 'Guest Bathroom',   icon: 'Room-toilet.jpg' },
      { name: 'Powder Room',      icon: 'Room-bath.png' },
      { name: 'Kitchen',          icon: 'Room-kitchen.png' },
      { name: 'Living Room',      icon: 'Room-couch.jpg' },
      { name: 'Dining Room',      icon: 'Room-dining.jpg' },
      { name: 'Laundry Room',     icon: 'Room-laundry.png' },
      { name: 'Entryway',         icon: 'Room-entry.jpg' },
      { name: 'Garage',           icon: 'Room-garage.png' },
      { name: 'Outdoors',         icon: 'Room-outdoors.png' },
    ],
  },
];

export const getTemplateById = (id) =>
  HOME_TEMPLATES.find(t => t.id === id) ?? null;
