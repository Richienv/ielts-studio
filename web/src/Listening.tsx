import { useEffect, useRef, useState } from 'react';
import { Headphones, Volume2, Play, RotateCcw } from 'lucide-react';
import { formatTime, listeningTimeline } from './engine';
import type { Paper, Session } from './types';
export function ListeningAudio({paper,session,now,onReplay}:{paper:Paper;session:Session;now:number;onReplay:(part:number)=>void}) {
  const audio=useRef<HTMLAudioElement>(null);const [blocked,setBlocked]=useState(false);const [volume,setVolume]=useState(.85);const [failed,setFailed]=useState(false);
  const schedule=listeningTimeline(paper);
  const elapsed=Math.max(0,((session.pausedAt??now)-session.sectionStartedAt)/1000);
  const current=schedule.parts.find(t=>elapsed>=t.start&&elapsed<t.end);
  const index=current?.part??3;const part=paper.parts[index];
  const phase=current?(elapsed<current.audioStart?'preview':elapsed<current.audioEnd?'playing':'checking'):'review';
  const shouldPlay=phase==='playing'&&!session.pausedAt;
  const offset=current?Math.max(0,elapsed-current.audioStart):0;
  const offsetRef=useRef(offset);offsetRef.current=offset;
  const shouldPlayRef=useRef(shouldPlay);shouldPlayRef.current=shouldPlay;
  useEffect(()=>{const el=audio.current;if(!el)return;el.src=part.audio??'';el.load();setFailed(false);setBlocked(false);},[part.audio]);
  useEffect(()=>{const el=audio.current;if(!el)return;el.volume=volume;},[volume]);
  useEffect(()=>{const el=audio.current;if(!el)return;
    if(!shouldPlay){el.pause();return;}
    if(el.readyState>0&&Math.abs(el.currentTime-offset)>2)el.currentTime=offset;
    if(el.paused)void el.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));
  },[shouldPlay,offset,index]);
  const countdown=current?phase==='preview'?current.audioStart-elapsed:phase==='checking'?current.end-elapsed:current.audioEnd-elapsed:session.duration-elapsed;
  return <div className="listening-status"><audio ref={audio} preload="auto" onLoadedMetadata={()=>{if(audio.current){audio.current.currentTime=offsetRef.current;if(shouldPlayRef.current)void audio.current.play().catch(()=>setBlocked(true));}}} onError={()=>setFailed(true)}/>
    <div className="audio-symbol"><Headphones size={24}/></div><div className="audio-status-copy"><strong>{phase==='preview'?`Read Part ${index+1} questions`:phase==='playing'?`Part ${index+1} recording is playing`:phase==='checking'?`Check Part ${index+1} answers`:'Final answer check'}</strong><span>{phase==='playing'?'You will hear this recording once.':phase==='review'?'Use these two minutes to check all 40 answers.':`Next stage in ${formatTime(countdown)}`}</span></div>
    {phase==='playing'&&<div className="audio-bars" aria-label="Audio playing">{Array.from({length:15},(_,i)=><i key={i}/>)}</div>}
    <label className="volume-control"><Volume2 size={18}/><span className="sr-only">Volume</span><input aria-label="Listening volume" type="range" min="0" max="1" step=".05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
    {session.mode==='practice'&&<button className="small-button" onClick={()=>onReplay(session.part)}><RotateCcw size={14}/>Replay selected part</button>}
    {blocked&&shouldPlay&&<button className="primary small-button" onClick={()=>{const el=audio.current;if(el){el.currentTime=offsetRef.current;void el.play().then(()=>setBlocked(false)).catch(()=>setFailed(true));}}}><Play size={15}/>Enable audio</button>}
    {failed&&<p className="error-text">The recording could not load. Check the local server, then reload. Your answers are saved; the exam clock continues.</p>}
  </div>;
}
