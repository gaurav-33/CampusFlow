import { create } from 'zustand';
import client from '../api/client';
import { saveToken, saveStudent, clearStorage, getToken, getStudent } from '../utils/storage';

export interface CampusEvent {
  eventId: string;
  title: string;
  timestamp: string | null;
  type: 'exam' | 'assignment' | 'lab' | 'lecture' | 'meeting' | 'other';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'missed';
  venue?: string;
  courseCode?: string;
  description?: string;
}

export interface HealthScore {
  score: number;
  band: 'healthy' | 'at-risk' | 'critical';
  label: string;
  color: string;
  breakdown: {
    urgencyPenalty: number;
    proximityPenalty: number;
    completionBonus: number;
    pendingCritical: number;
    pendingMedium: number;
    pendingLow: number;
    completedCount: number;
    totalCount: number;
  };
}

export interface UserProfile {
  name: string;
  healthScore: number;
  band: string;
  label: string;
  color: string;
  createdAt: string;
  lastLogin: string;
  expoPushToken?: string;
  onboarded?: boolean;
  college?: string;
  branch?: string;
  year?: string;
}

interface Store {
  profile: UserProfile | null;
  events: CampusEvent[];
  completedEvents: CampusEvent[];
  nudges: any[];
  briefing: { briefingText: string; generatedAt: string } | null;
  healthScore: HealthScore | null;
  lastFetched: string | null;
  isLoading: boolean;
  isIngesting: boolean;
  ingestStatus: 'idle' | 'queued' | 'error';
  ingestMessage: string;
  isAuthenticated: boolean;
  studentId: string;
  studentName: string;

  login: (studentId: string, password: string) => Promise<void>;
  register: (studentId: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  fetchDashboard: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  skipOnboarding: () => void;
  ingestText: (text: string, source?: string) => Promise<void>;
  clearIngestStatus: () => void;
  markEventDone: (eventSk: string) => Promise<void>;
  updateProfileMeta: (college: string, branch: string, year: string) => Promise<void>;
  hasSeenOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  profile: null,
  events: [],
  completedEvents: [],
  nudges: [],
  briefing: null,
  healthScore: null,
  lastFetched: null,
  isLoading: false,
  isIngesting: false,
  ingestStatus: 'idle',
  ingestMessage: '',
  isAuthenticated: false,
  studentId: '',
  studentName: '',
  hasSeenOnboarding: false,

  login: async (studentId, password) => {
    set({ isLoading: true });
    try {
      const { data } = await client.post('/auth/login', { studentId, password });
      await saveToken(data.token);
      await saveStudent({ studentId: data.studentId, name: data.name });
      set({ isAuthenticated: true, studentId: data.studentId, studentName: data.name, isLoading: false });
      await get().fetchDashboard();
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(err.response?.data?.error || 'Login failed');
    }
  },

  register: async (studentId, name, password) => {
    set({ isLoading: true });
    try {
      const { data } = await client.post('/auth/register', { studentId, name, password });
      await saveToken(data.token);
      await saveStudent({ studentId: data.studentId, name: data.name });
      set({ isAuthenticated: true, studentId: data.studentId, studentName: data.name, isLoading: false });
      await get().fetchDashboard();
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(err.response?.data?.error || 'Registration failed');
    }
  },

  logout: async () => {
    try {
      await clearStorage();
    } catch (e) {
      console.error('[Store] clearStorage failed:', e);
    }
    set({ isAuthenticated: false, profile: null, events: [], completedEvents: [], nudges: [], briefing: null, healthScore: null, lastFetched: null, studentId: '', studentName: '' });
  },

  restoreSession: async () => {
    const { getHasSeenOnboarding } = await import('../utils/storage');
    const seen = await getHasSeenOnboarding();
    const token = await getToken();
    const student = await getStudent();
    if (token && student) {
      set({ isAuthenticated: true, studentId: student.studentId, studentName: student.name, hasSeenOnboarding: seen });
      await get().fetchDashboard();
    } else {
      set({ hasSeenOnboarding: seen });
    }
  },

  completeOnboarding: async () => {
    const { setHasSeenOnboarding } = await import('../utils/storage');
    await setHasSeenOnboarding();
    set({ hasSeenOnboarding: true });
  },

  fetchDashboard: async () => {
    set({ isLoading: true });
    try {
      const { data } = await client.get('/dashboard');
      set({ 
        profile: data.profile, 
        events: data.upcomingEvents || [], 
        completedEvents: data.completedEvents || [],
        nudges: data.nudges || [],
        briefing: data.briefing || null,
        healthScore: data.healthScore, 
        lastFetched: data.meta?.fetchedAt || new Date().toISOString(),
        isLoading: false 
      });
    } catch (err: any) {
      console.error('[Store] fetchDashboard failed:', err);
      if (err.response?.status === 403 || err.response?.status === 401) {
        get().logout();
      }
      set({ isLoading: false });
      throw err;
    }
  },

  updateProfile: async (updates) => {
    try {
      const { studentId } = get();
      if (!studentId) throw new Error('Not logged in');
      await client.patch('/profile', updates);
      // Optimistic update
      const currentProfile = get().profile || { name: get().studentName } as any;
      set({ profile: { ...currentProfile, ...updates } });
    } catch (err: any) {
      console.error('[Store] updateProfile failed:', err.response?.data || err.message);
      throw err;
    }
  },

  skipOnboarding: () => {
    const currentProfile = get().profile || { name: get().studentName } as any;
    set({ profile: { ...currentProfile, onboarded: true } });
  },

  ingestText: async (text, source = 'DIRECT_TEXT') => {
    set({ isIngesting: true, ingestStatus: 'idle', ingestMessage: '' });
    try {
      await client.post('/ingest', { rawText: text, source });
      set({ isIngesting: false, ingestStatus: 'queued', ingestMessage: '🧠 AI is processing your text... pulling updates!' });
      
      // Auto-poll after a few seconds to let backend finish
      setTimeout(async () => {
        try {
          await get().fetchDashboard();
        } catch (e) {
          console.warn('Auto-poll fetch failed', e);
        }
        get().clearIngestStatus();
      }, 10000);
      
    } catch (err: any) {
      console.error('[Store] ingestText failed:', err);
      set({ isIngesting: false, ingestStatus: 'error', ingestMessage: 'Sync failed. Try again.' });
    }
  },

  clearIngestStatus: () => set({ ingestStatus: 'idle', ingestMessage: '' }),

  markEventDone: async (eventSk: string) => {
    const previousState = get();
    const eventToMark = previousState.events.find(e => e.eventId === eventSk);
    if (!eventToMark) return;

    // Optimistic update
    set((state) => ({
      events: state.events.filter((e) => e.eventId !== eventSk),
      completedEvents: [
        { ...eventToMark, status: 'completed', completedAt: new Date().toISOString() },
        ...state.completedEvents
      ],
      healthScore: state.healthScore ? {
        ...state.healthScore,
        score: Math.min(100, state.healthScore.score + 3),
      } : null,
      profile: state.profile ? {
        ...state.profile,
        healthScore: Math.min(100, state.profile.healthScore + 3),
      } : null
    }));

    // 2. Background Sync
    try {
      const response = await client.patch('/event', { studentId: previousState.studentId, eventSk });
      
      // Update with the true score returned by backend
      if (response.data && response.data.newScore) {
        set((state) => ({
          healthScore: state.healthScore ? { ...state.healthScore, score: response.data.newScore } : null
        }));
      }
    } catch (err: any) {
      console.error('[Store] markEventDone failed, rolling back:', err);
      // Rollback on failure
      set({ 
        events: previousState.events,
        completedEvents: previousState.completedEvents,
        healthScore: previousState.healthScore,
        profile: previousState.profile
      });
    }
  },

  updateProfileMeta: async (college: string, branch: string, year: string) => {
    const previousState = get();
    if (!previousState.profile) return;

    // Optimistic update
    set({
      profile: {
        ...previousState.profile,
        college,
        branch,
        year
      }
    });

    try {
      await client.patch('/profile', { college, branch, year });
    } catch (err: any) {
      console.error('[Store] updateProfileMeta failed, rolling back:', err);
      // Rollback on failure
      set({ profile: previousState.profile });
    }
  }
}));
