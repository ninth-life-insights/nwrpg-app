import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy,
    onSnapshot
  } from 'firebase/firestore';
  import { db } from './config';
  
  // User profile operations
  export const createUserProfile = async (userId, profileData) => {
    const userRef = doc(db, 'users', userId);
    return updateDoc(userRef, profileData);
  };
  
  export const getUserProfile = async (userId) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() : null;
  };
  
  // Mission operations
  export const createMission = async (userId, missionData) => {
    const missionsRef = collection(db, 'users', userId, 'missions');
    return addDoc(missionsRef, {
      ...missionData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  };
  
  export const updateMission = async (userId, missionId, updates) => {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    return updateDoc(missionRef, {
      ...updates,
      updatedAt: new Date()
    });
  };
  
  export const getUserMissions = async (userId) => {
    const missionsRef = collection(db, 'users', userId, 'missions');
    const q = query(missionsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  };
  
  // Real-time listeners
  export const listenToUserMissions = (userId, callback) => {
    const missionsRef = collection(db, 'users', userId, 'missions');
    const q = query(missionsRef, orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const missions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(missions);
    });
  };