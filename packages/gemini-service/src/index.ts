import { GoogleGenAI, Type, type Schema, type Content } from '@google/genai';
import {
    type GeminiServiceConfig,
    type AnalysisRequest,
    type AnalysisResult,
    type Question,
    type ResumeData,
    type PersonaType,
    type InterviewQuestion,
    type TranscriptMessage,
    type InterviewFeedback,
} from './types';
import { logger } from '@/utils/logger';
import { QUESTION_TIMEOUT_MINUTES } from '@/config/interview';

/**
 * GeminiService class for interacting with Google's Gemini AI
 */
export class GeminiService {
    private client: GoogleGenAI;
    private model: string;

    constructor(config: GeminiServiceConfig) {
        this.client = new GoogleGenAI({ apiKey: config.apiKey });
        this.model = config.model || 'gemini-2.5-flash';
    }

    private readonly analysisSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            grade: {
                type: Type.NUMBER,
                description: "A score from 0 to 100 based on correctness, efficiency, and clean code.",
            },
            isCorrect: {
                type: Type.BOOLEAN,
                description: "Whether the code functionally solves the problem correctly.",
            },
            timeComplexityFeedback: {
                type: Type.STRING,
                description: "Feedback on the user's estimated time complexity vs actual.",
            },
            spaceComplexityFeedback: {
                type: Type.STRING,
                description: "Feedback on the user's estimated space complexity vs actual.",
            },
            codeQualityFeedback: {
                type: Type.STRING,
                description: "Comments on code style, variable naming, and best practices.",
            },
            suggestions: {
                type: Type.STRING,
                description: "Specific improvements or a more optimal approach if applicable.",
            }
        },
        required: ["grade", "isCorrect", "timeComplexityFeedback", "spaceComplexityFeedback", "codeQualityFeedback", "suggestions"],
    };

    /**
     * Analyze a coding solution
     */
    async analyzeSolution(request: AnalysisRequest): Promise<AnalysisResult> {
        const prompt = `
      You are a strict technical interviewer at a top tech company. 
      Analyze the following solution for the coding problem "${request.questionTitle}".
      
      Problem Description:
      ${request.questionDescription}
      
      User's Code:
      ${request.userCode}
      
      User's Proposed Time Complexity: ${request.userTimeComplexity}
      User's Proposed Space Complexity: ${request.userSpaceComplexity}
      
      Provide a structured analysis. Be constructive but identify all bugs and inefficiencies.
    `;

        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: this.analysisSchema,
                    systemInstruction: "You are an expert algorithm instructor. Grade fairly based on correctness and optimality.",
                },
            });

            const text = response.text;
            if (!text) throw new Error("No response from Gemini");

            return JSON.parse(text) as AnalysisResult;
        } catch (error) {
            logger.error("Error analyzing solution:", error);
            throw error;
        }
    }

    /**
     * Generate an official solution for a problem
     */
    async generateOfficialSolution(title: string, description: string): Promise<string> {
        const prompt = `
      You are an expert software engineer solving a coding interview problem.
      Problem Title: "${title}"
      Problem Description:
      ${description}

      Please provide the official solution in the following format:
      1. Approach: A concise explanation of the algorithm.
      2. Time Complexity: Big O notation.
      3. Space Complexity: Big O notation.
      4. Code: An optimized Python implementation inside a markdown code block.

      Format Example:
      Approach: Use a Hash Map to store visited elements...
      Time Complexity: O(n)
      Space Complexity: O(n)

      \`\`\`python
      def solve(nums):
          # implementation
      \`\`\`
    `;

        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: prompt,
            });
            return response.text || "Solution generation failed.";
        } catch (error) {
            logger.error("Error generating solution:", error);
            return "// Unable to generate solution due to an API error.\\n// Please rely on the analysis feature.";
        }
    }

    /**
     * Get a detailed explanation of a problem
     */
    async getProblemExplanation(question: Question): Promise<string> {
        const prompt = `
      Explain the coding problem "${question.title}" following these exact steps:
      
      Problem Description:
      ${question.description}
      
      Constraints:
      ${question.constraints?.join('\\n') || 'None'}
      
      1. Detailed Explanation: Explain the goal of the problem, inputs, outputs, and constraints clearly.
      2. Logic behind Official Solution: Break down the approach and key steps for the optimal solution.
      3. Algorithmic Hint: Provide a hint towards the algorithmic approach (e.g. "Use a Hash Map") without writing the full code.
    `;

        const response = await this.client.models.generateContent({
            model: this.model,
            contents: prompt,
        });

        return response.text || "Could not generate explanation.";
    }

    /**
     * Identify the coding pattern for a problem
     */
    async identifyCodingPattern(problemDescription: string): Promise<string> {
        const prompt = `
      Analyze the following coding problem description and identify the most likely algorithmic pattern (e.g., Sliding Window, Two Pointers, BFS, DFS, Dynamic Programming, Top K Elements, etc.).
      
      Problem: "${problemDescription}"
      
      Output format (Markdown):
      **Pattern:** [Name of Pattern]
      **Why:** [Brief explanation of the keywords or constraints that give it away]
      **How to Solve:** [1-2 sentences on the standard approach for this pattern]
    `;

        const response = await this.client.models.generateContent({
            model: this.model,
            contents: prompt,
        });

        return response.text || "Could not identify pattern.";
    }

    /**
     * Chat with the coding tutor
     */
    async chatWithTutor(
        history: { role: 'user' | 'model', text: string }[],
        newMessage: string,
        question: Question
    ): Promise<string> {
        const systemInstruction = `
      You are a helpful and encouraging Coding Tutor. 
      The user is working on the problem: "${question.title}".
      
      Problem Description: ${question.description}
      Official Solution Approach: ${question.officialSolution}
      
      Answer the user's questions. 
      - If they ask for a hint, give a small nudge.
      - If they ask about the solution, explain the logic clearly.
      - If they are stuck on specific syntax or logic, guide them.
      - Be concise and friendly.
    `;

        const contents: Content[] = history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        contents.push({
            role: 'user',
            parts: [{ text: newMessage }]
        });

        const response = await this.client.models.generateContent({
            model: this.model,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        return response.text || "I'm having trouble answering that right now.";
    }

    /**
     * Chat with system design tutor
     */
    async chatWithSystemDesignTutor(
        history: { role: 'user' | 'model', text: string }[],
        newMessage: string,
        question: Question
    ): Promise<string> {
        const systemInstruction = `
      You are a Senior Principal Software Architect acting as a System Design Mentor.
      The user is designing: "${question.title}".
      
      Problem Description: ${question.description}
      Official Architecture Summary: ${question.officialSolution}
      
      Your Goal:
      - Engage in a high-level discussion about scalability, availability, and reliability.
      - If the user asks "How do I start?", guide them to requirements gathering (functional vs non-functional).
      - If the user suggests a technology (e.g., "I'll use MySQL"), ask about trade-offs (e.g., "How does that scale for writes vs reads?").
      - Encourage back-of-the-envelope calculations for storage/bandwidth.
      - Be professional, insightful, and challenge the user's assumptions constructively.
      
      Keep responses concise (under 150 words) unless explaining a complex concept.
    `;

        const contents: Content[] = history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        contents.push({
            role: 'user',
            parts: [{ text: newMessage }]
        });

        const response = await this.client.models.generateContent({
            model: this.model,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        return response.text || "I cannot process that architectural query right now.";
    }

    /**
     * Generate a learning module for a topic
     */
    async generateLearningModule(topic: string): Promise<string> {
        const prompt = `
      The user wants to learn about the Computer Science concept: "${topic}".
      
      Create a comprehensive, structured learning module formatted in Markdown.
      Target audience: Software Engineers preparing for technical interviews.
      
      Structure the response exactly as follows:
      
      # ${topic}
      
      ## 1. Concept Overview
      (A clear, high-level definition of what it is and why it matters)
      
      ## 2. How It Works
      (A detailed explanation of the mechanics, logic, or data structure visualization)
      
      ## 3. Implementation / Pseudocode
      (Provide a code block, preferably in Python, demonstrating the concept)
      
      ## 4. Complexity Analysis
      (Time and Space complexity with explanation)
      
      ## 5. Example Problem
      (A LeetCode-style problem statement that requires this concept)
      
      ### Problem Description
      ...
      
      ### Walkthrough
      (Step-by-step application of the concept to solve this problem)
    `;

        const response = await this.client.models.generateContent({
            model: this.model,
            contents: prompt,
        });

        return response.text || "Unable to generate learning module.";
    }

    /**
     * Chat with learning tutor
     */
    async chatWithLearningTutor(
        history: { role: 'user' | 'model', text: string }[],
        newMessage: string,
        topic: string
    ): Promise<string> {
        const systemInstruction = `
      You are an expert Computer Science Professor.
      The user is currently studying the topic: "${topic}".
      
      Your goal is to answer their follow-up questions, clarify doubts, or provide more examples related to ${topic}.
      Be educational, rigorous, yet encouraging.
      If they ask for code, provide it in Python.
    `;

        const contents: Content[] = history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        contents.push({
            role: 'user',
            parts: [{ text: newMessage }]
        });

        const response = await this.client.models.generateContent({
            model: this.model,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        return response.text || "I cannot answer that right now.";
    }

    // ═══════════════════════════════════════════════════════════════════
    // Resume Mock Interview Methods
    // ═══════════════════════════════════════════════════════════════════

    private readonly resumeSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            name: {
                type: Type.STRING,
                description: "The candidate's full name",
            },
            email: {
                type: Type.STRING,
                description: "Email address if present",
            },
            phone: {
                type: Type.STRING,
                description: "Phone number if present",
            },
            summary: {
                type: Type.STRING,
                description: "Professional summary or objective statement",
            },
            skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of technical and soft skills",
            },
            experience: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        company: { type: Type.STRING },
                        startDate: { type: Type.STRING },
                        endDate: { type: Type.STRING },
                        highlights: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                    },
                    required: ["title", "company"],
                },
                description: "Work experience entries",
            },
            education: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        degree: { type: Type.STRING },
                        school: { type: Type.STRING },
                        year: { type: Type.STRING },
                        gpa: { type: Type.STRING },
                    },
                    required: ["degree", "school"],
                },
                description: "Education entries",
            },
            projects: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                        technologies: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                        highlights: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                    },
                    required: ["name", "technologies"],
                },
                description: "Project entries",
            },
        },
        required: ["name", "skills", "experience", "education", "projects"],
    };

    private readonly interviewQuestionsSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        content: { type: Type.STRING },
                        type: { type: Type.STRING },
                    },
                    required: ["id", "content", "type"],
                },
            },
        },
        required: ["questions"],
    };

    private readonly interviewFeedbackSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            overallAssessment: {
                type: Type.STRING,
                description: "Overall assessment of the candidate's interview performance",
            },
            strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of strengths demonstrated in the interview",
            },
            areasForImprovement: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Areas where the candidate could improve",
            },
            suggestedTopics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Topics the candidate should study or practice",
            },
            briefAnswerWarning: {
                type: Type.STRING,
                description: "Warning about consistently brief or shallow answers, if applicable",
            },
            questionFeedback: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        assessment: { type: Type.STRING },
                        suggestion: { type: Type.STRING },
                    },
                    required: ["question", "assessment", "suggestion"],
                },
                description: "Feedback for each question asked",
            },
        },
        required: ["overallAssessment", "strengths", "areasForImprovement", "suggestedTopics", "questionFeedback"],
    };

    /**
     * Parse resume text and extract structured data
     */
    async parseResume(resumeText: string): Promise<ResumeData> {
        const prompt = `
            Parse the following resume text and extract structured information.
            If a field is not present, use empty string or empty array as appropriate.
            Be thorough in extracting all skills, experiences, education, and projects.

            Resume Text:
            ${resumeText}
        `;

        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: this.resumeSchema,
                    systemInstruction: "You are an expert resume parser. Extract all relevant information accurately. If information is ambiguous, make reasonable inferences. Never hallucinate information that isn't present.",
                },
            });

            const text = response.text;
            if (!text) throw new Error("No response from Gemini");

            const parsed = JSON.parse(text) as ResumeData;

            // Ensure arrays are initialized
            return {
                name: parsed.name || 'Unknown',
                email: parsed.email,
                phone: parsed.phone,
                summary: parsed.summary,
                skills: parsed.skills || [],
                experience: parsed.experience || [],
                education: parsed.education || [],
                projects: parsed.projects || [],
            };
        } catch (error) {
            logger.error("Error parsing resume:", error);
            throw error;
        }
    }

    /**
     * Prepare resume context for prompts
     */
    private prepareResumeContext(resumeData: ResumeData): string {
        const sections: string[] = [];

        sections.push(`Name: ${resumeData.name}`);

        if (resumeData.summary) {
            sections.push(`Summary: ${resumeData.summary}`);
        }

        if (resumeData.skills.length > 0) {
            sections.push(`Skills: ${resumeData.skills.join(', ')}`);
        }

        if (resumeData.experience.length > 0) {
            const expStr = resumeData.experience.map(exp => {
                let entry = `${exp.title} at ${exp.company}`;
                if (exp.startDate) entry += ` (${exp.startDate} - ${exp.endDate || 'Present'})`;
                if (exp.highlights?.length) entry += `\n  - ${exp.highlights.join('\n  - ')}`;
                return entry;
            }).join('\n');
            sections.push(`Experience:\n${expStr}`);
        }

        if (resumeData.education.length > 0) {
            const eduStr = resumeData.education.map(edu => {
                let entry = `${edu.degree} from ${edu.school}`;
                if (edu.year) entry += ` (${edu.year})`;
                if (edu.gpa) entry += ` - GPA: ${edu.gpa}`;
                return entry;
            }).join('\n');
            sections.push(`Education:\n${eduStr}`);
        }

        if (resumeData.projects.length > 0) {
            const projStr = resumeData.projects.map(proj => {
                let entry = proj.name;
                if (proj.description) entry += `: ${proj.description}`;
                if (proj.technologies.length) entry += `\n  Technologies: ${proj.technologies.join(', ')}`;
                if (proj.highlights?.length) entry += `\n  - ${proj.highlights.join('\n  - ')}`;
                return entry;
            }).join('\n');
            sections.push(`Projects:\n${projStr}`);
        }

        return sections.join('\n\n');
    }

    /**
     * Get persona configuration
     */
    private getPersonaConfig(persona: PersonaType): { systemModifier: string; questionStyle: string; followUpDepth: string } {
        const configs = {
            friendly: {
                systemModifier: `
                    Be supportive and encouraging. Acknowledge good points before asking follow-ups.
                    Use phrases like "Great point!" and "I like how you explained that."
                    When answers are brief, gently ask for more detail with curiosity, not pressure.
                `,
                questionStyle: 'broader behavioral questions, focus on storytelling and experiences',
                followUpDepth: 'light (1-2 follow-ups max)',
            },
            professional: {
                systemModifier: `
                    Maintain a professional, neutral tone. Be direct and efficient.
                    Acknowledge answers briefly before moving on.
                    When answers are brief, ask for specifics matter-of-factly.
                `,
                questionStyle: 'balanced mix of technical and behavioral questions',
                followUpDepth: 'moderate (2-3 follow-ups)',
            },
            challenging: {
                systemModifier: `
                    Be a rigorous interviewer. Push back on vague answers.
                    Ask "Can you be more specific?" and "What about edge cases?"
                    Test depth of knowledge. Challenge assumptions respectfully.
                `,
                questionStyle: 'deeper technical questions, complex scenarios, edge cases',
                followUpDepth: 'deep (3-4 follow-ups, probe until satisfied)',
            },
        };
        return configs[persona];
    }

    /**
     * Generate interview questions based on resume and persona
     */
    async generateInterviewQuestions(
        resumeData: ResumeData,
        persona: PersonaType,
        durationMinutes: number
    ): Promise<InterviewQuestion[]> {
        // Calculate question count based on duration and per-question timeout
        const targetQuestions = Math.max(3, Math.floor(durationMinutes / QUESTION_TIMEOUT_MINUTES));
        const personaConfig = this.getPersonaConfig(persona);

        const prompt = `
            Generate ${targetQuestions} interview questions for this candidate.

            Resume Context:
            ${this.prepareResumeContext(resumeData)}

            Persona Style: ${personaConfig.questionStyle}
            Follow-up Depth: ${personaConfig.followUpDepth}

            Requirements:
            - Questions should cover: technical skills, past experience, projects, behavioral scenarios
            - Vary difficulty based on the persona style
            - Each question should be open-ended and allow for detailed responses
            - Generate unique IDs for each question (use format "q1", "q2", etc.)
            - All questions should be type "initial"
            - Questions should be specific to the candidate's background when possible
        `;

        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: this.interviewQuestionsSchema,
                    systemInstruction: "You are an expert technical interviewer. Generate thoughtful, relevant questions that explore the candidate's experience and skills.",
                },
            });

            const text = response.text;
            if (!text) throw new Error("No response from Gemini");

            const parsed = JSON.parse(text) as { questions: InterviewQuestion[] };
            return parsed.questions;
        } catch (error) {
            logger.error("Error generating questions:", error);
            throw error;
        }
    }

    /**
     * Analyze an interview session and generate feedback
     */
    async analyzeInterviewSession(
        resumeData: ResumeData,
        transcript: TranscriptMessage[],
        questionsAsked: InterviewQuestion[],
        persona: PersonaType,
        wasEarlyEnd: boolean
    ): Promise<InterviewFeedback> {
        const personaConfig = this.getPersonaConfig(persona);

        // Format transcript for analysis
        const transcriptStr = transcript.map(msg =>
            `${msg.role === 'model' ? 'Interviewer' : 'Candidate'}: ${msg.content}`
        ).join('\n\n');

        const questionsStr = questionsAsked
            .filter(q => q.type === 'initial')
            .map(q => q.content)
            .join('\n');

        const prompt = `
            Analyze this mock interview session and provide comprehensive feedback.

            Candidate Background:
            ${this.prepareResumeContext(resumeData)}

            Interview Persona: ${persona} (${personaConfig.questionStyle})

            Questions Asked:
            ${questionsStr}

            Interview Transcript:
            ${transcriptStr}

            ${wasEarlyEnd ? 'Note: The candidate ended the interview early.' : ''}

            Provide detailed, constructive feedback. Be specific about what was done well and what could be improved.
            If answers were consistently brief or shallow, include a briefAnswerWarning.
            For each question asked, provide specific feedback on the answer given.
        `;

        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: this.interviewFeedbackSchema,
                    systemInstruction: "You are a senior hiring manager providing interview feedback. Be constructive, specific, and actionable. Focus on helping the candidate improve.",
                },
            });

            const text = response.text;
            if (!text) throw new Error("No response from Gemini");

            return JSON.parse(text) as InterviewFeedback;
        } catch (error) {
            logger.error("Error analyzing session:", error);
            throw error;
        }
    }

    /**
     * Get the system instruction for a mock interview session
     */
    getMockInterviewSystemInstruction(
        resumeData: ResumeData,
        persona: PersonaType,
        currentQuestion: string
    ): string {
        const personaConfig = this.getPersonaConfig(persona);

        return `
            You are conducting a mock interview with a candidate.

            Candidate Background:
            ${this.prepareResumeContext(resumeData)}

            Your Persona: ${persona}
            ${personaConfig.systemModifier}

            Current Question Being Discussed:
            "${currentQuestion}"

            Instructions:
            - Listen carefully to the candidate's response
            - Ask follow-up questions to probe deeper based on the ${personaConfig.followUpDepth} depth
            - If the answer is too brief, encourage elaboration according to your persona style
            - Stay focused on the current topic before moving to the next question
            - Be natural and conversational while maintaining your persona
            - When you're satisfied with the answer, acknowledge it and indicate you'll move to the next question
        `;
    }
}

export type {
    Content,
    AnalysisRequest,
    AnalysisResult,
    Question,
    GeminiServiceConfig,
    ResumeData,
    PersonaType,
    InterviewQuestion,
    TranscriptMessage,
    InterviewFeedback,
};
