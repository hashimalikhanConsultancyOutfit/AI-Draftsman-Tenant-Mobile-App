import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MySurveyFillScreen } from '@/features/surveys/MySurveyFillScreen';
import { MySurveysScreen } from '@/features/surveys/MySurveysScreen';

import type { MySurveysStackParamList } from '../types';

const Stack = createNativeStackNavigator<MySurveysStackParamList>();

export function MySurveysStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MySurveysHome" component={MySurveysScreen} />
      <Stack.Screen name="MySurveyFill" component={MySurveyFillScreen} />
    </Stack.Navigator>
  );
}
