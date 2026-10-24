// Expo Router's stack draws iOS's glass effect, a native view jest-expo has no
// double for; the tests draw a plain view in its place.
import { View } from 'react-native';

export const GlassView = View;
export const GlassContainer = View;
export const isLiquidGlassAvailable = () => false;
export const isGlassEffectAPIAvailable = () => false;
