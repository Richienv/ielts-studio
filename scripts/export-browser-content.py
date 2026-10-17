"""Export MIT-licensed upstream SQL seeds to a browser-readable bank. Run from any directory."""
from pathlib import Path
import sqlite3,re,json,shutil,subprocess
ROOT=Path(__file__).resolve().parents[1]
SEEDS=ROOT/'src/core/src/database/seeds'
OUT=ROOT/'web/public/content'
OUT.mkdir(parents=True,exist_ok=True)
files=list(SEEDS.glob('reading/*academic*.sql'))+list(SEEDS.glob('listening/*.sql'))+list(SEEDS.glob('writing/*.sql'))
cols={}
for f in files:
    for table,columns in re.findall(r'INSERT INTO\s+(\w+)\s*\(([^)]*)\)',f.read_text()):
        cols.setdefault(table,set()).update(c.strip() for c in columns.split(','))
db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
for table,columns in cols.items():db.execute(f'CREATE TABLE {table} ({", ".join(c+" TEXT" for c in columns)})')
for f in files:
    sql=f.read_text();sql=re.sub(r'::(?:jsonb|json|uuid)','',sql)
    try:db.executescript(sql)
    except Exception as e:raise RuntimeError(f'{f.name}: {e}')
def rows(table,where='',args=(),order=''):
    return [dict(r) for r in db.execute(f'SELECT * FROM {table} '+where+' '+order,args)]
def decoded(v,default):
    if not v:return default
    try:return json.loads(v)
    except json.JSONDecodeError:return default
warnings=[]
repairs=[]
def groups(kind,parent):
    fk='passage_id' if kind=='reading' else 'section_id'
    result=[]
    for g in rows(kind+'_question_groups',f'WHERE {fk}=?',(parent,),'ORDER BY CAST(group_order AS INTEGER)'):
        qs=[]
        for q in rows(kind+'_questions','WHERE group_id=?',(g['id'],),'ORDER BY CAST(question_order AS INTEGER)'):
            qs.append({'id':q['id'],'number':int(q['question_order']),'text':q['text'],'answer':q['answer'],'options':decoded(q.get('options'),[]),'alternatives':decoded(q.get('accepted_answers'),[]),'gaps':decoded(q.get('completion_gaps'),None),'pairs':decoded(q.get('matching_pairs'),None)})
        result.append({'id':g['id'],'type':g['question_type'],'instructions':g['instructions'],'wordLimit':int(g.get('word_limit') or 0),'wordBank':decoded(g.get('word_bank'),[]),'questions':qs})
    return result
bank={'reading':[],'listening':[],'writing':[],'source':'IELTS Mastery Hub / Open Lingua (MIT)','contentNotice':'AI-authored practice material, not official IELTS examination papers. Band estimates are not calibrated scores.'}
for kind in ['reading','listening']:
    for t in rows(kind+'_tests',order='ORDER BY CAST(difficulty AS REAL), title'):
        parts=[]
        table='reading_passages' if kind=='reading' else 'listening_sections'
        num='passage_number' if kind=='reading' else 'section_number'
        for p in rows(table,'WHERE test_id=?',(t['id'],),f'ORDER BY CAST({num} AS INTEGER)'):
            part={'id':p['id'],'number':int(p[num]),'title':p['title'],'content':p.get('content',''),'transcript':p.get('transcript',''),'groups':groups(kind,p['id'])}
            if kind=='listening':
                source=SEEDS/'listening/listening-assets'/t['id']/f'section-{p[num]}.mp3'
                target=OUT/'audio'/t['id'];target.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target/source.name)
                duration=float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',str(source)],text=True).strip())
                part.update(audio=f'/content/audio/{t["id"]}/{source.name}',audioDuration=duration)
            parts.append(part)
        # Convert editor-specific structures into one unambiguous answer per numbered question.
        for part in parts:
            fixed=[]
            for group in part['groups']:
                headers=[]
                for question in group['questions']:
                    question['options']=[{'value':o.get('id',chr(65+i)), 'label':o.get('text','')} if isinstance(o,dict) else {'value':re.match(r'^([A-Za-z]+)[.)]',o).group(1) if re.match(r'^([A-Za-z]+)[.)]',o) else o,'label':o} for i,o in enumerate(question['options'])]
                    question['alternatives']=[a.get('text','') if isinstance(a,dict) else a for a in question['alternatives']]
                    if question['pairs'] and not question['options']:
                        question['options']=[{'value':v['right'],'label':v['right']} for v in question['pairs'] if v.get('right')]
                    if question['gaps']:
                        gaps=question['gaps'];answers=[v['answer'] for v in gaps if v.get('answer')]
                        if not answers:
                            headers.append(question)
                            continue
                        question['answer']=answers[0]
                        question['cells']=[v['gapText'] + (' ________' if v.get('answer') and '{{gap}}' not in v['gapText'] else '') for v in gaps]
                        question['text']=' | '.join(question['cells']).replace('{{gap}}','________')
                    question.pop('gaps',None);question.pop('pairs',None)
                if headers:
                    # The upstream editor numbered a table header as a real item. Replace it
                    # with a new, literal one-word completion from the first passage sentence.
                    sentence=re.split(r'(?<=[.!?])\s+',re.sub(r'^\([A-Z]\)\s*','',part['content']))[0]
                    matches=list(re.finditer(r"[A-Za-z]+(?:-[A-Za-z]+)*",sentence))
                    token=next(v for v in reversed(matches) if len(v.group())>3)
                    question=headers[0]
                    question.update(text=sentence[:token.start()]+'________'+sentence[token.end():],answer=token.group(),alternatives=[],options=[])
                    question.pop('gaps',None);question.pop('pairs',None)
                    fixed.append({'id':group['id']+'-repair','type':'sentence-completion','instructions':'Complete the sentence. Write ONE WORD ONLY from the passage.','wordLimit':1,'wordBank':[],'questions':[question]})
                    repairs.append({'test':t['title'],'question':question['number'],'repair':'Replaced incorrectly numbered table header with a one-word passage completion.'})
                    group['questions']=[v for v in group['questions'] if v not in headers]
                fixed.append(group)
            # Two upstream instructions contradict their keys. Fix the group instruction,
            # preserving the answer and passage rather than accepting impossible responses.
            for group in fixed:
                required=max((len(q['answer'].split()) for q in group['questions']),default=0)
                if t['id']=='f68bce16-3330-4c03-8cae-6bac17ae825d' and any(q['number']==11 for q in group['questions']):
                    group['wordLimit']=3
                    group['instructions']=group['instructions'].replace('TWO WORDS','THREE WORDS')
                    repairs.append({'test':t['title'],'repair':'Q10–13: raised two-word limit to three to allow center of gravity.'})
                if t['id']=='e38beedd-01aa-436e-a15f-18ed203ca819' and group['type']=='summary-completion':
                    group['wordLimit']=2
                    group['instructions']=group['instructions'].replace('ONE WORD ONLY','NO MORE THAN TWO WORDS').replace('ONE WORD','NO MORE THAN TWO WORDS')
                    repairs.append({'test':t['title'],'repair':'Final summary: raised one-word limit to two to allow readiness potential.'})
            part['groups']=fixed
        numbers=[q['number'] for p in parts for g in p['groups'] for q in g['questions']]
        if sorted(numbers)!=list(range(1,41)):
            warnings.append({'test':t['title'],'problem':'not 40 distinct numbered questions','numbers':numbers})
            continue
        bank[kind].append({'id':t['id'],'title':t['title'],'difficulty':t['difficulty'],'parts':parts})
for t in rows('writing_tests',order='ORDER BY title'):
    tasks=[]
    for q in rows('writing_tasks','WHERE test_id=?',(t['id'],),'ORDER BY CAST(task_number AS INTEGER)'):
        image=None;source=SEEDS/'writing/writing-assets'/q['id']/'figure.jpeg'
        if source.exists():
            target=OUT/'figures';target.mkdir(exist_ok=True);shutil.copy2(source,target/f'{q["id"]}.jpeg');image=f'/content/figures/{q["id"]}.jpeg'
        tasks.append({'id':q['id'],'number':int(q['task_number']),'title':q['title'],'prompt':q['prompt'],'minWords':int(q['min_words']),'image':image,'figureDescription':q['figure_description']})
    if len(tasks)==2 and tasks[0]['image']:bank['writing'].append({'id':t['id'],'title':t['title'],'tasks':tasks})
(OUT/'bank.json').write_text(json.dumps(bank,ensure_ascii=False))
(OUT/'validation.json').write_text(json.dumps({'counts':{k:len(bank[k]) for k in ['reading','listening','writing']},'warnings':warnings,'repairs':repairs},indent=2))
print(json.dumps({'counts':{k:len(bank[k]) for k in ['reading','listening','writing']},'warnings':warnings,'repairs':repairs,'types':sorted(set(g['type'] for k in ['reading','listening'] for t in bank[k] for p in t['parts'] for g in p['groups']))},indent=2))
