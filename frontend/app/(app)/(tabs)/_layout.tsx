import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { TAB_SCREENS, TAB_SCREEN_OPTIONS } from '@/constants/tabConfig';
import SyncFAB from '../../../src/components/SyncFAB';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={TAB_SCREEN_OPTIONS as any}>
        {TAB_SCREENS.map((screen) => (
          <Tabs.Screen
            key={screen.name}
            name={screen.name}
            options={{
              title: screen.title,
              tabBarLabel: screen.label,
              headerTitle: screen.name === 'index' ? () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#111c2d', letterSpacing: -0.5 }}>Campus</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#004ac6', letterSpacing: -0.5 }}>Flow</Text>
                </View>
              ) : undefined,
              tabBarIcon: ({ color, focused }) => (
                <View
                  style={{
                    backgroundColor: focused ? '#E8F0FF' : 'transparent',
                    borderRadius: 16,
                    width: 44,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 2,
                  }}
                >
                  <MaterialIcons
                    name={screen.icon}
                    size={focused ? 26 : 24}
                    color={color}
                  />
                </View>
              ),
              tabBarItemStyle: {
                marginRight: screen.name === 'calendar' ? 24 : 0,
                marginLeft: screen.name === 'nudges' ? 24 : 0,
              },
            }}
          />
        ))}
      </Tabs>
      <SyncFAB />
    </View>
  );
}