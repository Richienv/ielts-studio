import { Flag, Check, X } from 'lucide-react';
import type { Group, Question } from './types';
import { correct, wordLimit } from './engine';
interface Props { groups:Group[];answers:Record<string,string>;flags:string[];onAnswer:(id:string,value:string)=>void;onFlag:(id:string)=>void;review?:boolean;activeId?:string }
export function QuestionGroups(props:Props) {
  return <div className="question-groups">{props.groups.map(group=>{
    const qs=group.questions;const first=qs[0];if(!first)return null;
    const template=qs.find(q=>/\{\{gap[^}]*\}\}/.test(q.text))?.text;
    const inline=template&&!props.review&&(template.match(/\{\{gap[^}]*\}\}/g)??[]).length===qs.length&&(/\{\{gap_[^}]*\}\}/.test(template)||((template.match(/\{\{gap\}\}/g)??[]).length>1));
    let gap=0;
    return <section className="question-group" key={group.id} aria-label={`Questions ${first.number} to ${qs.at(-1)?.number}`}>
      <h3>Questions {first.number}{qs.length>1?`–${qs.at(-1)?.number}`:''}</h3>
      <p className="instructions">{group.instructions}</p>
      {group.wordBank.length>0&&<div className="word-bank">{group.wordBank.map((w,i)=><span key={i}>{w}</span>)}</div>}
      {inline?<><p className="summary-text">{template.split(/(\{\{gap[^}]*\}\})/g).map((piece,i)=>{
        if(!/^\{\{/.test(piece))return <span key={i}>{piece}</span>;
        const q=qs[gap++];return q?<span key={q.id} id={`q-${q.id}`} className="inline-answer"><b>{q.number}</b><AnswerField q={q} group={group} {...props}/></span>:<span key={i}>[blank]</span>;
      })}</p>{qs.map(q=><QuestionMeta key={q.id} q={q} group={group} {...props}/>)}</>:group.type==='table-completion'&&qs.some(q=>q.cells)?<><div className="completion-table-wrap"><table className="completion-table"><thead><tr><th>Context</th><th>Complete each row</th></tr></thead><tbody>{qs.map(q=><tr key={q.id} id={`q-${q.id}`}><th scope="row"><span className="question-number">{q.number}</span><span>{q.cells?.[0]}</span><button className={`flag-button ${props.flags.includes(q.id)?'flagged':''}`} aria-label={`${props.flags.includes(q.id)?'Unflag':'Flag'} question ${q.number}`} onClick={()=>props.onFlag(q.id)}><Flag size={14}/></button></th><td>{q.cells?.slice(1).join(' ').split(/(\{\{gap[^}]*\}\}|_{3,})/g).map((piece,i)=>/^(\{\{|_{3,})/.test(piece)?<AnswerField key={i} q={q} group={group} {...props}/>:<span key={i}>{piece}</span>)}</td></tr>)}</tbody></table></div>{qs.map(q=><QuestionMeta key={q.id} q={q} group={group} {...props}/>)}</>:qs.map(q=><div key={q.id} id={`q-${q.id}`} className={`question ${props.activeId===q.id?'question-active':''} ${props.review?(correct(q,props.answers[q.id]??'',group)?'correct':'incorrect'):''}`}>
        <div className="question-heading"><span className="question-number">{q.number}</span><p>{q.text.replace(/\{\{gap[^}]*\}\}/g,'________')||`Complete answer ${q.number}`}</p><button className={`flag-button ${props.flags.includes(q.id)?'flagged':''}`} onClick={()=>props.onFlag(q.id)} aria-label={`${props.flags.includes(q.id)?'Unflag':'Flag'} question ${q.number}`} aria-pressed={props.flags.includes(q.id)}><Flag size={16}/></button></div>
        <AnswerField q={q} group={group} {...props}/><QuestionMeta q={q} group={group} {...props}/>
      </div>)}
    </section>;
  })}</div>;
}
function AnswerField({q,group,answers,onAnswer,review}:{q:Question;group:Group}&Props) {
  let options=q.options;
  if(group.type==='true-false-not-given')options=['TRUE','FALSE','NOT GIVEN'].map(v=>({value:v,label:v}));
  if(group.type==='yes-no-not-given')options=['YES','NO','NOT GIVEN'].map(v=>({value:v,label:v}));
  if(group.type==='matching-headings'&&group.wordBank.length)options=group.wordBank.map(w=>({value:w.split(/[.)]/)[0].trim(),label:w}));
  if(group.type==='multiple-choice')return <fieldset className="answer-options" disabled={review}><legend className="sr-only">Answer to question {q.number}</legend>{options.map(o=><label key={o.value}><input type="radio" name={q.id} value={o.value} checked={answers[q.id]===o.value} onChange={()=>onAnswer(q.id,o.value)}/><span>{o.label.match(/^[A-Z][.)]/)?o.label:`${o.value}. ${o.label}`}</span></label>)}</fieldset>;
  if(options.length)return <select aria-label={`Answer ${q.number}`} value={answers[q.id]??''} onChange={e=>onAnswer(q.id,e.target.value)} disabled={review}><option value="">Select an answer</option>{options.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select>;
  return <input className="answer-input" aria-label={`Answer ${q.number}`} value={answers[q.id]??''} onChange={e=>onAnswer(q.id,e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} readOnly={review} placeholder={wordLimit(group)?`${wordLimit(group)} word${wordLimit(group)>1?'s':''} maximum`:'Type your answer'}/>;
}
function QuestionMeta({q,group,answers,review,flags,onFlag}:{q:Question;group:Group}&Props) {
  if(!review)return null;
  const ok=correct(q,answers[q.id]??'',group);
  return <div className={`answer-feedback ${ok?'right':'wrong'}`}>{ok?<Check size={15}/>:<X size={15}/>}<span>Question {q.number}: {ok?'Correct':`Correct answer: ${q.answer}`}{!ok&&<small>Your answer: {answers[q.id]||'Unanswered'}</small>}</span>{flags.includes(q.id)&&<button className="text-button" onClick={()=>onFlag(q.id)}>Flagged</button>}</div>;
}
