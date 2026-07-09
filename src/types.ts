export interface ResumeDraft {
  id: string;
  jobTitle: string;
  strengths: string;
  experience: string;
  generatedTitle: string;
  generatedSubtitle: string;
  paragraphs: string[];
  recommendation: string;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  targetJob: string;
  careerLength: string;
  tonePreference: string;
}

export interface KeywordRecommendation {
  tag: string;
  reason: string;
  example: string;
}

export interface InterviewPrepQuestion {
  question: string;
  intent: string;
  tip: string;
}
