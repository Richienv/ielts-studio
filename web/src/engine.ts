import type { Bank, Group, Mode, Paper, Question, Session, Skill, SpeakingStep } from './types';
export const skillNames: Record<Skill,string>={listening:'Listening',reading:'Reading',writing:'Writing',speaking:'Speaking'};
export const SPEAKING: SpeakingStep[]=[
  {id:'intro',part:1,title:'Introduction',prompt:'Good morning. My name is Alex, and I will be your examiner today. This interview is being recorded. Can you tell me your full name, please? And what should I call you?',seconds:20,record:true},
  {id:'home',part:1,title:'Your hometown',prompt:'Where are you from, and what do you like most about your hometown?',seconds:40,record:true},
  {id:'work',part:1,title:'Work and studies',prompt:'Do you work, or are you a student? What do you particularly enjoy about your work or studies?',seconds:40,record:true},
  {id:'routine',part:1,title:'Daily routines',prompt:'Let us talk about daily routines. Which part of the day do you find most productive, and why?',seconds:40,record:true},
  {id:'change',part:1,title:'Changing routines',prompt:'Has your daily routine changed in the last few years?',seconds:40,record:true},
  {id:'learn',part:1,title:'Learning new things',prompt:'Now let us talk about learning. What is a skill you would like to learn in the future?',seconds:40,record:true},
  {id:'teacher',part:1,title:'Learning preferences',prompt:'Do you prefer to learn something by yourself or with a teacher? Why?',seconds:40,record:true},
  {id:'prepare',part:2,title:'Prepare your long turn',prompt:'Now I am going to give you a topic. I would like you to talk about it for one to two minutes. You have one minute to think about what you are going to say, and you can make some notes. Describe a useful skill you learned from another person.',seconds:60,record:false,cue:true},
  {id:'long-turn',part:2,title:'Your long turn',prompt:'All right. Remember, you have one to two minutes for this, so do not worry if I stop you. Please begin now.',seconds:120,record:true,cue:true},
  {id:'followup',part:2,title:'Follow-up',prompt:'Thank you. Do you still use that skill regularly?',seconds:20,record:true},
  {id:'education',part:3,title:'Education and skills',prompt:'We have been talking about a skill you learned. Now I would like to discuss some more general questions about learning. Which practical skills should schools teach young people?',seconds:55,record:true},
  {id:'technology',part:3,title:'Technology and learning',prompt:'How has technology changed the way people learn practical skills? Do you think all of these changes have been positive?',seconds:55,record:true},
  {id:'employers',part:3,title:'Responsibility for training',prompt:'Who should be responsible for developing the skills that people need at work: employers, governments, or individuals?',seconds:55,record:true},
  {id:'expertise',part:3,title:'The value of expertise',prompt:'Some people say that being able to find information is now more important than remembering it. To what extent do you agree?',seconds:55,record:true},
  {id:'future',part:3,title:'Learning in the future',prompt:'Do you think people will need to learn new skills more frequently in the future? What might be the consequences for society?',seconds:55,record:true},
];
export const SPEAKING_SECONDS=SPEAKING.reduce((s,p)=>s+p.seconds,0);
export function getPaper(bank: Bank,s: Session,skill?: Skill) { const key=skill??s.sequence[s.index];return key==='listening'||key==='reading'?bank[key].find(p=>p.id===s.paperIds[key]):undefined; }
export function questions(paper?: Paper) { return paper?.parts.flatMap(p=>p.groups.flatMap(g=>g.questions))??[]; }
export function wordCount(text: string) { return text.trim()?text.trim().split(/\s+/u).length:0; }
export function normalise(text: string) { return text.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/[‘’]/g,"'").replace(/[‐‑–—]/g,'-').replace(/\s+/g,' '); }
export function wordLimit(group: Group) { if(group.wordLimit) return group.wordLimit;const m=group.instructions.toUpperCase().match(/(?:NO MORE THAN )?(ONE|TWO|THREE|FOUR) WORD/);return m?({ONE:1,TWO:2,THREE:3,FOUR:4}[m[1]]??0):0; }
export function correct(q: Question,value: string,group?: Group) {
  if(!value.trim())return false;
  const limit=group?wordLimit(group):0;
  // Explicitly accepted numeric/postcode spellings may contain spaces.
  const accepted=[q.answer,...q.alternatives].some(a=>normalise(a)===normalise(value));
  if(!accepted)return false;
  if(limit && wordCount(value)>limit && !/\d/.test(value) && !/\d/.test(q.answer)) return false;
  return true;
}
export function score(paper: Paper,answers: Record<string,string>) { return paper.parts.reduce((a,p)=>a+p.groups.reduce((b,g)=>b+g.questions.filter(q=>correct(q,answers[q.id]??'',g)).length,0),0); }
export function band(raw: number,skill: 'listening'|'reading') {
  // Indicative practice conversion. Real IELTS cut scores vary between papers.
  const thresholds=skill==='listening'?[39,37,35,32,30,26,23,18,16,13,10,8,6,4,2,1]:[39,37,35,33,30,27,23,19,15,13,10,8,6,4,2,1];
  const bands=[9,8.5,8,7.5,7,6.5,6,5.5,5,4.5,4,3.5,3,2.5,2,1];
  const at=thresholds.findIndex(t=>raw>=t);return at<0?0:bands[at];
}
export function formatTime(seconds: number) { const s=Math.max(0,Math.ceil(seconds));return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }
export function listeningTimeline(paper: Paper) {
  let cursor=0;
  const parts=paper.parts.map((part,index)=>{const preview=index===0?45:30;const start=cursor;const audioStart=start+preview;const audioEnd=audioStart+(part.audioDuration??0);cursor=audioEnd+30;return {part:index,start,audioStart,audioEnd,end:cursor};});
  return {parts,reviewStart:cursor,duration:cursor+120};
}
export function sectionDuration(bank: Bank,skill: Skill,testId: string) { if(skill==='listening'){const p=bank.listening.find(p=>p.id===testId);return p?Math.ceil(listeningTimeline(p).duration):1800;}return skill==='speaking'?SPEAKING_SECONDS:3600; }
export function createSession(bank: Bank,skill: Skill|'full',set: number,mode: Mode,at=Date.now(),customId?: string): Session {
  const sequence: Skill[]=skill==='full'?['listening','reading','writing']:[skill];
  const readingIndices=[5,1,3];
  const paperIds: Record<Skill,string>={listening:bank.listening[set%bank.listening.length].id,reading:bank.reading[readingIndices[set%3]%bank.reading.length].id,writing:bank.writing[[3,5,0][set%3]%bank.writing.length].id,speaking:'skills-and-learning'};
  if(customId&&skill!=='full')paperIds[skill]=customId;
  const duration=sectionDuration(bank,sequence[0],paperIds[sequence[0]]);
  return {id:crypto.randomUUID(),title:skill==='full'?`Academic mock ${set+1}`:`${skillNames[skill]} practice`,mode,full:skill==='full',sequence,index:0,paperIds,startedAt:at,sectionStartedAt:at,deadline:at+duration*1000,duration,pausedAt:null,answers:{},flags:[],notes:'',highlights:{},part:0,results:[],status:'active',focusLosses:0,speakingStep:0,speakingStepStartedAt:at,interrupted:skill==='speaking'};
}
export function remaining(s: Session,now=Date.now()) { if(s.sequence[s.index]==='speaking'&&s.interrupted)return s.duration;return Math.min(s.duration,Math.max(0,(s.deadline-(s.pausedAt??now))/1000)); }
export function pause(s: Session,at=Date.now()): Session { return s.mode==='practice'&&!s.pausedAt?{...s,pausedAt:at}:s; }
export function resume(s: Session,at=Date.now()): Session { return s.pausedAt?{...s,pausedAt:null,deadline:s.deadline+at-s.pausedAt,sectionStartedAt:s.sectionStartedAt+at-s.pausedAt,speakingStepStartedAt:s.speakingStepStartedAt+at-s.pausedAt}:s; }
export function advance(bank: Bank,s: Session,at=Date.now(),expired=false): Session {
  if(s.status!=='active')return s;
  const finishAt=expired?s.deadline:at;
  const result={skill:s.sequence[s.index],testId:s.paperIds[s.sequence[s.index]],answers:{...s.answers},flags:[...s.flags],elapsed:Math.min(s.duration,Math.max(0,(finishAt-s.sectionStartedAt)/1000)),completedAt:finishAt,expired};
  const results=[...s.results,result];
  if(s.index===s.sequence.length-1)return {...s,status:'complete',results,pausedAt:null};
  const index=s.index+1;const duration=sectionDuration(bank,s.sequence[index],s.paperIds[s.sequence[index]]);
  return {...s,index,results,sectionStartedAt:finishAt,deadline:finishAt+duration*1000,duration,answers:{},flags:[],notes:'',part:0,pausedAt:null};
}
export function catchUp(bank: Bank,s: Session,at=Date.now()) { let next=s;if(s.sequence[s.index]==='speaking'&&s.interrupted)return s;for(let i=0;i<4&&next.status==='active'&&!next.pausedAt&&at>=next.deadline;i++)next=advance(bank,next,at,true);return next; }
export function exportSession(s: Session) { return JSON.stringify({format:'ielts-studio-v1',exportedAt:new Date().toISOString(),session:s},null,2); }
