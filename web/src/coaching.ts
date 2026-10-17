export interface Strategy {
  id: string;
  title: string;
  framework: string;
  steps: string[];
  trap: string;
  example: { question: string; reasoning: string };
  drill: string;
  check: string;
}
export const coachingSources = {
  reading: [{ title: 'British Council · Reading format and strategies', url: 'https://takeielts.britishcouncil.org/what-is-ielts/how-it-works/test-format/reading' }],
  listening: [{ title: 'British Council · Listening preparation', url: 'https://takeielts.britishcouncil.org/prepare/ielts-academic/listening' }, { title: 'IDP · Forms, notes and distractors', url: 'https://ielts.idp.com/prepare/article-tables-forms-and-notes-in-the-ielts-listening-test' }],
  writing: [{ title: 'IELTS · Writing band descriptors', url: 'https://ielts.org/cdn/Guides/ielts-writing-band-descriptors.pdf' }, { title: 'British Council · Writing preparation', url: 'https://takeielts.britishcouncil.org/prepare/ielts-academic/writing' }, { title: 'IELTS · Developing an essay', url: 'https://ielts.org/news-and-insights/10-steps-to-writing-high-scoring-ielts-essays' }],
};
const claims: Strategy = {
  id: 'claims', title: 'True / False / Not Given', framework: 'Claim → Locate → Compare → Decide',
  steps: ['Pisahkan pernyataan menjadi siapa, melakukan apa, dan pembatas seperti all, only, before atau more than.', 'Cari lokasi lewat nama atau sinonim, lalu baca hubungan dalam kalimat dan konteks di sekitarnya.', 'TRUE: seluruh klaim didukung. FALSE: ada bukti yang bertentangan. NOT GIVEN: unsur yang diperlukan tidak dinyatakan.', 'Untuk YES / NO / NOT GIVEN, periksa pandangan penulis, bukan sekadar fakta yang disebut.'],
  trap: 'Topiknya disebut bukan berarti seluruh klaim terbukti. Tidak menemukan dukungan juga belum membuktikan FALSE.',
  example: { question: 'Source: “Some commuters cycle to work.” Claim: “All commuters cycle to work.”', reasoning: 'NOT GIVEN. Some membuktikan ada yang bersepeda, tetapi tidak mengatakan apakah sisanya bersepeda. Jika teks mengatakan “Some, but not all”, barulah ALL bertentangan dan jawabannya FALSE.' },
  drill: 'Ambil 5 klaim. Tandai pembatas, salin bukti, lalu tulis “supports”, “contradicts” atau unsur yang belum diketahui.', check: 'Kelima keputusan bisa dijelaskan dari teks tanpa memakai pengetahuan luar.',
};
const choice: Strategy = {
  id: 'choice', title: 'Multiple choice', framework: 'Question → Predict → Test every option',
  steps: ['Pastikan apa yang ditanya: alasan, opini, hasil, tujuan, atau detail.', 'Rumuskan makna jawaban sebelum terpaku pada kata dalam opsi.', 'Uji setiap opsi terhadap bukti. Coret opsi yang benar topiknya tetapi salah pelaku, waktu, sebab, atau cakupan.', 'Jika dua opsi terasa benar, cari perbedaan makna terkecil dan buktikan yang benar-benar menjawab pertanyaan.'],
  trap: 'Semua opsi bisa disebut di sumber. Yang dinilai adalah hubungan yang ditanyakan, bukan kata yang paling sering muncul.',
  example: { question: '“The train was cheap, but we chose the bus because the station was closed.” Why choose the bus? A Price. B Station closure.', reasoning: 'B. Cheap membahas kereta, sedangkan because menjelaskan alasan memilih bus. Menyebut price tidak menjadikannya alasan keputusan.' },
  drill: 'Untuk 4 soal, tulis satu alasan berbukti mengapa setiap opsi salah sebelum membaca kunci.', check: 'Kamu bisa membedakan “disebut” dan “menjawab pertanyaan” untuk semua opsi.',
};
const completion: Strategy = {
  id: 'completion', title: 'Sentence, summary and table completion', framework: 'Predict → Locate → Fit → Check',
  steps: ['Baca batas kata dan apakah harus mengambil kata dari teks atau memilih dari word bank.', 'Prediksi jenis kata dan makna yang hilang; untuk tabel, baca judul kolom dan baris.', 'Cari bagian yang menyampaikan makna yang sama, bukan hanya kalimat dengan kata identik.', 'Masukkan jawaban lalu periksa makna, ejaan, singular/plural, tata bahasa, dan batas kata. Ikuti format huruf jika opsi disediakan.'],
  trap: 'Jawaban yang benar maknanya tetap bisa salah karena terlalu banyak kata atau mengulang kata yang sudah ada sebelum gap.',
  example: { question: 'Source: “The roof is covered with solar panels.” Gap: “The roof has ____.” Limit: TWO WORDS.', reasoning: 'solar panels memenuhi makna, bentuk jamak, dan batas dua kata. covered with solar panels melebihi batas.' },
  drill: 'Kerjakan ulang 6 gap. Sebelum melihat teks, tulis jenis kata yang dibutuhkan; setelahnya hitung kata.', check: 'Enam jawaban memenuhi makna dan instruksi, bukan hanya cocok dengan kunci.',
};
const headings: Strategy = {
  id: 'headings', title: 'Matching headings', framework: 'Paragraph purpose → Own heading → Compare',
  steps: ['Ringkas fungsi seluruh paragraf dalam satu kalimat: masalah, penjelasan, perbandingan, perubahan, atau hasil.', 'Baca keseluruhan paragraf saat kalimat awal hanya memberi contoh atau latar.', 'Bandingkan ringkasan dengan heading. Periksa apakah heading mencakup ide utama, bukan satu detail.', 'Uji ulang heading yang terlalu luas atau terlalu sempit sebelum memilih.'],
  trap: 'Nama atau kata yang sama di heading dan paragraf bisa hanya menunjuk contoh kecil.',
  example: { question: 'A paragraph mentions bicycles, buses and trains to explain why city transport policy changed. Heading: “Bicycle design” or “Reasons for a policy shift”?', reasoning: 'Reasons for a policy shift menangkap fungsi paragraf. Bicycle design hanya tertarik pada satu kata yang disebut.' },
  drill: 'Buat heading sendiri untuk 4 paragraf sebelum melihat daftar opsi.', check: 'Setiap heading merangkum seluruh paragraf dan bisa dibedakan dari paragraf tetangganya.',
};
const matching: Strategy = {
  id: 'matching', title: 'Matching information, people and features', framework: 'Map → Locate → Verify the relationship',
  steps: ['Tentukan apakah yang dicari detail tertentu, orang, fitur, atau opini. Catat apakah pilihan boleh dipakai ulang.', 'Buat peta singkat paragraf atau pembicara agar lokasi informasi mudah ditelusuri.', 'Cari detail spesifik dan sinonimnya; jangan menganggap semua jawaban mengikuti urutan paragraf.', 'Periksa siapa yang menyatakan apa, termasuk bantahan, perbandingan, dan pendapat yang hanya dikutip.'],
  trap: 'Nama yang muncul dekat sebuah gagasan belum tentu pemilik gagasan itu.',
  example: { question: '“Lin rejected Rao’s proposal to close the park.” Who proposed closure?', reasoning: 'Rao. Lin disebut duluan tetapi posisinya menolak. Hubungan subjek, kata kerja, dan gagasan menentukan jawaban.' },
  drill: 'Buat tabel 5 nama/lokasi dan satu klaim yang benar-benar terkait dengan masing-masing.', check: 'Setiap pasangan memiliki bukti hubungan, bukan sekadar kedekatan kata.',
};
const endings: Strategy = {
  id: 'endings', title: 'Matching sentence endings', framework: 'Read the stem → Predict meaning → Prove the ending',
  steps: ['Baca stem dan tentukan hubungan yang perlu dilengkapi: sebab, akibat, perbandingan, atau definisi.', 'Cari bagian relevan di teks dan prediksi kelanjutannya.', 'Uji ending terhadap makna sumber, lalu cek apakah kalimat lengkapnya gramatikal.', 'Jangan memilih ending hanya karena tata bahasanya cocok; beberapa opsi sengaja sama-sama bisa dipasang.'],
  trap: 'Kalimat yang terdengar lancar belum tentu menyatakan hal yang dikatakan penulis.',
  example: { question: 'Source: “Shade reduced water loss.” Stem: “Plants in shade…” Endings: “lost less water” / “grew faster”.', reasoning: 'lost less water didukung langsung. grew faster terdengar masuk akal tetapi tidak dinyatakan.' },
  drill: 'Selesaikan 5 stem tanpa melihat opsi, baru cocokkan dengan ending yang disediakan.', check: 'Kamu dapat menjelaskan hubungan sumber untuk setiap ending pilihanmu.',
};
const listeningCompletion: Strategy = {
  id: 'listen-completion', title: 'Forms, notes and sentence completion', framework: 'Predict → Track → Confirm → Check',
  steps: ['Saat preview, tandai konteks gap, batas kata, satuan, dan jenis jawaban seperti tanggal, harga, nama atau noun jamak.', 'Ikuti urutan percakapan dan dengarkan padanan makna dari label pertanyaan.', 'Tahan pilihan awal ketika pembicara mengoreksi, menolak atau mengganti keputusan. Pilih informasi yang akhirnya berlaku.', 'Setelah bagian selesai, cek ejaan, angka, singular/plural, dan batas kata. Jika tertinggal, pindah ke soal berikutnya agar tidak kehilangan rangkaian.'],
  trap: 'Angka atau hari pertama sering merupakan tawaran awal, bukan hasil akhir. Jawaban akhir tetap harus dibuktikan dari konteks, bukan aturan “pilih yang terakhir”.',
  example: { question: '“We planned Tuesday, but the tutor is unavailable. Friday is confirmed.” Appointment: _____.', reasoning: 'Friday. Tuesday dibatalkan oleh but; confirmed menandai keputusan. Ini contoh buatan untuk latihan, bukan kutipan rekaman tesmu.' },
  drill: 'Dalam practice mode, dengarkan ulang bagian yang salah tanpa transcript, tulis jawaban beserta kata koreksinya, lalu cocokkan dengan transcript.', check: 'Kamu bisa menangkap jawaban dan alasan perubahan saat sekali dengar pada latihan baru.',
};
const listeningChoice: Strategy = { ...choice, id: 'listen-choice', framework: 'Preview differences → Follow meaning → Confirm the decision', steps: ['Baca perbedaan antaropsi saat preview, bukan sekadar semua kata yang sama.', 'Dengarkan siapa yang berpendapat dan apakah pendapat itu diterima, ditolak, atau diubah.', 'Tunggu alasan atau kesimpulan yang menjawab pertanyaan; penyebutan opsi saja tidak cukup.', 'Kalau tertinggal satu jawaban, pertahankan orientasi ke nomor berikutnya. Analisis transcript dilakukan setelah sesi.'], drill: 'Sesudah tes, tandai untuk 4 soal kapan setiap opsi disebut dan mengapa masing-masing diterima atau ditolak.', check: 'Kamu bisa menolak distractor dengan bukti makna dan mengikuti nomor berikutnya tanpa tersangkut.' };
const task1: Strategy = {
  id: 'task1', title: 'Writing Task 1 · charts, maps and processes', framework: 'Overview → Group → Support → Audit',
  steps: ['Identifikasi visual: data perlu tren/perbandingan, proses perlu alur/tahap, peta perlu perubahan lokasi. Jangan memaksakan bahasa tren ke proses.', 'Tulis overview yang memilih gambaran besar. Lalu kelompokkan detail berdasarkan pola atau tahap yang bermakna.', 'Dukung dengan angka/satuan yang benar atau urutan proses/lokasi yang bisa dilihat. Bandingkan saat relevan; jangan mengarang sebab.', 'Audit terhadap visual: arah perubahan, waktu, satuan, pelaku proses, dan detail utama. Sisakan waktu untuk Task 2.'],
  trap: 'Menyalin semua angka tidak menggantikan overview. Bahasa rumit juga tidak menyelamatkan proses yang terbalik atau klaim yang tidak terlihat.',
  example: { question: 'Invented chart: A rises from 20 to 60; B stays near 30. Weak: “A was 20. B was 30.”', reasoning: 'Overview: “Overall, A increased substantially, while B remained relatively stable.” Detail berikutnya memakai nilai dan periode yang tersedia. Tidak perlu mengarang penyebab.' },
  drill: 'Dalam 5 menit, buat overview dan dua kelompok detail dari satu visual, lalu cek setiap klaim ke gambar.', check: 'Overview menunjukkan pola utama; setiap detail akurat dan punya fungsi, tanpa opini atau sebab tambahan.',
};
const task2: Strategy = {
  id: 'task2', title: 'Writing Task 2 · developing an argument', framework: 'Answer → Reason → Example → Link',
  steps: ['Ubah instruksi menjadi checklist: apa yang harus dijawab, sudut pandang mana yang wajib dibahas, dan apakah perlu pendapatmu.', 'Pilih posisi yang konsisten. Rencanakan paragraf berdasarkan tugas: opinion, discuss both views, advantages/disadvantages, causes/solutions, atau dua pertanyaan.', 'Kembangkan satu gagasan per paragraf: klaim → mengapa/bagaimana → contoh relevan → kaitan ke pertanyaan. Contoh tidak perlu statistik palsu.', 'Uji logika dan batas klaim. Pilih kata yang tepat, variasikan struktur sesuai kebutuhan, lalu edit pola error yang berulang.'],
  trap: 'Template yang dihafal bisa melewatkan setengah instruksi. Banyak moreover, kosakata langka, atau paragraf panjang tidak sama dengan pengembangan argumen.',
  example: { question: 'Claim: “Practical classes help students.” How can this be developed?', reasoning: '“Practical classes let students test an abstract idea in a concrete setting. For example, comparing material costs in a workshop requires them to apply arithmetic to an actual decision.” Mekanisme dan contoh mendukung klaim tanpa data penelitian buatan.' },
  drill: 'Dalam 8 menit, kembangkan satu klaim menjadi paragraf dengan mekanisme dan contoh, lalu tandai kontribusi setiap kalimat.', check: 'Semua instruksi terjawab; setiap kalimat memperjelas argumen, tanpa lompatan logika atau frasa hiasan.',
};
export function strategyFor(skill: 'reading' | 'listening', type: string): Strategy | undefined {
  if (skill === 'listening') {
    if (type === 'multiple-choice') return listeningChoice;
    if (type === 'matching') return { ...matching, id: 'listen-matching', title: 'Listening · matching speakers and features', steps: ['Saat preview, tandai perbedaan opsi dan apakah opsi boleh dipakai ulang.', 'Ikuti pembicara dan fitur yang dikaitkan dengannya, termasuk opini yang berubah.', 'Jangan memilih hanya karena opsi disebut; pastikan hubungan atau keputusan yang berlaku.', 'Jika satu pasangan terlewat, lanjutkan mengikuti pembicara berikutnya.'] };
    if (['form-completion', 'note-completion', 'sentence-completion', 'table-completion', 'summary-completion', 'short-answer'].includes(type)) return listeningCompletion;
    return undefined;
  }
  if (['true-false-not-given', 'yes-no-not-given'].includes(type)) return { ...claims, title: type === 'yes-no-not-given' ? 'Yes / No / Not Given' : claims.title };
  if (type === 'multiple-choice') return choice;
  if (type === 'matching-headings') return headings;
  if (['matching-information', 'matching-features'].includes(type)) return matching;
  if (type === 'matching-sentence-endings') return endings;
  if (['sentence-completion', 'summary-completion', 'table-completion', 'short-answer', 'note-completion', 'flowchart-completion', 'diagram-label-completion'].includes(type)) return completion;
  return undefined;
}
export function strategiesFor(skill: 'reading' | 'listening' | 'writing', types?: string[]): Strategy[] {
  if (skill === 'writing') return [task1, task2];
  const defaults = skill === 'reading' ? ['true-false-not-given', 'multiple-choice', 'matching-headings', 'matching-information', 'matching-sentence-endings', 'sentence-completion'] : ['form-completion', 'multiple-choice', 'matching'];
  return [...new Map((types ?? defaults).map(type => strategyFor(skill, type)).filter((s): s is Strategy => !!s).map(s => [s.id, s])).values()];
}
