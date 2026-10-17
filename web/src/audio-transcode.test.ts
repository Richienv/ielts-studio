import {it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {assessmentMp3} from '../audio-transcode';
it('converts browser-compatible audio into a decodable MP3 for the evaluator',async()=>{
 const wav=spawnSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=0.3','-f','wav','pipe:1'],{encoding:null});
 expect(wav.status).toBe(0);const mp3=await assessmentMp3(wav.stdout);expect(mp3.length).toBeGreaterThan(500);
 const info=spawnSync('ffprobe',['-v','quiet','-show_entries','stream=codec_name,sample_rate,channels','-of','json','pipe:0'],{input:mp3,encoding:'utf8'});
 expect(info.status).toBe(0);const stream=JSON.parse(info.stdout).streams[0];expect(stream.codec_name).toBe('mp3');expect(stream.sample_rate).toBe('24000');expect(stream.channels).toBe(1);
});
