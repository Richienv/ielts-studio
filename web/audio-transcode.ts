import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import { existsSync } from 'node:fs';
/** Gemini accepts MP3; Chrome's MediaRecorder normally produces WebM/Opus. */
export async function assessmentMp3(input:Buffer):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const proc=spawn(process.env.FFMPEG_PATH||(ffmpegStatic&&existsSync(ffmpegStatic)?ffmpegStatic:'ffmpeg'),['-hide_banner','-loglevel','error','-i','pipe:0','-vn','-ac','1','-ar','24000','-codec:a','libmp3lame','-b:a','48k','-f','mp3','pipe:1'],{stdio:['pipe','pipe','pipe']});
  const chunks:Buffer[]=[];let length=0;let diagnostics='';
  const timer=setTimeout(()=>{proc.kill();reject(new Error('Audio conversion timed out. Download the recordings for manual review.'));},30000);
  proc.stdout.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>8_000_000){proc.kill();reject(new Error('The converted recording is too large.'));}else chunks.push(chunk);});
  proc.stderr.on('data',(chunk:Buffer)=>{diagnostics+=chunk.toString().slice(0,300);});
  proc.on('error',()=>{clearTimeout(timer);reject(new Error('Voice assessment needs ffmpeg on the local server. Recordings remain available for playback and download.'));});
  proc.on('close',code=>{clearTimeout(timer);if(code===0&&length)resolve(Buffer.concat(chunks));else reject(new Error(diagnostics?'A voice recording could not be converted. Download it for manual review.':'Audio conversion failed.'));});
  proc.stdin.on('error',()=>{});proc.stdin.end(input);
 });
}
