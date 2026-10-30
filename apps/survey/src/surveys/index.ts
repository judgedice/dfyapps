import type { Survey } from '../survey';
import { survey as workflowSurvey } from './workflow-survey';
import { survey as howYouWork } from './how-you-work';
import { survey as workSurvey } from './work-survey';

/** Every survey this app can serve, by id (also its URL path). */
export const surveys: Record<string, Survey> = {
  [workflowSurvey.id]: workflowSurvey,
  [howYouWork.id]: howYouWork,
  [workSurvey.id]: workSurvey,
};

export const DEFAULT_SURVEY_ID = workflowSurvey.id;

export function getSurvey(id: string | undefined): Survey {
  const survey = surveys[id || DEFAULT_SURVEY_ID];
  if (!survey) throw new Error(`Unknown survey "${id}". Known: ${Object.keys(surveys).join(', ')}`);
  return survey;
}
