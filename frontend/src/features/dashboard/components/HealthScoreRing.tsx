import React, { useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  score: number;
  band: string;
  label: string;
  color: string;
}

const SIZE = 180;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function HealthScoreRing({ score, band, label, color }: Props) {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = React.useState(0);

  useEffect(() => {
    const listener = animatedValue.addListener(({ value }) => setDisplayScore(Math.round(value)));
    Animated.timing(animatedValue, { toValue: score, duration: 1200, useNativeDriver: false }).start();
    return () => animatedValue.removeListener(listener);
  }, [score]);

  const strokeDashoffset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke="#dee8ff" strokeWidth={STROKE_WIDTH} fill="transparent" />
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          stroke={color} strokeWidth={STROKE_WIDTH} fill="transparent"
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={styles.overlay}>
        <Text style={styles.scoreText}>{displayScore}</Text>
        <Text style={styles.scoreLabel}>{label}</Text>
        <View style={[styles.bandPill, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.bandText, { color }]}>{band.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  overlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 44, fontWeight: '800', letterSpacing: -1, color: '#111c2d' },
  scoreLabel: { fontSize: 12, color: '#434655', marginTop: 2, fontWeight: '500' },
  bandPill: { marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  bandText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
});
