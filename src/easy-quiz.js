const EASY_QUIZ = {
  seedKey: 'medan-simpang-mudah-v1',
  seedVersion: 3,
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
      imageUrl: 'assets/kampung-silalas.webp',
      altText: 'Suasana permukiman di Kota Medan'
    },
    {
      category: 'Kenali Kawasan',
      prompt: 'Apa nama kawasan yang dijelajahi dalam kuis ini?',
      options: ['Silalas', 'Kesawan', 'Belawan', 'Tembung'],
      correctOptionIndex: 0,
      explanation: 'Materi kuis mengajak peserta mengenal kawasan Silalas.',
      imageUrl: 'assets/kampung-silalas.webp',
      altText: 'Suasana kawasan Silalas'
    },
    {
      category: 'Kenali Sungai',
      prompt: 'Sungai apa yang berada dekat kawasan Silalas?',
      options: ['Sungai Deli', 'Sungai Musi', 'Sungai Kapuas', 'Sungai Ciliwung'],
      correctOptionIndex: 0,
      explanation: 'Kawasan Silalas berada di sekitar tepian Sungai Deli.',
      imageUrl: 'assets/deli-riverview.webp',
      altText: 'Pemandangan tepian Sungai Deli'
    },
    {
      category: 'Walking Trail',
      prompt: 'Kegiatan utama yang ditawarkan pada halaman Silalas adalah apa?',
      options: ['Berjalan menyusuri rute', 'Bermain sepak bola', 'Berenang', 'Naik pesawat'],
      correctOptionIndex: 0,
      explanation: 'Pengunjung dapat berjalan menyusuri rute untuk mengenal tempat dan kehidupan kawasan.',
      imageUrl: 'assets/kampung-silalas.webp',
      altText: 'Rute berjalan kaki di kawasan Silalas'
    },
    {
      category: 'Walking Trail',
      prompt: 'Ada berapa pilihan walking trail di kawasan Silalas?',
      options: ['5 rute', '2 rute', '8 rute', '10 rute'],
      correctOptionIndex: 0,
      explanation: 'Halaman Silalas menyediakan lima pilihan walking trail.',
      imageUrl: 'assets/deli-riverview.webp',
      altText: 'Salah satu rute walking trail Silalas'
    },
    {
      category: 'Kategori Lokasi',
      prompt: 'Kategori iEat digunakan untuk tempat apa?',
      options: ['Tempat makan', 'Tempat ibadah', 'Jembatan', 'Sekolah'],
      correctOptionIndex: 0,
      explanation: 'iEat menandai tempat makan atau kuliner yang dapat ditemui di rute.',
      imageUrl: 'assets/jajanan-lokal.webp',
      altText: 'Jajanan lokal di kawasan Silalas'
    },
    {
      category: 'Kategori Lokasi',
      prompt: 'Kategori iDrink digunakan untuk tempat apa?',
      options: ['Tempat minum', 'Rumah sakit', 'Lapangan', 'Pemakaman'],
      correctOptionIndex: 0,
      explanation: 'iDrink menandai tempat singgah untuk menikmati minuman.',
      imageUrl: 'assets/rumah-qohwah.webp',
      altText: 'Rumah Qohwah sebagai salah satu tempat minum'
    },
    {
      category: 'Kategori Lokasi',
      prompt: 'Kategori iSee mengajak pengunjung melakukan apa?',
      options: ['Melihat lokasi menarik', 'Membeli tiket pesawat', 'Bermain gim daring', 'Menginap di hotel'],
      correctOptionIndex: 0,
      explanation: 'iSee menandai situs atau lokasi menarik yang dapat dilihat sepanjang rute.',
      imageUrl: 'assets/masjid-silalas.webp',
      altText: 'Salah satu situs yang dapat dilihat di Silalas'
    },
    {
      category: 'Kenali Tempat',
      prompt: 'SMP-SMA Kalam Kudus termasuk kategori lokasi apa di Medan Simpang?',
      options: ['iSee', 'iEat', 'iDrink', 'iSurprise'],
      correctOptionIndex: 0,
      explanation: 'SMP-SMA Kalam Kudus termasuk kategori iSee pada Trails 6 Koridor Adam Malik.',
      imageUrl: 'assets/kampung-silalas.webp',
      altText: 'Kawasan yang dilalui dalam rute Medan Simpang'
    },
    {
      category: 'Kenali Tempat',
      prompt: 'Di manakah lokasi SMP-SMA Kalam Kudus?',
      options: ['Jl. Mayang No. 10, Sekip', 'Jl. Pala, Silalas', 'Jl. Guru Patimpus, Silalas', 'Jl. Sei Deli, Silalas'],
      correctOptionIndex: 0,
      explanation: 'SMP-SMA Kalam Kudus beralamat di Jl. Mayang No. 10, Kelurahan Sekip, Kecamatan Medan Petisah.',
      imageUrl: 'assets/kampung-silalas.webp',
      altText: 'Lingkungan kawasan pada rute Medan Simpang'
    },
    {
      category: 'Kenali Tempat',
      prompt: 'Tempat minum apa yang menjadi salah satu titik awal Trails 1?',
      options: ['Rumah Qohwah', 'Dapur Sedap Wangi', 'Masjid Al Muflihin', 'SMP-SMA Kalam Kudus'],
      correctOptionIndex: 0,
      explanation: 'Rumah Qohwah merupakan tempat minum dan salah satu titik awal Trails 1 Deli Riverside.',
      imageUrl: 'assets/rumah-qohwah.webp',
      altText: 'Rumah Qohwah di kawasan Silalas'
    },
    {
      category: 'Kuliner Silalas',
      prompt: 'Tempat makan mana yang menyajikan beragam masakan rumahan?',
      options: ['Dapur Sedap Wangi', 'Rumah Qohwah', 'Gereja Kalam Kudus', 'Jembatan Kereta Api'],
      correctOptionIndex: 0,
      explanation: 'Dapur Sedap Wangi adalah rumah makan dengan beragam pilihan masakan rumahan.',
      imageUrl: 'assets/jajanan-lokal.webp',
      altText: 'Kuliner lokal yang dapat ditemui di kawasan Silalas'
    },
    {
      category: 'Jejak Kota',
      prompt: 'Jembatan Kereta Api tua di kawasan Silalas melintang di atas sungai apa?',
      options: ['Sungai Deli', 'Sungai Musi', 'Sungai Kapuas', 'Sungai Asahan'],
      correctOptionIndex: 0,
      explanation: 'Jembatan Kereta Api tua tersebut melintang di atas Sungai Deli.',
      imageUrl: 'assets/jembatan-rel.webp',
      altText: 'Jembatan rel kereta api tua di atas Sungai Deli'
    },
    {
      category: 'Kenali Rute',
      prompt: 'Rute berapa yang mengangkat tema Masjid Tua Silalas?',
      options: ['Trail 4', 'Trail 1', 'Trail 2', 'Trail 6'],
      correctOptionIndex: 0,
      explanation: 'Trail 4 mengangkat tema Masjid Tua Silalas dan kawasan pemakaman bersejarah.',
      imageUrl: 'assets/masjid-silalas.webp',
      altText: 'Masjid bersejarah di kawasan Silalas'
    }
  ].map((question, index) => ({
    ...question,
    timeLimitMs: 10_000,
    basePoints: 1000,
    position: index + 1
  }))
};

module.exports = { EASY_QUIZ };
