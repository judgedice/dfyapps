import type { Survey } from '../survey';
import { survey as workflowSurvey } from './workflow-survey';
import { survey as howYouWork } from './how-you-work';
import { survey as workSurvey } from './work-survey';

/** Every published survey, by id (also its URL path). */
export const surveys: Record<string, Survey> = {
  [howYouWork.id]: howYouWork,
  [workSurvey.id]: workSurvey,
};

/**
 * Surveys no longer published. The server keeps their submit endpoint and CSV export, so earlier
 * responses stay downloadable, and sends visitors to the page in `redirectTo`.
 */
export const retiredSurveys: { survey: Survey; redirectTo: string }[] = [
  { survey: workflowSurvey, redirectTo: workSurvey.id },
];

export const DEFAULT_SURVEY_ID = workSurvey.id;

export function getSurvey(id: string | undefined): Survey {
  const survey = surveys[id || DEFAULT_SURVEY_ID];
  if (!survey) throw new Error(`Unknown survey "${id}". Known: ${Object.keys(surveys).join(', ')}`);
  return survey;
}
