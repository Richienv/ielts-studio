import { useState } from 'react';
import { ChevronDown, Target } from 'lucide-react';
import { coachingSources, strategiesFor, strategyFor, type Strategy } from './coaching';
import type { ReviewSkill } from './examiner';
function StrategyCard({ strategy }: { strategy: Strategy }) {
  return <details className="strategy-card"><summary><span><small>{strategy.title}</small><strong>{strategy.framework}</strong></span><ChevronDown size={16}/></summary><div><ol>{strategy.steps.map((step, i) => <li key={i}>{step}</li>)}</ol><div className="strategy-trap"><strong>Jebakan yang perlu dikenali</strong><p>{strategy.trap}</p></div><div className="strategy-example"><small>Contoh buatan · bukan soal dalam tesmu</small><p className="preserve-whitespace">{strategy.example.question}</p><p>{strategy.example.reasoning}</p></div><dl><dt>Latihan terarah</dt><dd>{strategy.drill}</dd><dt>Cek penguasaan</dt><dd>{strategy.check}</dd></dl></div></details>;
}
export default function Band9Playbook({ skill: fixedSkill, types }: { skill?: ReviewSkill; types?: string[] }) {
  const [chosen, choose] = useState<ReviewSkill>('reading'); const skill = fixedSkill ?? chosen;
  return <section className="band9-playbook"><div className="playbook-heading"><Target size={22}/><div><span className="date-line">Frameworks, traps & deliberate practice</span><h2>Build the habits behind Band 9.</h2></div></div><p>Pilih strategi, pahami contoh, lalu uji di soal baru. Panduan ini tersedia tanpa login. Review ChatGPT di bawah menghubungkannya dengan jawabanmu sendiri.</p>
    {!fixedSkill && <label className="examiner-field playbook-skill">Skill<select aria-label="Strategy skill" value={skill} onChange={e => choose(e.target.value as ReviewSkill)}><option value="reading">Reading</option><option value="listening">Listening</option><option value="writing">Writing</option></select></label>}
    <div className="strategy-grid">{strategiesFor(skill, types).map(strategy => <StrategyCard key={strategy.id} strategy={strategy}/>)}</div>
    <p className="strategy-standard">{skill === 'writing' ? 'Target band 9: jawab tugas secara lengkap dan mendalam, susun pesan yang mudah diikuti, gunakan kosakata secara tepat dan alami, serta kendalikan struktur dan grammar dengan kesalahan yang sangat jarang.' : 'Reading dan Listening dinilai dari jawaban yang benar. Framework membantu mengurangi salah tafsir dan kesalahan instruksi; tidak memberi poin tambahan jika jawaban akhirnya salah.'} Nama framework adalah alat bantu belajar dari IELTS Studio, bukan formula resmi atau jaminan skor.</p><div className="strategy-sources"><span>Rujukan resmi</span>{coachingSources[skill].map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>
  </section>;
}
export function QuestionStrategy({ skill, type }: { skill: 'reading' | 'listening'; type: string }) {
  const strategy = strategyFor(skill, type); if (!strategy) return null;
  return <div className="question-strategy"><StrategyCard strategy={strategy}/></div>;
}
