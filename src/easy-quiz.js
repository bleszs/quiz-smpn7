const EASY_QUIZ = {
  seedKey: 'medan-simpang-mudah-v1',
  title: 'Kenalan Mudah Medan Simpang',
  description: 'Kuis ringan untuk mengenal website, kawasan Silalas, kategori lokasi, dan cara bermain Quiz Medan Simpang.',
  status: 'published',
  questions: [
    {
      category: 'Tentang Website',
      prompt: 'Apa nama website yang sedang kita gunakan?',
      options: ['Medan Simpang', 'Medan Bermain', 'Jelajah Sumatera', 'Kota Kita'],
      correctOptionIndex: 0,
      explanation: 'Nama website ini adalah Medan Simpang.',
      imageUrl: 'assets/medan-simpang-logo.png',
      altText: 'Logo Medan Simpang'
    },
    {
      category: 'Tentang Kota',
      prompt: 'Medan Simpang memperkenalkan kawasan yang berada di kota apa?',
      options: ['Medan', 'Jakarta', 'Bandung', 'Surabaya'],
      correctOptionIndex: 0,
      explanation: 'Medan Simpang memperkenalkan kawasan dan cerita dari Kota Medan.',
      imageUrl: 'assets/kampung-silalas.jpg',
      altText: 'Suasana permukiman di Kota Medan'
    },
    {
      category: 'Kenali Kawasan',
      prompt: 'Apa nama kawasan yang dijelajahi dalam kuis ini?',
      options: ['Silalas', 'Kesawan', 'Belawan', 'Tembung'],
      correctOptionIndex: 0,
      explanation: 'Materi kuis mengajak peserta mengenal kawasan Silalas.',
      imageUrl: 'assets/kampung-silalas.jpg',
      altText: 'Suasana kawasan Silalas'
    },
    {
      category: 'Kenali Sungai',
      prompt: 'Sungai apa yang berada dekat kawasan Silalas?',
      options: ['Sungai Deli', 'Sungai Musi', 'Sungai Kapuas', 'Sungai Ciliwung'],
      correctOptionIndex: 0,
      explanation: 'Kawasan Silalas berada di sekitar tepian Sungai Deli.',
      imageUrl: 'assets/deli-riverview.jpg',
      altText: 'Pemandangan tepian Sungai Deli'
    },
    {
      category: 'Walking Trail',
      prompt: 'Kegiatan utama yang ditawarkan pada halaman Silalas adalah apa?',
      options: ['Berjalan menyusuri rute', 'Bermain sepak bola', 'Berenang', 'Naik pesawat'],
      correctOptionIndex: 0,
      explanation: 'Pengunjung dapat berjalan menyusuri rute untuk mengenal tempat dan kehidupan kawasan.',
      imageUrl: 'assets/kampung-silalas.jpg',
      altText: 'Rute berjalan kaki di kawasan Silalas'
    },
    {
      category: 'Walking Trail',
      prompt: 'Ada berapa pilihan walking trail di kawasan Silalas?',
      options: ['5 rute', '2 rute', '8 rute', '10 rute'],
      correctOptionIndex: 0,
      explanation: 'Halaman Silalas menyediakan lima pilihan walking trail.',
      imageUrl: 'assets/deli-riverview.jpg',
      altText: 'Salah satu rute walking trail Silalas'
    },
    {
      category: 'Kategori Lokasi',
      prompt: 'Kategori iEat digunakan untuk tempat apa?',
      options: ['Tempat makan', 'Tempat ibadah', 'Jembatan', 'Sekolah'],
      correctOptionIndex: 0,
      explanation: 'iEat menandai tempat makan atau kuliner yang dapat ditemui di rute.',
      imageUrl: 'assets/jajanan-lokal.jpg',
      altText: 'Jajanan lokal di kawasan Silalas'
    },
    {
      category: 'Kategori Lokasi',
      prompt: 'Kategori iDrink digunakan untuk tempat apa?',
      options: ['Tempat minum', 'Rumah sakit', 'Lapangan', 'Pemakaman'],
      correctOptionIndex: 0,
      explanation: 'iDrink menandai tempat singgah untuk menikmati minuman.',
      imageUrl: 'assets/rumah-qohwah.jpg',
      altText: 'Rumah Qohwah sebagai salah satu tempat minum'
    },
    {
      category: 'Kategori Lokasi',
      prompt: 'Kategori iSee mengajak pengunjung melakukan apa?',
      options: ['Melihat lokasi menarik', 'Membeli tiket pesawat', 'Bermain gim daring', 'Menginap di hotel'],
      correctOptionIndex: 0,
      explanation: 'iSee menandai situs atau lokasi menarik yang dapat dilihat sepanjang rute.',
      imageUrl: 'assets/masjid-silalas.jpg',
      altText: 'Salah satu situs yang dapat dilihat di Silalas'
    },
    {
      category: 'Kategori Lokasi',
      prompt: 'Apa arti kategori iSurprise?',
      options: ['Temuan menarik yang mudah terlewat', 'Tempat parkir', 'Loket pembayaran', 'Halte bus'],
      correctOptionIndex: 0,
      explanation: 'iSurprise menandai kejutan atau temuan menarik yang sering tidak disadari pengunjung.',
      imageUrl: 'assets/jembatan-rel.jpg',
      altText: 'Jembatan rel sebagai salah satu temuan menarik'
    },
    {
      category: 'Cara Bermain',
      prompt: 'Apa yang dibutuhkan peserta untuk masuk ke permainan?',
      options: ['Kode room', 'Nomor paspor', 'Kartu ATM', 'Surat izin'],
      correctOptionIndex: 0,
      explanation: 'Peserta masuk menggunakan kode room yang dibagikan oleh host.',
      imageUrl: 'assets/medan-simpang-logo.png',
      altText: 'Logo Quiz Medan Simpang'
    },
    {
      category: 'Cara Bermain',
      prompt: 'Selain mengetik kode room, peserta dapat masuk dengan memindai apa?',
      options: ['Kode QR', 'Sidik jari', 'Kartu pelajar', 'Barcode produk'],
      correctOptionIndex: 0,
      explanation: 'Kode QR room dapat dipindai agar peserta langsung membuka halaman masuk.',
      imageUrl: 'assets/medan-simpang-logo.png',
      altText: 'Identitas visual Quiz Medan Simpang'
    },
    {
      category: 'Cara Bermain',
      prompt: 'Berapa jumlah soal dalam satu permainan?',
      options: ['15 soal', '5 soal', '25 soal', '50 soal'],
      correctOptionIndex: 0,
      explanation: 'Satu permainan terdiri dari 15 soal.',
      imageUrl: 'assets/kampung-silalas.jpg',
      altText: 'Suasana kawasan yang menjadi materi kuis'
    },
    {
      category: 'Cara Bermain',
      prompt: 'Berapa waktu yang tersedia untuk menjawab satu soal?',
      options: ['10 detik', '1 menit', '5 menit', '30 menit'],
      correctOptionIndex: 0,
      explanation: 'Setiap soal memiliki waktu menjawab 10 detik.',
      imageUrl: 'assets/deli-riverview.jpg',
      altText: 'Rute Medan Simpang yang menjadi materi kuis'
    },
    {
      category: 'Hasil Permainan',
      prompt: 'Apa yang ditampilkan setelah seluruh soal selesai?',
      options: ['Papan peringkat akhir', 'Halaman belanja', 'Jadwal penerbangan', 'Ramalan cuaca'],
      correctOptionIndex: 0,
      explanation: 'Setelah permainan selesai, seluruh peserta dapat melihat papan peringkat akhir.',
      imageUrl: 'assets/medan-simpang-logo.png',
      altText: 'Logo Quiz Medan Simpang'
    }
  ].map((question, index) => ({
    ...question,
    timeLimitMs: 10_000,
    basePoints: 1000,
    position: index + 1
  }))
};

module.exports = { EASY_QUIZ };
