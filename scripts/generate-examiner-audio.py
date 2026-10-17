"""Rebuild the original scripted examiner prompts using macOS Daniel + ffmpeg."""
from pathlib import Path
import re,subprocess,tempfile,concurrent.futures
root=Path(__file__).resolve().parents[1]
source=(root/'web/src/engine.ts').read_text()
prompts=re.findall(r"\{id:'([^']+)',part:\d+,title:'[^']*',prompt:'([^']*)'",source)
prompts.append(('sound-check','This is a sound check for your IELTS practice test. Adjust your headphone volume until you can hear this recording clearly. Your test has not started.'))
out=root/'web/public/content/examiner';out.mkdir(parents=True,exist_ok=True)
def create(item):
 ident,text=item
 with tempfile.TemporaryDirectory() as temp:
  aiff=Path(temp)/'prompt.aiff'
  subprocess.run(['say','-v','Daniel','-r','160','-o',str(aiff),text],check=True)
  subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(aiff),'-codec:a','libmp3lame','-b:a','96k',str(out/f'{ident}.mp3')],check=True)
 return ident
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for ident in pool.map(create,prompts):print(ident,flush=True)
print(f'{len(prompts)} prompts generated.')
