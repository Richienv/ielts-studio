import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Play, Download, CheckCircle2 } from 'lucide-react';
import { SPEAKING, formatTime } from './engine';
import { download, recordings, saveRecording } from './storage';
import type { Recording, Session } from './types';
export function Speaking({session,now,onUpdate,onFinish}:{session:Session;now:number;onUpdate:(fn:(s:Session)=>Session)=>void;onFinish:()=>void}) {
  const [ready,setReady]=useState(false);const [error,setError]=useState('');const [level,setLevel]=useState(0);const stream=useRef<MediaStream|null>(null);const recorder=useRef<MediaRecorder|null>(null);const audio=useRef<HTMLAudioElement|null>(null);const context=useRef<AudioContext|null>(null);
  const step=SPEAKING[session.speakingStep];const left=step?Math.max(0,step.seconds-((session.pausedAt??now)-session.speakingStepStartedAt)/1000):0;
  const paused=!!session.pausedAt;
  useEffect(()=>()=>{recorder.current?.state!=='inactive'&&recorder.current?.stop();stream.current?.getTracks().forEach(t=>t.stop());audio.current?.pause();void context.current?.close();},[]);
  async function connect(){try{const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});stream.current=media;setReady(true);setError('');
    const ctx=new AudioContext();context.current=ctx;const analyser=ctx.createAnalyser();analyser.fftSize=256;ctx.createMediaStreamSource(media).connect(analyser);const arr=new Uint8Array(analyser.frequencyBinCount);const sample=()=>{if(!stream.current?.active)return;analyser.getByteFrequencyData(arr);setLevel(arr.reduce((a,b)=>a+b,0)/arr.length/128);requestAnimationFrame(sample);};sample();
    const at=Date.now();onUpdate(s=>s.interrupted?{...s,sectionStartedAt:at,deadline:at+s.duration*1000,speakingStepStartedAt:at,interrupted:false}:s);
  }catch(e){setError(e instanceof Error?e.message:'Microphone access failed. Allow microphone access in your browser and try again.');}}
  useEffect(()=>{
    if(!ready||!step||!stream.current)return;
    let active=true;
    const chunks:BlobPart[]=[];let rec:MediaRecorder|null=null;
    const start=()=>{if(!active||!stream.current||!step.record)return;try{const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));rec=new MediaRecorder(stream.current,mime?{mimeType:mime}:undefined);recorder.current=rec;rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);void saveRecording({id:`${session.id}-${session.speakingStep}`,sessionId:session.id,step:session.speakingStep,blob:new Blob(chunks,{type:rec?.mimeType??e.data.type}),createdAt:Date.now()}).catch(()=>setError('Recording storage is full or unavailable. Download your recordings before continuing.'));}};rec.start(1000);}catch{setError('This browser cannot record audio. Open the simulator in Chrome or Safari.');}};
    const prompt=new Audio(`/content/examiner/${step.id}.mp3`);audio.current=prompt;
    prompt.onended=start;prompt.onerror=()=>{setError('Examiner audio unavailable. Read the prompt on screen.');start();};
    void prompt.play().catch(()=>{setError('Tap Play examiner to hear the prompt. Your microphone is recording.');start();});
    return ()=>{active=false;prompt.pause();if(rec&&rec.state!=='inactive')rec.stop();};
  },[ready,session.speakingStep,session.id]);
  useEffect(()=>{const r=recorder.current;if(paused){audio.current?.pause();if(r?.state==='recording')r.pause();}else if(r?.state==='paused')r.resume();},[paused]);
  useEffect(()=>{
    if(!ready||paused||!step||left>0)return;
    if(session.speakingStep===SPEAKING.length-1){onFinish();return;}
    onUpdate(s=>({...s,speakingStep:s.speakingStep+1,speakingStepStartedAt:s.speakingStepStartedAt+step.seconds*1000}));
  },[ready,paused,left,step,session.speakingStep,onFinish,onUpdate]);
  if(!step)return null;
  return <div className="speaking-layout"><div className="examiner-panel"><div className={`examiner-avatar ${ready&&step.record?'is-recording':''}`}><Mic size={40}/></div><span className="status-pill">{ready?(step.record?'Recording your response':'Preparation time'):'Microphone not connected'}</span><h2>Your speaking room</h2><p>A scripted examiner guides this 12-minute interview. Prompts are recorded; follow-up questions do not adapt to your answers.</p>{!ready?<button className="primary" onClick={()=>void connect()}><Mic size={17}/>Connect microphone & begin</button>:<><div className="mic-meter" aria-label={`Microphone level ${Math.round(level*100)} percent`}>{Array.from({length:24},(_,i)=><i className={i<level*24?'lit':''} key={i}/>)}</div><span className="muted">Microphone connected</span></>}
    {error&&<p role="alert" className="error-text">{error}</p>}<div className="speaking-part-list">{[1,2,3].map(p=><div className={p===step.part?'current':''} key={p}><span>{p<step.part?<CheckCircle2 size={16}/>:p}</span>{p===1?'Introduction & interview':p===2?'Individual long turn':'Two-way discussion'}</div>)}</div></div>
    <div className="speaking-prompt"><div className="section-meta">Part {step.part} of 3 <span>{formatTime(left)}</span></div><h1>{step.title}</h1><p className="examiner-question">{step.prompt}</p>{step.cue&&<div className="cue-card"><h3>Describe a useful skill you learned from another person.</h3><p>You should say:</p><ul><li>what the skill was</li><li>who you learned it from</li><li>how you learned it</li></ul><p>and explain why this skill has been useful to you.</p></div>}
    {ready&&<button className="text-button" onClick={()=>{if(audio.current){audio.current.currentTime=0;void audio.current.play().catch(()=>setError('Audio is blocked by your browser.'));}}}><Play size={16}/>Play examiner prompt</button>}
    {step.cue&&<label className="speaking-notes">Preparation notes<textarea placeholder="Make brief notes here…" value={session.notes} onChange={e=>onUpdate(s=>({...s,notes:e.target.value}))}/></label>}
    {ready&&session.mode==='practice'&&<button className="secondary" onClick={()=>session.speakingStep===SPEAKING.length-1?onFinish():onUpdate(s=>({...s,speakingStep:s.speakingStep+1,speakingStepStartedAt:Date.now()}))}>Next question</button>}
    {!ready&&<p className="mic-note"><MicOff size={16}/>The interview clock begins when your microphone connects.</p>}</div></div>;
}
export function RecordingReview({sessionId}:{sessionId:string}){
  const [clips,setClips]=useState<Recording[]>([]);const [urls,setUrls]=useState<Record<string,string>>({});const [error,setError]=useState('');
  useEffect(()=>{let alive=true;let allocated:string[]=[];
    const refresh=()=>{void recordings(sessionId).then(list=>{if(!alive)return;const previous=allocated;allocated=[];const map:Record<string,string>={};for(const c of list){map[c.id]=URL.createObjectURL(c.blob);allocated.push(map[c.id]);}setClips(list);setUrls(map);previous.forEach(u=>URL.revokeObjectURL(u));}).catch(()=>setError('Could not read saved recordings. Keep this browser profile to preserve your data.'));};
    const saved=(event:Event)=>{if((event as CustomEvent<string>).detail===sessionId)refresh();};
    window.addEventListener('ielts-recording-saved',saved);refresh();
    return()=>{alive=false;window.removeEventListener('ielts-recording-saved',saved);allocated.forEach(u=>URL.revokeObjectURL(u));};
  },[sessionId]);
  return <div className="recording-review"><h3>Your recorded responses</h3><p>Review fluency and coherence, vocabulary, grammar, and pronunciation. No automatic band is assigned.</p>{error&&<p className="error-text">{error}</p>}{!clips.length&&!error&&<p>No microphone recordings are saved for this interview.</p>}{clips.map(c=><div className="recording-row" key={c.id}><div><span>Part {SPEAKING[c.step]?.part}</span><strong>{SPEAKING[c.step]?.title}</strong></div><audio controls src={urls[c.id]}/><button className="icon-button" title="Download recording" aria-label={`Download ${SPEAKING[c.step]?.title}`} onClick={()=>download(`speaking-${c.step+1}.${c.blob.type.includes('mp4')?'m4a':'webm'}`,c.blob)}><Download size={18}/></button></div>)}</div>;
}
