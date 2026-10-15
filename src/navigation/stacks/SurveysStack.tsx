import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SurveyDetailScreen } from '@/features/surveys/SurveyDetailScreen';
import { SurveyScheduleFormScreen } from '@/features/surveys/SurveyScheduleFormScreen';
import { SurveysScreen } from '@/features/surveys/SurveysScreen';
import { SurveyWizardScreen } from '@/features/surveys/SurveyWizardScreen';

import type { SurveysStackParamList } from '../types';

const Stack = createNativeStackNavigator<SurveysStackParamList>();

export function SurveysStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SurveysHome" component={SurveysScreen} />
      <Stack.Screen name="SurveyDetail" component={SurveyDetailScreen} />
      {/* A full page, as on web (`/surveys/new`) — it pushes the schedule
          form over itself, so it is not a modal of its own. */}
      <Stack.Screen name="SurveyWizard" component={SurveyWizardScreen} />
      <Stack.Screen name="SurveyScheduleForm" component={SurveyScheduleFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
