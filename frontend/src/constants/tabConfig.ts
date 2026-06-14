import { MaterialIcons } from '@expo/vector-icons';

export const TAB_SCREENS = [
  {
    name: 'index',
    title: 'CampusFlow',
    label: 'Dashboard',
    icon: 'dashboard' as keyof typeof MaterialIcons.glyphMap,
  },
  {
    name: 'calendar',
    title: 'Timeline',
    label: 'Calendar',
    icon: 'event-note' as keyof typeof MaterialIcons.glyphMap,
  },
  {
    name: 'nudges',
    title: 'Intelligence',
    label: 'AI Nudges',
    icon: 'auto-awesome' as keyof typeof MaterialIcons.glyphMap,
  },
  {
    name: 'settings',
    title: 'Settings',
    label: 'Settings',
    icon: 'settings' as keyof typeof MaterialIcons.glyphMap,
  },
];

export const TAB_SCREEN_OPTIONS = {
  headerShown: true,
  headerShadowVisible: false,

  headerStyle: {
    backgroundColor: '#ffffff',
  },

  headerTitleStyle: {
    color: '#111c2d',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerTitleAlign: 'center',

  tabBarShowLabel: true,

  tabBarStyle: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 32,
    height: 70,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderTopWidth: 1, // override default expo border
    elevation: 8,
    shadowColor: '#004ac6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    paddingTop: 10,
    paddingBottom: 10,
  },

  tabBarActiveTintColor: '#004ac6',
  tabBarInactiveTintColor: '#434655',

  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
};