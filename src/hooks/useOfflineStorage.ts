import { useState, useEffect } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface StudyDB extends DBSchema {
  flashcards: {
    key: string;
    value: {
      id: string;
      topic: string;
      question: string;
      answer: string;
      difficulty_level: string;
      mastery_level: number;
      synced: boolean;
      lastModified: number;
    };
  };
  studySessions: {
    key: string;
    value: {
      id: string;
      planId: string;
      topic: string;
      duration: number;
      notes: string;
      synced: boolean;
      timestamp: number;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}

export function useOfflineStorage() {
  const [db, setDb] = useState<IDBPDatabase<StudyDB> | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const initDB = async () => {
      const database = await openDB<StudyDB>('StudyPlannerDB', 1, {
        upgrade(db) {
          // Create object stores
          if (!db.objectStoreNames.contains('flashcards')) {
            db.createObjectStore('flashcards', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('studySessions')) {
            db.createObjectStore('studySessions', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        },
      });
      setDb(database);
    };

    initDB();

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveFlashcard = async (flashcard: any) => {
    if (!db) return;
    
    const flashcardData = {
      ...flashcard,
      synced: isOnline,
      lastModified: Date.now()
    };

    await db.put('flashcards', flashcardData);
  };

  const getFlashcards = async () => {
    if (!db) return [];
    return await db.getAll('flashcards');
  };

  const saveStudySession = async (session: any) => {
    if (!db) return;
    
    const sessionData = {
      ...session,
      synced: isOnline,
      timestamp: Date.now()
    };

    await db.put('studySessions', sessionData);
  };

  const getUnsyncedData = async () => {
    if (!db) return { flashcards: [], sessions: [] };
    
    const flashcards = await db.getAll('flashcards');
    const sessions = await db.getAll('studySessions');
    
    return {
      flashcards: flashcards.filter(f => !f.synced),
      sessions: sessions.filter(s => !s.synced)
    };
  };

  const markAsSynced = async (type: 'flashcards' | 'studySessions', id: string) => {
    if (!db) return;
    
    const item = await db.get(type, id);
    if (item) {
      item.synced = true;
      await db.put(type, item);
    }
  };

  const saveSetting = async (key: string, value: any) => {
    if (!db) return;
    await db.put('settings', { key, value });
  };

  const getSetting = async (key: string) => {
    if (!db) return null;
    const setting = await db.get('settings', key);
    return setting?.value || null;
  };

  return {
    isOnline,
    saveFlashcard,
    getFlashcards,
    saveStudySession,
    getUnsyncedData,
    markAsSynced,
    saveSetting,
    getSetting
  };
}