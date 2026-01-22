export interface AnalysisRequest {
    questionTitle: string;
    questionDescription: string;
    userCode: string;
    userTimeComplexity: string;
    userSpaceComplexity: string;
}

export interface AnalysisResult {
    grade: number;
    isCorrect: boolean;
    timeComplexityFeedback: string;
    spaceComplexityFeedback: string;
    codeQualityFeedback: string;
    suggestions: string;
}

export interface Question {
    title: string;
    description: string;
    constraints?: string[];
    officialSolution?: string;
}

export interface GeminiServiceConfig {
    apiKey: string;
    model?: string;
}

// Resume Mock Interview Types
export interface ResumeData {
    name: string;
    email?: string;
    phone?: string;
    summary?: string;
    skills: string[];
    experience: WorkExperience[];
    education: Education[];
    projects: Project[];
}

export interface WorkExperience {
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
    highlights?: string[];
}

export interface Education {
    degree: string;
    school: string;
    year?: string;
    gpa?: string;
}

export interface Project {
    name: string;
    description?: string;
    technologies: string[];
    highlights?: string[];
}

export type PersonaType = 'friendly' | 'professional' | 'challenging';

export interface InterviewQuestion {
    id: string;
    content: string;
    type: 'initial' | 'follow-up';
}

export interface TranscriptMessage {
    role: 'user' | 'model';
    content: string;
    timestamp: number;
}

export interface InterviewFeedback {
    overallAssessment: string;
    strengths: string[];
    areasForImprovement: string[];
    suggestedTopics: string[];
    briefAnswerWarning?: string;
    questionFeedback: {
        question: string;
        assessment: string;
        suggestion: string;
    }[];
}
