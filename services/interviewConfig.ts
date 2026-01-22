import { type ResumeData, type PersonaType, type InterviewQuestion, type TranscriptMessage } from '@/types/resume';
import { getPersonaConfig } from '@/config/personas';

/**
 * Regex pattern for detecting sentence boundaries in streaming transcription.
 * Matches text ending with sentence-ending punctuation (. ! ?) optionally followed by whitespace.
 */
export const SENTENCE_BOUNDARY_REGEX = /[.!?]\s*$/;

/**
 * Common filler words and sounds that shouldn't be sent as standalone prompts.
 */
const FILLER_PATTERNS = /^(um+|uh+|hmm+|ah+|er+|oh+|huh|mhm+|mm+)\.?$/i;

/**
 * Patterns indicating noise or non-speech artifacts.
 * Matches: strings with no letters, or 4+ repeated characters (e.g., "sssss").
 */
const NOISE_PATTERNS = /^[^a-zA-Z]*$|^(.)\1{3,}$/;

/**
 * Minimum character length for meaningful transcription.
 */
const MIN_MEANINGFUL_LENGTH = 2;

/**
 * Filters transcribed text to remove noise and filler-only content.
 * Returns the cleaned text, or null if it should be discarded.
 */
export function filterTranscriptionNoise(text: string): string | null {
  const trimmed = text.trim();

  // Too short to be meaningful
  if (trimmed.length < MIN_MEANINGFUL_LENGTH) {
    return null;
  }

  // Pure filler word (only discard if it's the ENTIRE content)
  if (FILLER_PATTERNS.test(trimmed)) {
    return null;
  }

  // Noise pattern (no letters, or repeated characters)
  if (NOISE_PATTERNS.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Builds a context string from resume data for the AI system instruction.
 */
export function buildResumeContext(resumeData: ResumeData): string {
  return [
    `Name: ${resumeData.name}`,
    resumeData.summary ? `Summary: ${resumeData.summary}` : '',
    resumeData.skills.length > 0 ? `Skills: ${resumeData.skills.join(', ')}` : '',
    resumeData.experience.length > 0
      ? `Experience: ${resumeData.experience.map(e => `${e.title} at ${e.company}`).join('; ')}`
      : '',
    resumeData.projects.length > 0
      ? `Projects: ${resumeData.projects.map(p => p.name).join(', ')}`
      : '',
  ].filter(Boolean).join('\n');
}

/**
 * Gets the voice name for Gemini Live API based on persona type.
 */
export function getVoiceForPersona(persona: PersonaType): string {
  return getPersonaConfig(persona).voice;
}

/**
 * Gets the display title for a persona.
 */
export function getPersonaTitle(persona: PersonaType): string {
  return getPersonaConfig(persona).title;
}

interface SystemInstructionParams {
  resumeData: ResumeData;
  persona: PersonaType;
  totalQuestions: number;
}

/**
 * Builds the system instruction for the AI interviewer.
 * Note: Question-specific content is sent via sendQuestionContext() to avoid session reconnection.
 */
export function buildSystemInstruction({
  resumeData,
  persona,
  totalQuestions,
}: SystemInstructionParams): string {
  const resumeContext = buildResumeContext(resumeData);
  const personaConfig = getPersonaConfig(persona);

  return `
    You are conducting a mock interview with a candidate.

    Candidate Background:
    ${resumeContext}

    Your Persona: ${persona} - ${personaConfig.title}
    ${personaConfig.systemModifier}

    Interview Structure:
    - This interview has ${totalQuestions} questions total
    - You will receive [QUESTION] messages indicating the current question to ask
    - You will receive [TIME_UP] messages when it's time to move on to the next question
    - You will receive [WRAP_UP_WARNING] on the final question with 30 seconds remaining
    - You will receive [INTERVIEW_COMPLETE] when the final question's time is up

    Instructions:
    - When you receive a [QUESTION] message, ask that question clearly
    - Listen to the candidate's response
    - Ask follow-up questions based on your persona's follow-up depth (${personaConfig.followUpDepth})
    - If the answer is too brief, encourage elaboration according to your persona style
    - When you receive [TIME_UP], gracefully wrap up and wait for the next question
    - When you receive [WRAP_UP_WARNING], note that the interview is ending soon. After the candidate
      finishes their current response, begin transitioning toward closing the interview naturally.
    - When you receive [INTERVIEW_COMPLETE], let the candidate finish speaking if they are mid-thought,
      acknowledge their response naturally, then thank them warmly and clearly state that the interview
      has concluded. Do not interrupt them mid-sentence.
    - Be natural and conversational while maintaining your persona
    - Keep responses concise for a flowing conversation

    IMPORTANT - Question Style:
    - Ask ONE focused question at a time. Never combine multiple questions.
    - Avoid compound questions like "Tell me about X and also how did you handle Y?"
    - If you need multiple pieces of information, ask them in separate turns.
  `;
}

interface QuestionContextParams {
  question: InterviewQuestion;
  questionIndex: number;
  totalQuestions: number;
  /** True only for the very first connection of the interview session */
  isFirst: boolean;
  /** True when reconnecting after a connection drop mid-interview */
  isRecovery?: boolean;
}

/**
 * Builds the question context message to send to an active session.
 * Handles three scenarios: first question, next question, and recovery after disconnect.
 */
export function buildQuestionContext({
  question,
  questionIndex,
  totalQuestions,
  isFirst,
  isRecovery = false,
}: QuestionContextParams): string {
  let prefix: string;
  if (isRecovery) {
    prefix = '[QUESTION] We reconnected after a brief interruption. Please continue with the current question';
  } else if (isFirst) {
    prefix = '[QUESTION] Please begin the interview with this first question';
  } else {
    prefix = '[QUESTION] The candidate is ready. Please move on to the next question';
  }

  return `${prefix} (${questionIndex + 1} of ${totalQuestions}): "${question.content}"`;
}

const MAX_RECOVERY_MESSAGES = 20; // ~10 back-and-forth exchanges

/**
 * Builds a transcript summary for session recovery.
 * Limits to recent messages to avoid token limits and latency.
 * Returns null if transcript is empty.
 */
export function buildTranscriptSummary(transcript: TranscriptMessage[]): string | null {
  if (transcript.length === 0) return null;

  const recentMessages = transcript.slice(-MAX_RECOVERY_MESSAGES);
  const wasTruncated = transcript.length > MAX_RECOVERY_MESSAGES;

  const summary = recentMessages.map(msg => {
    const speaker = msg.role === 'user' ? 'Candidate' : 'Interviewer';
    return `${speaker}: ${msg.content}`;
  }).join('\n');

  const truncationNote = wasTruncated
    ? `[Note: Showing last ${MAX_RECOVERY_MESSAGES} messages of ${transcript.length} total]\n\n`
    : '';

  return `[SESSION_RECOVERED] The connection was briefly interrupted. Here's what was discussed:\n\n${truncationNote}${summary}\n\n[END_RECOVERY_CONTEXT]`;
}
