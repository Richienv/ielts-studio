import { describe,it,expect } from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {advance,band,catchUp,correct,createSession,listeningTimeline,pause,questions,remaining,resume,score,SPEAKING,SPEAKING_SECONDS,wordCount,wordLimit} from './engine';
import type {Bank} from './types';
const bank=JSON.parse(readFileSync(resolve('public/content/bank.json'),'utf8')) as Bank;
describe('content integrity',()=>{
 it('contains full Academic papers with 40 answerable questions and valid keys',()=>{
  expect(bank.reading.length).toBeGreaterThanOrEqual(10);expect(bank.listening.length).toBe(3);expect(bank.writing.length).toBe(6);
  for(const paper of [...bank.reading,...bank.listening]){
   const qs=questions(paper);expect(qs.map(q=>q.number).sort((a,b)=>a-b),paper.title).toEqual(Array.from({length:40},(_,i)=>i+1));
   const perfect=Object.fromEntries(qs.map(q=>[q.id,q.answer]));expect(score(paper,perfect),paper.title).toBe(40);expect(score(paper,{})).toBe(0);
   for(const p of paper.parts)for(const g of p.groups)for(const q of g.questions){expect(q.answer.trim(),`${paper.title} Q${q.number}`).not.toBe('');expect(correct(q,q.answer,g),`${paper.title} Q${q.number}`).toBe(true);if(q.options.length)expect(q.options.map(o=>o.value)).toContain(q.answer);}
  }
 });
 it('has playable local recording and figure assets',()=>{for(const p of bank.listening.flatMap(t=>t.parts)){expect(existsSync(resolve('public',p.audio!.slice(1)))).toBe(true);expect(p.audioDuration).toBeGreaterThan(200);}for(const t of bank.writing){expect(t.tasks.map(q=>q.minWords)).toEqual([150,250]);expect(existsSync(resolve('public',t.tasks[0].image!.slice(1)))).toBe(true);}});
 it('maps summary templates to exactly one input per question',()=>{for(const t of bank.reading)for(const p of t.parts)for(const g of p.groups){const text=g.questions.find(q=>/\{\{gap_/.test(q.text))?.text;if(text)expect((text.match(/\{\{gap[^}]*\}\}/g)??[]).length,`${t.title} ${g.id}`).toBe(g.questions.length);}});
 it('includes the full spoken interview and authentic long-turn intervals',()=>{expect(SPEAKING_SECONDS).toBeGreaterThanOrEqual(11*60);expect(SPEAKING_SECONDS).toBeLessThanOrEqual(14*60);expect(SPEAKING.find(s=>s.id==='prepare')?.seconds).toBe(60);expect(SPEAKING.find(s=>s.id==='long-turn')?.seconds).toBe(120);for(const s of SPEAKING)expect(existsSync(resolve(`public/content/examiner/${s.id}.mp3`))).toBe(true);});
});
describe('scoring',()=>{
 it('normalises case/spacing but preserves important answer distinctions',()=>{const q=questions(bank.listening[0])[0];expect(correct(q,`  ${q.answer.toUpperCase()}  `)).toBe(true);expect(correct(q,'')).toBe(false);expect(correct(q,q.answer+' extra')).toBe(false);});
 it('respects word limits and half-band thresholds',()=>{expect(wordCount(' alpha   beta\n gamma ')).toBe(3);expect(wordCount('')).toBe(0);expect(band(39,'reading')).toBe(9);expect(band(30,'reading')).toBe(7);expect(band(32,'listening')).toBe(7.5);expect(band(0,'reading')).toBe(0);expect(wordLimit({id:'1',type:'note',instructions:'Write ONE WORD ONLY.',wordLimit:0,wordBank:[],questions:[]})).toBe(1);});
});
describe('exam clock and sequencing',()=>{
 it('uses wall-clock time, persists deadlines across reload and cannot pause an exam',()=>{const s=createSession(bank,'reading',0,'exam',100000);expect(remaining(s,100000+120000)).toBe(3480);expect(pause(s,110000)).toBe(s);const restored=JSON.parse(JSON.stringify(s));expect(remaining(restored,100000+180000)).toBe(3420);});
 it('freezes practice and shifts its deadline once on resume',()=>{const s=createSession(bank,'reading',0,'practice',100000);const stopped=pause(s,160000);expect(remaining(stopped,900000)).toBe(3540);const continued=resume(stopped,500000);expect(continued.deadline).toBe(s.deadline+340000);expect(remaining(continued,500000)).toBe(3540);});
 it('automatically submits and starts the next section at the original deadline',()=>{const s=createSession(bank,'full',0,'exam',100000);s.answers={example:'saved'};const next=catchUp(bank,s,s.deadline+20000);expect(next.index).toBe(1);expect(next.results[0].answers).toEqual({example:'saved'});expect(next.results[0].expired).toBe(true);expect(next.sectionStartedAt).toBe(s.deadline);expect(remaining(next,s.deadline+20000)).toBe(3580);expect(next.answers).toEqual({});});
 it('catches up across all missed sections without granting new time',()=>{const s=createSession(bank,'full',0,'exam',100000);const next=catchUp(bank,s,s.deadline+7200001);expect(next.status).toBe('complete');expect(next.results.map(r=>r.skill)).toEqual(['listening','reading','writing']);expect(next.results.every(r=>r.expired)).toBe(true);});
 it('manual submission starts the next section immediately',()=>{const s=createSession(bank,'full',0,'exam',100000);const next=advance(bank,s,200000);expect(next.sectionStartedAt).toBe(200000);expect(next.deadline).toBe(3800000);});
 it('provides one pass of each listening clip and exactly two minutes final check',()=>{const timeline=listeningTimeline(bank.listening[0]);expect(timeline.duration-timeline.reviewStart).toBe(120);expect(timeline.parts[0].audioStart).toBe(45);for(let i=1;i<4;i++)expect(timeline.parts[i].start).toBe(timeline.parts[i-1].end);});
 it('does not start speaking until the first microphone connection',()=>{const s=createSession(bank,'speaking',0,'exam',100000);expect(catchUp(bank,s,s.deadline+50000)).toBe(s);});
});
