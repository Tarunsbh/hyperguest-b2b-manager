// ============================================================
// HyperGuest B2B Channel Manager - Zustand Store
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  PropertyDetail,
  StoredSubscription,
  StoredBooking,
  StoredCallback,
} from '../types';

// -------------------- NOTIFICATION --------------------

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: Math.random().toString(36).slice(2, 9),
          timestamp: new Date().toISOString(),
        },
        ...state.notifications,
      ].slice(0, 50), // cap at 50
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),
}));

// -------------------- APP --------------------

interface AppStore {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarOpen: true,

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'hg-app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme, sidebarOpen: state.sidebarOpen }),
    }
  )
);

// -------------------- PROPERTIES --------------------

// We store PropertyDetail in a plain object map because Map is not
// JSON-serialisable with zustand/persist out of the box.
interface PropertiesStore {
  selectedPropertyId: number | null;
  propertiesCache: Record<number, PropertyDetail>;
  setSelectedProperty: (id: number | null) => void;
  cacheProperty: (id: number, detail: PropertyDetail) => void;
  getCachedProperty: (id: number) => PropertyDetail | undefined;
  clearCache: () => void;
}

export const usePropertiesStore = create<PropertiesStore>((set, get) => ({
  selectedPropertyId: null,
  propertiesCache: {},

  setSelectedProperty: (id) => set({ selectedPropertyId: id }),

  cacheProperty: (id, detail) =>
    set((state) => ({
      propertiesCache: { ...state.propertiesCache, [id]: detail },
    })),

  getCachedProperty: (id) => get().propertiesCache[id],

  clearCache: () => set({ propertiesCache: {} }),
}));

// -------------------- SUBSCRIPTIONS --------------------

interface SubscriptionsStore {
  subscriptions: StoredSubscription[];
  selectedSubscriptionId: string | null;
  addSubscription: (sub: StoredSubscription) => void;
  updateSubscription: (subscriptionId: string, partial: Partial<StoredSubscription>) => void;
  setSelected: (subscriptionId: string | null) => void;
  removeSubscription: (subscriptionId: string) => void;
}

export const useSubscriptionsStore = create<SubscriptionsStore>((set) => ({
  subscriptions: [],
  selectedSubscriptionId: null,

  addSubscription: (sub) =>
    set((state) => ({
      subscriptions: [
        sub,
        ...state.subscriptions.filter((s) => s.subscriptionId !== sub.subscriptionId),
      ],
    })),

  updateSubscription: (subscriptionId, partial) =>
    set((state) => ({
      subscriptions: state.subscriptions.map((s) =>
        s.subscriptionId === subscriptionId ? { ...s, ...partial } : s
      ),
    })),

  setSelected: (subscriptionId) => set({ selectedSubscriptionId: subscriptionId }),

  removeSubscription: (subscriptionId) =>
    set((state) => ({
      subscriptions: state.subscriptions.filter((s) => s.subscriptionId !== subscriptionId),
    })),
}));

// -------------------- BOOKINGS --------------------

interface BookingsStore {
  bookings: StoredBooking[];
  addBooking: (booking: StoredBooking) => void;
  updateBooking: (reservationId: string, partial: Partial<StoredBooking>) => void;
}

export const useBookingsStore = create<BookingsStore>((set) => ({
  bookings: [],

  addBooking: (booking) =>
    set((state) => ({
      bookings: [booking, ...state.bookings],
    })),

  updateBooking: (reservationId, partial) =>
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.reservationId === reservationId ? { ...b, ...partial } : b
      ),
    })),
}));

// -------------------- CALLBACKS --------------------

interface CallbackStore {
  callbacks: StoredCallback[];
  totalUnprocessed: number;
  addCallback: (callback: StoredCallback) => void;
  markProcessed: (id: number) => void;
  clearCallbacks: () => void;
}

export const useCallbackStore = create<CallbackStore>((set) => ({
  callbacks: [],
  totalUnprocessed: 0,

  addCallback: (callback) =>
    set((state) => {
      const callbacks = [callback, ...state.callbacks];
      const totalUnprocessed = callbacks.filter((c) => !c.processed).length;
      return { callbacks, totalUnprocessed };
    }),

  markProcessed: (id) =>
    set((state) => {
      const callbacks = state.callbacks.map((c) =>
        c.id === id ? { ...c, processed: true, status: 'processed' } : c
      );
      const totalUnprocessed = callbacks.filter((c) => !c.processed).length;
      return { callbacks, totalUnprocessed };
    }),

  clearCallbacks: () => set({ callbacks: [], totalUnprocessed: 0 }),
}));

// -------------------- SETTINGS --------------------

interface SettingsState {
  staticToken: string;
  operationsToken: string;
  callbackToken: string;
  userId: string;
  email: string;
  callbackUrl: string;
}

interface SettingsStore extends SettingsState {
  update: (partial: Partial<SettingsState>) => void;
  reset: () => void;
}

const DEFAULT_SETTINGS: SettingsState = {
  staticToken: process.env.NEXT_PUBLIC_HG_STATIC_TOKEN || '',
  operationsToken: process.env.NEXT_PUBLIC_HG_OPERATIONS_TOKEN || '',
  callbackToken: process.env.NEXT_PUBLIC_HG_CALLBACK_TOKEN || '',
  userId: 'pradeep_s',
  email: 'it@eglobe-solutions.com',
  callbackUrl:
    process.env.NEXT_PUBLIC_EGLOBE_CALLBACK_URL ||
    'https://www.eglobe-solutions.com/webapichannelmanager/hyperguestb2bsubscription/callback/ariupdates',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      update: (partial) => set((state) => ({ ...state, ...partial })),

      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'hg-settings-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
