export type Skill = 'listening' | 'reading' | 'writing' | 'speaking';
export type Mode = 'exam' | 'practice';
export interface Option { value: string; label: string }
export interface Question { id: string; number: number; text: string; answer: string; options: Option[]; alternatives: string[]; cells?: string[] }
export interface Group { id: string; type: string; instructions: string; wordLimit: number; wordBank: string[]; questions: Question[] }
export interface Part { id: string; number: number; title: string; content: string; transcript: string; groups: Group[]; audio?: string; audioDuration?: number }
export interface Paper { id: string; title: string; difficulty: string; parts: Part[] }
export interface Task { id: string; number: number; title: string; prompt: string; minWords: number; image: string | null; figureDescription: string }
export interface WritingPaper { id: string; title: string; tasks: Task[] }
export interface Bank { reading: Paper[]; listening: Paper[]; writing: WritingPaper[]; source: string; contentNotice: string }
export interface SectionResult { skill: Skill; testId: string; answers: Record<string,string>; flags: string[]; elapsed: number; completedAt: number; expired: boolean }
export interface Session {
  id: string; title: string; mode: Mode; full: boolean; sequence: Skill[]; index: number; paperIds: Record<Skill,string>;
  startedAt: number; sectionStartedAt: number; deadline: number; duration: number; pausedAt: number | null;
  answers: Record<string,string>; flags: string[]; notes: string; highlights: Record<string,string[]>;
  part: number; results: SectionResult[]; status: 'active' | 'complete'; focusLosses: number;
  speakingStep: number; speakingStepStartedAt: number; interrupted: boolean;
}
export interface Recording { id: string; sessionId: string; step: number; blob: Blob; createdAt: number }
export interface Settings { name: string; target: number; fontSize: 'normal' | 'large'; contrast: boolean }
export interface SpeakingStep { id: string; part: number; title: string; prompt: string; seconds: number; record: boolean; cue?: boolean }
