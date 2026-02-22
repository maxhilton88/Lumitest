import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'ms' | 'zh';

interface Translations {
  [key: string]: {
    en: string;
    ms: string;
    zh: string;
  };
}

const translations: Translations = {
  // ── Child / Assessment ──
  welcome: { en: 'Ready for Standard 1?', ms: 'Bersedia untuk Tahun 1?', zh: '准备好上一年级了吗？' },
  selectLanguage: { en: 'Select Language', ms: 'Pilih Bahasa', zh: '选择语言' },
  start: { en: "Let's Start!", ms: 'Mari Mula!', zh: '开始吧！' },
  greatJob: { en: 'Great job!', ms: 'Bagus sekali!', zh: '做得好！' },
  enterWhatsApp: { en: "Ask mommy to enter WhatsApp to see your KSSR report card!", ms: 'Minta ibu masukkan WhatsApp untuk lihat kad laporan KSSR anda!', zh: '请妈妈输入WhatsApp号码查看您的KSSR成绩单！' },
  childName: { en: "Child's Name", ms: 'Nama Anak', zh: '孩子姓名' },
  parentName: { en: "Parent's Name", ms: 'Nama Ibu Bapa', zh: '家长姓名' },
  whatsappNumber: { en: 'WhatsApp Number', ms: 'Nombor WhatsApp', zh: 'WhatsApp号码' },
  viewResults: { en: 'View Results', ms: 'Lihat Keputusan', zh: '查看结果' },
  shareOnSocial: { en: 'Share on Social Media', ms: 'Kongsi di Media Sosial', zh: '分享到社交媒体' },
  yourScore: { en: 'Your Score', ms: 'Skor Anda', zh: '你的分数' },
  nationalAverage: { en: 'National Average', ms: 'Purata Nasional', zh: '全国平均水平' },
  advanced: { en: 'Advanced', ms: 'Cemerlang', zh: '优秀' },
  ready: { en: 'Ready for School', ms: 'Bersedia ke Sekolah', zh: '准备好上学' },
  developing: { en: 'Developing', ms: 'Sedang Berkembang', zh: '发展中' },
  question: { en: 'Question', ms: 'Soalan', zh: '问题' },
  next: { en: 'Next', ms: 'Seterusnya', zh: '下一个' },
  english: { en: 'English', ms: 'Inggeris', zh: '英语' },
  malay: { en: 'Malay', ms: 'Bahasa Melayu', zh: '马来语' },
  chinese: { en: 'Chinese', ms: 'Cina', zh: '中文' },

  // ═══════════════════════════════════════════
  // PARENT SIDE — SideMenu
  // ═══════════════════════════════════════════
  'menu.game': { en: 'Game Dashboard', ms: 'Papan Pemuka Permainan', zh: '游戏面板' },
  'menu.game.sub': { en: 'Practice, Test, Watch & Listen', ms: 'Latihan, Ujian, Tonton & Dengar', zh: '练习、测试、观看和聆听' },
  'menu.mastery': { en: 'Mastery Dashboard', ms: 'Papan Pemuka Penguasaan', zh: '掌握度面板' },
  'menu.mastery.sub': { en: 'Performance & Analytics', ms: 'Prestasi & Analitik', zh: '表现与分析' },
  'menu.library': { en: 'Video Mode', ms: 'Mod Video', zh: '视频模式' },
  'menu.library.sub': { en: 'Watch & Learn', ms: 'Tonton & Belajar', zh: '观看和学习' },
  'menu.audio': { en: 'Foxy Music', ms: 'Muzik Foxy', zh: 'Foxy音乐' },
  'menu.audio.sub': { en: 'Lullabies & Songs', ms: 'Lagu Tidur & Lagu', zh: '摇篮曲和歌曲' },
  'menu.earnings': { en: 'Earnings Hub', ms: 'Pusat Pendapatan', zh: '收益中心' },
  'menu.earnings.sub': { en: 'Referrals & Credits', ms: 'Rujukan & Kredit', zh: '推荐与积分' },
  'menu.plan': { en: 'Plan & Billing', ms: 'Pelan & Bil', zh: '计划与账单' },
  'menu.plan.sub': { en: 'Subscription & Payments', ms: 'Langganan & Pembayaran', zh: '订阅与付款' },
  'menu.account': { en: 'Account', ms: 'Akaun', zh: '账户' },
  'menu.account.sub': { en: 'Profile & Settings', ms: 'Profil & Tetapan', zh: '个人资料与设置' },
  'menu.logout': { en: 'Leave the Realm', ms: 'Tinggalkan Alam', zh: '离开领域' },

  // ═══════════════════════════════════════════
  // Account Profile
  // ═══════════════════════════════════════════
  'account.title': { en: 'Account Settings', ms: 'Tetapan Akaun', zh: '账户设置' },
  'account.subtitle': { en: 'Manage your quest profile and preferences', ms: 'Urus profil pencarian dan pilihan anda', zh: '管理您的冒险资料和偏好' },
  'account.profileInfo': { en: 'Profile Info', ms: 'Maklumat Profil', zh: '个人信息' },
  'account.email': { en: 'Email', ms: 'E-mel', zh: '电子邮件' },
  'account.name': { en: 'Name', ms: 'Nama', zh: '姓名' },
  'account.childDetails': { en: 'Child Profile', ms: 'Profil Anak', zh: '孩子资料' },
  'account.childNameLabel': { en: "Child's Name", ms: 'Nama Anak', zh: '孩子姓名' },
  'account.childAgeLabel': { en: "Child's Age", ms: 'Umur Anak', zh: '孩子年龄' },
  'account.yearsOld': { en: 'years old', ms: 'tahun', zh: '岁' },
  'account.edit': { en: 'Edit', ms: 'Sunting', zh: '编辑' },
  'account.save': { en: 'Save', ms: 'Simpan', zh: '保存' },
  'account.cancel': { en: 'Cancel', ms: 'Batal', zh: '取消' },
  'account.saving': { en: 'Saving...', ms: 'Menyimpan...', zh: '保存中...' },
  'account.loginMethod': { en: 'Login Method', ms: 'Kaedah Log Masuk', zh: '登录方式' },
  'account.kindergarten': { en: 'Origin Kindergarten', ms: 'Tadika Asal', zh: '来源幼儿园' },
  'account.recruitedFrom': { en: 'Recruited from this kindergarten', ms: 'Direkrut dari tadika ini', zh: '从这所幼儿园招募' },
  'account.languagePref': { en: 'Language Preference', ms: 'Pilihan Bahasa', zh: '语言偏好' },
  'account.mandarinQuest': { en: 'Mandarin Quest', ms: 'Pencarian Mandarin', zh: '中文任务' },
  'account.mandarinDesc': { en: 'Include the Mandarin (中文) quest module in assessments. When enabled, your child will receive an additional Mandarin language quest.', ms: 'Sertakan modul pencarian Mandarin (中文) dalam penilaian. Apabila diaktifkan, anak anda akan menerima pencarian bahasa Mandarin tambahan.', zh: '在评估中包含中文任务模块。启用后，您的孩子将获得额外的中文语言任务。' },
  'account.bgMusic': { en: 'Background Music', ms: 'Muzik Latar', zh: '背景音乐' },
  'account.bgMusicDesc': { en: 'Play RPG adventure music while exploring the app. Music pauses automatically during video playback.', ms: 'Mainkan muzik pengembaraan RPG semasa meneroka aplikasi. Muzik berhenti secara automatik semasa video dimainkan.', zh: '在探索应用时播放RPG冒险音乐。播放视频时音乐自动暂停。' },
  'account.changePassword': { en: 'Change Password', ms: 'Tukar Kata Laluan', zh: '更改密码' },
  'account.changePasswordDesc': { en: 'Update your account password. You\'ll stay signed in after changing it.', ms: 'Kemas kini kata laluan akaun anda. Anda akan kekal log masuk selepas menukarnya.', zh: '更新您的账户密码。更改后您将保持登录状态。' },
  'account.newPassword': { en: 'New Password', ms: 'Kata Laluan Baharu', zh: '新密码' },
  'account.confirmPassword': { en: 'Confirm Password', ms: 'Sahkan Kata Laluan', zh: '确认密码' },
  'account.updatePassword': { en: 'Update Password', ms: 'Kemas Kini Kata Laluan', zh: '更新密码' },
  'account.updating': { en: 'Updating...', ms: 'Mengemas kini...', zh: '更新中...' },
  'account.deleteAccount': { en: 'Delete Account', ms: 'Padam Akaun', zh: '删除账户' },
  'account.deleteDesc': { en: 'Permanently delete your account and all data. This cannot be undone.', ms: 'Padam akaun dan semua data secara kekal. Ini tidak boleh dibuat asal.', zh: '永久删除您的账户和所有数据。此操作不可撤消。' },
  'account.deleteConfirm': { en: 'I understand, delete my account', ms: 'Saya faham, padam akaun saya', zh: '我了解，删除我的账户' },
  'account.deleting': { en: 'Deleting...', ms: 'Memadam...', zh: '删除中...' },
  'account.provider.email': { en: 'Email & Password', ms: 'E-mel & Kata Laluan', zh: '电子邮件和密码' },
  'account.provider.google': { en: 'Google Account', ms: 'Akaun Google', zh: 'Google 账户' },
  'account.provider.facebook': { en: 'Facebook Account', ms: 'Akaun Facebook', zh: 'Facebook 账户' },
  'account.multiChild': { en: 'Multiple child profiles coming soon', ms: 'Profil pelbagai anak akan datang', zh: '多个孩子档案即将' },
  'account.notifications': { en: 'Notifications', ms: 'Pemberitahuan', zh: '通知' },
  'account.notificationsDesc': { en: 'Notification preferences coming soon.', ms: 'Pilihan pemberitahuan akan datang.', zh: '通知偏好设置即将推出。' },

  // ═══════════════════════════════════════════
  // Game Dashboard
  // ═══════════════════════════════════════════
  'game.title': { en: 'Game Dashboard', ms: 'Papan Pemuka Permainan', zh: '游戏面板' },
  'game.subtitle': { en: 'Choose your adventure mode', ms: 'Pilih mod pengembaraan anda', zh: '选择您的冒险模式' },
  'game.training': { en: 'Training', ms: 'Latihan', zh: '训练' },
  'game.practiceMode': { en: 'Practice Mode', ms: 'Mod Latihan', zh: '练习模式' },
  'game.practiceDesc': { en: 'Unlimited practice with reshuffled questions. No scoring — just learning!', ms: 'Latihan tanpa had dengan soalan dikocok semula. Tiada pemarkahan — hanya belajar!', zh: '无限练习，题目随机打乱。无评分——专注学习！' },
  'game.startPractice': { en: 'Start Practice', ms: 'Mula Latihan', zh: '开始练习' },
  'game.quest': { en: 'Quest', ms: 'Pencarian', zh: '任务' },
  'game.assessmentMode': { en: 'Assessment Mode', ms: 'Mod Penilaian', zh: '评估模式' },
  'game.assessmentDesc': { en: 'Official KSSR adaptive assessment. Get detailed progress reports.', ms: 'Penilaian adaptif KSSR rasmi. Dapatkan laporan kemajuan terperinci.', zh: '官方KSSR自适应评估。获取详细的进度报告。' },
  'game.startAssessment': { en: 'Start Assessment', ms: 'Mula Penilaian', zh: '开始评估' },
  'game.library': { en: 'Library', ms: 'Perpustakaan', zh: '图书馆' },
  'game.videoMode': { en: 'Video Mode', ms: 'Mod Video', zh: '视频模式' },
  'game.videoDesc': { en: 'Educational videos featuring Foxy and friends. Learn through stories!', ms: 'Video pendidikan dengan Foxy dan rakan-rakan. Belajar melalui cerita!', zh: '以Foxy和朋友们为主角的教育视频。通过故事学习！' },
  'game.browseVideos': { en: 'Browse Videos', ms: 'Layari Video', zh: '浏览视频' },
  'game.audioMode': { en: 'Audio Mode', ms: 'Mod Audio', zh: '音频模式' },
  'game.foxyMusic': { en: 'Foxy Music', ms: 'Muzik Foxy', zh: 'Foxy音乐' },
  'game.audioDesc': { en: 'Lullabies, nursery rhymes & enchanted melodies for bedtime and beyond.', ms: 'Lagu tidur, lagu kanak-kanak & melodi ajaib untuk waktu tidur dan seterusnya.', zh: '摇篮曲、童谣和魔法旋律，适合睡前和日常。' },
  'game.browseMusic': { en: 'Browse Music', ms: 'Layari Muzik', zh: '浏览音乐' },
  'game.upgradeToContine': { en: 'Upgrade to Continue', ms: 'Naik Taraf untuk Teruskan', zh: '升级以继续' },
  'game.unlimited': { en: 'Unlimited', ms: 'Tanpa Had', zh: '无限' },
  'game.today': { en: 'today', ms: 'hari ini', zh: '今天' },
  'game.freeBrowse': { en: 'Free to browse', ms: 'Percuma untuk melayari', zh: '免费浏览' },
  'game.viewResults': { en: 'View Results', ms: 'Lihat Keputusan', zh: '查看结果' },
  'game.lastSession': { en: 'Last session:', ms: 'Sesi terakhir:', zh: '上次活动：' },

  // ═══════════════════════════════════════════
  // Mastery Dashboard
  // ═══════════════════════════════════════════
  'mastery.title': { en: 'Mastery Dashboard', ms: 'Papan Pemuka Penguasaan', zh: '掌握度面板' },
  'mastery.subtitle': { en: "'s KSSR Readiness Overview", ms: ' — Tinjauan Kesediaan KSSR', zh: '的KSSR准备度概览' },
  'mastery.age': { en: 'Age', ms: 'Umur', zh: '年龄' },
  'mastery.readinessRadar': { en: 'Readiness Radar', ms: 'Radar Kesediaan', zh: '准备度雷达' },
  'mastery.radarDesc': { en: 'Each axis = one subject', ms: 'Setiap paksi = satu subjek', zh: '每个轴 = 一个科目' },
  'mastery.radarRings': { en: 'Rings = Age 4 → 7', ms: 'Bulatan = Umur 4 → 7', zh: '环 = 4岁 → 7岁' },
  'mastery.shadedArea': { en: "Shaded area = functional level", ms: 'Kawasan berlorek = tahap fungsional', zh: '阴影区域 = 功能水平' },
  'mastery.functionalAge': { en: 'Functional Age Per Subject', ms: 'Umur Fungsional Setiap Subjek', zh: '每科功能年龄' },
  'mastery.overall': { en: 'overall', ms: 'keseluruhan', zh: '总体' },
  'mastery.ahead': { en: 'ahead', ms: 'ke hadapan', zh: '领先' },
  'mastery.behind': { en: 'behind', ms: 'ke belakang', zh: '落后' },
  'mastery.onTrack': { en: 'On track', ms: 'Pada landasan', zh: '正常' },
  'mastery.proficiency': { en: 'Proficiency Level (TP)', ms: 'Tahap Penguasaan (TP)', zh: '掌握水平 (TP)' },
  'mastery.proficiencyDesc': { en: 'Tahap Penguasaan — from Age 7 questions only', ms: 'Tahap Penguasaan — daripada soalan Umur 7 sahaja', zh: 'Tahap Penguasaan — 仅来自7岁题目' },
  'mastery.overallScore': { en: 'Overall Score', ms: 'Skor Keseluruhan', zh: '总分' },
  'mastery.totalStars': { en: 'Total Stars', ms: 'Jumlah Bintang', zh: '总星数' },
  'mastery.heroRank': { en: 'Hero Rank', ms: 'Pangkat Wira', zh: '英雄等级' },
  'mastery.readiness': { en: 'Readiness', ms: 'Kesediaan', zh: '准备度' },
  'mastery.readyForStd1': { en: 'Ready for Standard 1', ms: 'Bersedia untuk Tahun 1', zh: '准备好上一年级' },
  'mastery.needsSupport': { en: 'Needs some support', ms: 'Memerlukan sedikit sokongan', zh: '需要一些支��' },
  'mastery.timeline': { en: 'Adventure Timeline', ms: 'Garis Masa Pengembaraan', zh: '冒险时间线' },
  'mastery.timelineSub': { en: 'Your quest journey calendar', ms: 'Kalendar perjalanan pencarian anda', zh: '您的冒险旅程日历' },
  'mastery.streak': { en: '-day streak!', ms: ' hari berturut-turut!', zh: '天连续！' },
  'mastery.less': { en: 'Less', ms: 'Kurang', zh: '少' },
  'mastery.more': { en: 'More', ms: 'Lebih', zh: '多' },
  'mastery.noActivity': { en: 'No activity', ms: 'Tiada aktiviti', zh: '无活动' },
  'mastery.quests': { en: 'Quests', ms: 'Pencarian', zh: '任务' },
  'mastery.videos': { en: 'Videos', ms: 'Video', zh: '视频' },
  'mastery.training': { en: 'Training', ms: 'Latihan', zh: '训练' },
  'mastery.calendarToday': { en: 'Today', ms: 'Hari Ini', zh: '今天' },
  'mastery.calendarRestDay': { en: 'A quiet day in the realm. No adventures recorded.', ms: 'Hari yang tenang di alam. Tiada pengembaraan direkodkan.', zh: '王国中平静的一天。没有冒险记录。' },
  'mastery.calendarTotal': { en: 'Total Adventures', ms: 'Jumlah Pengembaraan', zh: '总冒险次数' },
  'mastery.calendarClose': { en: 'Close', ms: 'Tutup', zh: '关闭' },
  'mastery.calendarAdventures': { en: 'adventures', ms: 'pengembaraan', zh: '次冒险' },
  'mastery.calendarQuestions': { en: 'Questions Tackled', ms: 'Soalan Dijawab', zh: '已解答题目' },
  'mastery.calendarCorrect': { en: 'Correct', ms: 'Betul', zh: '正确' },
  'mastery.calendarWrong': { en: 'Wrong', ms: 'Salah', zh: '错误' },
  'mastery.subjectMastery': { en: 'Quest Mastery', ms: 'Penguasaan Pencarian', zh: '任务掌握度' },
  'mastery.subjectMasterySub': { en: 'Per-subject breakdown cards', ms: 'Kad pecahan setiap subjek', zh: '各科目分解卡' },
  'mastery.subjectComparison': { en: 'Subject Comparison', ms: 'Perbandingan Subjek', zh: '科目比较' },
  'mastery.subjectComparisonSub': { en: 'Score percentage per quest realm', ms: 'Peratusan skor setiap alam pencarian', zh: '每个任务领域的得分百分比' },
  'mastery.ageLevelSplit': { en: 'Age Level Split', ms: 'Pecahan Tahap Umur', zh: '年龄水平分布' },
  'mastery.ageLevelSplitSub': { en: 'Questions by difficulty tier', ms: 'Soalan mengikut tahap kesukaran', zh: '按难度等级划分的题目' },
  'mastery.accuracyByAge': { en: 'Accuracy by Age Level', ms: 'Ketepatan mengikut Tahap Umur', zh: '按年龄水平的准确率' },
  'mastery.accuracyByAgeSub': { en: 'Performance across difficulty tiers per subject', ms: 'Prestasi merentasi tahap kesukaran setiap subjek', zh: '每科目不同难度等级的表现' },
  'mastery.progressOverTime': { en: 'Progress Over Time', ms: 'Kemajuan Sepanjang Masa', zh: '随时间的进展' },
  'mastery.progressOverTimeSub': { en: "Your hero's growth across assessments", ms: 'Pertumbuhan wira anda merentasi penilaian', zh: '您的英雄在各次评估中的成长' },
  'mastery.recommendations': { en: 'Recommendations', ms: 'Cadangan', zh: '建议' },
  'mastery.recommendationsSub': { en: 'Personalized suggestions', ms: 'Cadangan peribadi', zh: '个性化建议' },
  'mastery.stats': { en: 'Adventure Stats', ms: 'Statistik Pengembaraan', zh: '冒险统计' },
  'mastery.statsSub': { en: 'Lifetime activity summary', ms: 'Ringkasan aktiviti sepanjang masa', zh: '终身活动摘要' },
  'mastery.totalQuests': { en: 'Total Quests', ms: 'Jumlah Pencarian', zh: '总任务数' },
  'mastery.totalVideos': { en: 'Videos Watched', ms: 'Video Ditonton', zh: '已观看视频' },
  'mastery.totalTraining': { en: 'Training Sessions', ms: 'Sesi Latihan', zh: '训练次数' },
  'mastery.questionsAnswered': { en: 'Practice Qs Answered', ms: 'Soalan Latihan Dijawab', zh: '已答练习题' },
  'mastery.todayActivity': { en: "Today's Activity", ms: 'Aktiviti Hari Ini', zh: '今日活动' },
  'mastery.excellent': { en: 'Excellent', ms: 'Cemerlang', zh: '优秀' },
  'mastery.good': { en: 'Good', ms: 'Baik', zh: '良好' },
  'mastery.needsPractice': { en: 'Needs Practice', ms: 'Perlu Latihan', zh: '需要练习' },
  'mastery.unlockSection': { en: 'Complete a quest to unlock this section', ms: 'Selesaikan pencarian untuk membuka kunci bahagian ini', zh: '完成任务以解锁此部分' },

  // ═══════════════════════════════════════════
  // Earnings Hub
  // ═══════════════════════════════════════════
  'earnings.title': { en: 'Earnings Hub', ms: 'Pusat Pendapatan', zh: '收益中心' },
  'earnings.subtitle': { en: 'Referrals & Credits', ms: 'Rujukan & Kredit', zh: '推荐与积分' },
  'earnings.balance': { en: 'Your Treasure Balance', ms: 'Baki Harta Karun Anda', zh: '您的宝藏余额' },
  'earnings.creditsOffset': { en: 'Credits offset your subscription cost', ms: 'Kredit mengurangkan kos langganan anda', zh: '积分可抵扣订阅费用' },
  'earnings.howItWorks': { en: 'How It Works', ms: 'Cara Ia Berfungsi', zh: '如何运作' },
  'earnings.step1': { en: 'Share', ms: 'Kongsi', zh: '分享' },
  'earnings.step1Desc': { en: 'Send your link to friends', ms: 'Hantar pautan anda kepada rakan', zh: '将链接发送给朋友' },
  'earnings.step2': { en: 'They Subscribe', ms: 'Mereka Melanggan', zh: '他们订阅' },
  'earnings.step2Desc': { en: 'Friend signs up for a plan', ms: 'Rakan mendaftar untuk pelan', zh: '朋友注册计划' },
  'earnings.step3': { en: 'You Earn', ms: 'Anda Dapat', zh: '您获得' },
  'earnings.step3Desc': { en: 'RM36.50 per paid referral', ms: 'RM36.50 setiap rujukan berbayar', zh: '每次付费推荐RM36.50' },
  'earnings.oneLevel': { en: '1 level deep', ms: '1 peringkat', zh: '1级深度' },
  'earnings.yourLink': { en: 'Your Referral Link', ms: 'Pautan Rujukan Anda', zh: '您的推荐链接' },
  'earnings.generating': { en: 'Generating...', ms: 'Menjana...', zh: '生成中...' },
  'earnings.loading': { en: 'Loading...', ms: 'Memuatkan...', zh: '加载中...' },
  'earnings.shareWhatsApp': { en: 'Share via WhatsApp', ms: 'Kongsi melalui WhatsApp', zh: '通过WhatsApp分享' },
  'earnings.recruited': { en: 'Recruited Adventurers', ms: 'Pengembaraan Direkrut', zh: '已招募的冒险者' },
  'earnings.total': { en: 'total', ms: 'jumlah', zh: '总计' },
  'earnings.credited': { en: 'Credited', ms: 'Dikreditkan', zh: '已入账' },
  'earnings.pending': { en: 'Pending', ms: 'Belum Selesai', zh: '待处理' },
  'earnings.emptyTitle': { en: 'Your treasure hall awaits its first gold coin.', ms: 'Dewan harta anda menunggu syiling emas pertama.', zh: '您的宝库等待着第一枚金币。' },
  'earnings.emptyDesc': { en: 'Share your link above to start earning!', ms: 'Kongsi pautan anda di atas untuk mula menjana!', zh: '分享上面的链接开始赚取！' },
  'earnings.recentlyJoined': { en: 'Recently joined', ms: 'Baru menyertai', zh: '最近加入' },
  'earnings.adventurer': { en: 'Adventurer', ms: 'Pengembaraan', zh: '冒险者' },

  // Graphic sharing (parent)
  'earnings.graphicsTitle': { en: 'Share Graphics', ms: 'Kongsi Grafik', zh: '分享图片' },
  'earnings.graphicsSubtitle': { en: 'Pick a design and share with your referral link attached.', ms: 'Pilih reka bentuk dan kongsi dengan pautan rujukan anda.', zh: '选择设计并附上您的推荐链接分享。' },
  'earnings.filterAll': { en: 'All', ms: 'Semua', zh: '全部' },
  'earnings.loadingArtwork': { en: 'Loading designs...', ms: 'Memuatkan reka bentuk...', zh: '加载设计中...' },
  'earnings.noArtwork': { en: 'No designs available yet', ms: 'Tiada reka bentuk lagi', zh: '暂无可用设计' },
  'earnings.noArtworkDesc': { en: 'Promotional graphics will appear here soon.', ms: 'Grafik promosi akan muncul di sini tidak lama lagi.', zh: '宣传图片即将在此显示。' },
  'earnings.noArtworkPlatform': { en: 'No designs for this platform', ms: 'Tiada reka bentuk untuk platform ini', zh: '此平台暂无设计' },
  'earnings.noArtworkPlatformDesc': { en: 'Try selecting a different platform or "All".', ms: 'Cuba pilih platform lain atau "Semua".', zh: '请尝试选择其他平台或"全部"。' },
  'earnings.shareWithLink': { en: 'Share with my Link', ms: 'Kongsi dengan Pautan Saya', zh: '用我的链接分享' },
  'earnings.viewImage': { en: 'View full image', ms: 'Lihat imej penuh', zh: '查看完整图片' },
  'earnings.graphicShareText': { en: 'My child loves Foxy Adventure — a fun KSSR readiness game for ages 4-7. Try it free!', ms: 'Anak saya suka Foxy Adventure — permainan kesediaan KSSR yang menyeronokkan untuk umur 4-7. Cuba percuma!', zh: '我的孩子喜欢Foxy Adventure——一款有趣的4-7岁KSSR准备游戏。免费试用！' },
  'earnings.igCopied': { en: 'Link copied! Save the image and share on Instagram.', ms: 'Pautan disalin! Simpan imej dan kongsi di Instagram.', zh: '链接已复制！保存图片并在Instagram上分享。' },
  'earnings.igManual': { en: 'Save the image, then paste your link in your Instagram caption.', ms: 'Simpan imej, kemudian tampal pautan anda dalam kapsyen Instagram.', zh: '保存图片，然后将链接粘贴到Instagram说明中。' },
  'earnings.imgUnavailable': { en: 'Image not available. Please try again later.', ms: 'Imej tidak tersedia. Sila cuba lagi kemudian.', zh: '图片不可用，请稍后再试。' },

  // ═══════════════════════════════════════════
  // Plan & Billing
  // ═══════════════════════════════════════════
  'plan.title': { en: 'Plan & Billing', ms: 'Pelan & Bil', zh: '计划与账单' },
  'plan.subtitle': { en: 'Subscription & Payments', ms: 'Langganan & Pembayaran', zh: '订阅与付款' },
  'plan.currentPlan': { en: 'Current Plan', ms: 'Pelan Semasa', zh: '当前计划' },
  'plan.freeTier': { en: 'Free Tier', ms: 'Peringkat Percuma', zh: '免费版' },
  'plan.active': { en: 'Active', ms: 'Aktif', zh: '有效' },
  'plan.current': { en: 'CURRENT', ms: 'SEMASA', zh: '当前' },
  'plan.currentPlanBtn': { en: 'Current Plan', ms: 'Pelan Semasa', zh: '当前计划' },
  'plan.subscribeNow': { en: 'Subscribe Now', ms: 'Langgan Sekarang', zh: '立即订阅' },
  'plan.switchPlan': { en: 'Switch Plan', ms: 'Tukar Pelan', zh: '切换计划' },
  'plan.openingStripe': { en: 'Opening Stripe...', ms: 'Membuka Stripe...', zh: '正在打开Stripe...' },
  'plan.billingHistory': { en: 'Billing History', ms: 'Sejarah Bil', zh: '账单历史' },
  'plan.noBilling': { en: 'No billing history yet.', ms: 'Tiada sejarah bil lagi.', zh: '暂无账单历史。' },
  'plan.billingNote': { en: 'Your payment records will appear here after subscribing.', ms: 'Rekod pembayaran anda akan dipaparkan di sini selepas melanggan.', zh: '订阅后您的付款记录将显示在此处。' },
  'plan.manage': { en: 'Manage Subscription', ms: 'Urus Langganan', zh: '管理订阅' },
  'plan.manageDesc': { en: 'Update payment method, view invoices, or cancel', ms: 'Kemas kini kaedah pembayaran, lihat invois, atau batal', zh: '更新付款方式、查看发票或取消' },
  'plan.opening': { en: 'Opening...', ms: 'Membuka...', zh: '正在打开...' },
  'plan.verifying': { en: 'Verifying your payment with Stripe...', ms: 'Mengesahkan pembayaran anda dengan Stripe...', zh: '正在与Stripe验证您的付款...' },
  'plan.paymentSuccess': { en: 'Payment Successful!', ms: 'Pembayaran Berjaya!', zh: '付款成功！' },
  'plan.subscriptionActive': { en: 'Your subscription is now active. Enjoy unlimited access!', ms: 'Langganan anda kini aktif. Nikmati akses tanpa had!', zh: '您的订阅现已生效。享受无限访问！' },
  'plan.checkoutCancelled': { en: 'Checkout Cancelled', ms: 'Pembayaran Dibatalkan', zh: '结账已取消' },
  'plan.noCharge': { en: 'No charge was made. You can try again anytime.', ms: 'Tiada caj dikenakan. Anda boleh cuba lagi bila-bila masa.', zh: '未收取任何费用。您可以随时再试。' },
  'plan.referralCredits': { en: 'in referral credits to offset your subscription.', ms: 'dalam kredit rujukan untuk mengurangkan langganan anda.', zh: '推荐积分可抵扣您的订阅费用。' },
  'plan.creditsAvailable': { en: 'Referral Credits Available', ms: 'Kredit Rujukan Tersedia', zh: '可用推荐积分' },
  'plan.creditsCanOffset': { en: 'Use these credits to offset your next subscription payment.', ms: 'Gunakan kredit ini untuk mengurangkan bayaran langganan seterusnya.', zh: '使用这些积分抵扣您的下一次订阅付款。' },
  'plan.getFreeTitle': { en: 'Get Yours For Free!', ms: 'Dapatkan Secara Percuma!', zh: '免费获取！' },
  'plan.getFreeDesc': { en: 'Refer friends to Foxy Adventure and earn RM36.50 per paid signup. Just 10 referrals and your annual subscription is fully covered!', ms: 'Rujuk rakan ke Foxy Adventure dan dapatkan RM36.50 setiap pendaftaran berbayar. Hanya 10 rujukan dan langganan tahunan anda ditanggung sepenuhnya!', zh: '推荐朋友使用Foxy Adventure，每次付费注册可获得RM36.50。只需10次推荐，您的年度订阅费用就全部覆盖！' },
  'plan.startReferring': { en: 'Start Referring Friends', ms: 'Mula Rujuk Rakan', zh: '开始推荐朋友' },
  'plan.referMore': { en: 'Refer More & Earn More', ms: 'Rujuk Lagi & Dapat Lagi', zh: '推荐更多，赚取更多' },
  'plan.planA': { en: 'Plan A', ms: 'Pelan A', zh: 'A计划' },
  'plan.planB': { en: 'Plan B', ms: 'Pelan B', zh: 'B计划' },
  'plan.digital': { en: 'DIGITAL', ms: 'DIGITAL', zh: '数字版' },
  'plan.bestValue': { en: 'BEST VALUE', ms: 'NILAI TERBAIK', zh: '最佳价值' },
  'plan.planASubtitle': { en: 'Foxy Adventure Game', ms: 'Permainan Pengembaraan Foxy', zh: 'Foxy冒险游戏' },
  'plan.planBSubtitle': { en: 'Game + Foxy AI Toy', ms: 'Permainan + Mainan AI Foxy', zh: '游戏 + Foxy AI玩具' },
  'plan.perYear': { en: '/year', ms: '/tahun', zh: '/年' },
  'plan.perFirstYear': { en: '/first year', ms: '/tahun pertama', zh: '/第一年' },
  'plan.thenRenewal': { en: 'then RM365/year renewal', ms: 'kemudian RM365/tahun pembaharuan', zh: '之后RM365/年续费' },
  'plan.featureUnlimitedTests': { en: 'Unlimited daily tests', ms: 'Ujian harian tanpa had', zh: '每日无限测试' },
  'plan.featureUnlimitedVideo': { en: 'Unlimited video access', ms: 'Akses video tanpa had', zh: '无限视频访问' },
  'plan.featureTracking': { en: 'Full progress tracking', ms: 'Penjejakan kemajuan penuh', zh: '完整进度跟踪' },
  'plan.featurePractice': { en: 'All practice modes', ms: 'Semua mod latihan', zh: '所有练习模式' },
  'plan.featureSupport': { en: 'Priority support', ms: 'Sokongan keutamaan', zh: '优先支持' },
  'plan.featureEverything': { en: 'Everything in Plan A', ms: 'Semua dalam Pelan A', zh: 'A计划的所有内容' },
  'plan.featureToy': { en: 'Foxy AI Companion Toy', ms: 'Mainan Teman AI Foxy', zh: 'Foxy AI伴侣玩具' },
  'plan.featureShipped': { en: 'Physical toy shipped to you', ms: 'Mainan fizikal dihantar kepada anda', zh: '实体玩具送货上门' },
  'plan.featureVoice': { en: 'Interactive voice learning', ms: 'Pembelajaran suara interaktif', zh: '互动语音学习' },
  'plan.featureExclusive': { en: 'Exclusive toy-only content', ms: 'Kandungan eksklusif mainan sahaja', zh: '玩具独享内容' },
  'plan.comingSoon': { en: 'Coming Soon', ms: 'Akan Datang', zh: '即将推出' },
  'plan.limitedIntro': { en: 'Limited Intro Offer', ms: 'Tawaran Intro Terhad', zh: '限时首发优惠' },
  'plan.earlyAdopter': { en: 'For early adopters only — reverts to full price after first batch.', ms: 'Untuk pengguna awal sahaja — kembali ke harga penuh selepas kumpulan pertama.', zh: '仅限首批尝鲜用户 — 名额满后恢复原价。' },
  'plan.perDay': { en: 'Only RM1/day', ms: 'Hanya RM1/hari', zh: '每天仅RM1' },
  'plan.foxyTitle': { en: 'Bring Home FOXY-o1', ms: 'Bawa Pulang FOXY-o1', zh: '把FOXY-o1带回家' },
  'plan.foxySubtitle': { en: "Your child's 24/7 AI Teacher", ms: 'Guru AI 24/7 anak anda', zh: '孩子的24/7 AI老师' },
  'plan.foxyDesc': { en: "A pocket-sized AI companion that explains concepts, answers questions, and adapts to your child's learning level — anytime, anywhere.", ms: 'Teman AI bersaiz poket yang menerangkan konsep, menjawab soalan, dan menyesuaikan diri dengan tahap pembelajaran anak anda — bila-bila masa, di mana sahaja.', zh: '口袋大小的AI伙伴，解释概念、回答问题，并适应您孩子的学习水平 — 随时随地。' },
  'plan.foxyBundle': { en: '1 Year Foxy Adventure + FOXY-o1 Toy', ms: '1 Tahun Foxy Adventure + Mainan FOXY-o1', zh: '1年Foxy Adventure + FOXY-o1玩具' },
  'plan.foxyCta': { en: 'Get FOXY-o1 Bundle', ms: 'Dapatkan Bundle FOXY-o1', zh: '获取FOXY-o1套装' },
  'plan.foxyOpening': { en: 'Opening checkout...', ms: 'Membuka pembayaran...', zh: '正在打开结账...' },

  // ═══════════════════════════════════════════
  // Video Library
  // ═══════════════════════════════════════════
  'video.title': { en: 'Video Mode', ms: 'Mod Video', zh: '视频模式' },
  'video.episodes': { en: 'episodes', ms: 'episod', zh: '集' },
  'video.watchNow': { en: 'Watch Now', ms: 'Tonton Sekarang', zh: '立即观看' },
  'video.premium': { en: 'Premium', ms: 'Premium', zh: '高级' },
  'video.premiumContent': { en: 'Premium Content', ms: 'Kandungan Premium', zh: '高级内容' },
  'video.upgradeToUnlock': { en: 'Upgrade to unlock', ms: 'Naik taraf untuk membuka kunci', zh: '升级以解锁' },
  'video.andAllPremium': { en: 'and all premium adventures.', ms: 'dan semua pengembaraan premium.', zh: '和所有高级冒险。' },
  'video.upgradeNow': { en: 'Upgrade Now', ms: 'Naik Taraf Sekarang', zh: '立即升级' },
  'video.comingSoon': { en: 'Coming soon — Foxy is still filming!', ms: 'Akan datang — Foxy masih merakam!', zh: '即将推出——Foxy还在拍摄！' },
  'video.new': { en: 'New', ms: 'Baharu', zh: '新' },
  'video.featured': { en: 'Featured', ms: 'Pilihan', zh: '精选' },
  'video.all': { en: 'All', ms: 'Semua', zh: '全部' },
  'video.enchantedEpisodes': { en: 'enchanted episodes across', ms: 'episod ajaib merentasi', zh: '个魔法集分布于' },
  'video.realms': { en: 'realms', ms: 'alam', zh: '个领域' },
  'video.free': { en: 'free', ms: 'percuma', zh: '免费' },
  'video.episode': { en: 'Episode', ms: 'Episod', zh: '第集' },

  // ══════════════════════════════════════════
  // Audio Library (Foxy Music)
  // ═══════════════════════════════════════════
  'audio.title': { en: 'Foxy Music', ms: 'Muzik Foxy', zh: 'Foxy音乐' },
  'audio.subtitle': { en: 'Enchanted melodies for young adventurers', ms: 'Melodi ajaib untuk pengembaraan muda', zh: '为小冒险家准备的魔法旋律' },
  'audio.allTracks': { en: 'All Tracks', ms: 'Semua Lagu', zh: '所有曲目' },
  'audio.favorites': { en: 'Favorites', ms: 'Kegemaran', zh: '收藏' },
  'audio.nowPlaying': { en: 'Now Playing', ms: 'Sedang Dimainkan', zh: '正在播放' },
  'audio.upNext': { en: 'Up Next', ms: 'Seterusnya', zh: '下一首' },
  'audio.sleepTimer': { en: 'Lullaby Timer', ms: 'Pemasa Lagu Tidur', zh: '摇篮曲定时器' },
  'audio.timerOff': { en: 'Off', ms: 'Mati', zh: '关闭' },
  'audio.timerMinutes': { en: 'minutes', ms: 'minit', zh: '分钟' },
  'audio.timerActive': { en: 'Timer active', ms: 'Pemasa aktif', zh: '定时器已启动' },
  'audio.goodnight': { en: 'Goodnight, little adventurer', ms: 'Selamat malam, pengembaraan kecil', zh: '晚安，小冒险家' },
  'audio.shuffle': { en: 'Shuffle', ms: 'Kocok', zh: '随机播放' },
  'audio.repeatOff': { en: 'Repeat Off', ms: 'Ulang Mati', zh: '关闭重复' },
  'audio.repeatAll': { en: 'Repeat All', ms: 'Ulang Semua', zh: '全部重复' },
  'audio.repeatOne': { en: 'Repeat One', ms: 'Ulang Satu', zh: '单曲循环' },
  'audio.noTracks': { en: 'No tracks yet — the bard is still composing!', ms: 'Tiada lagu lagi — penyanyi masih mengarang!', zh: '暂无曲目——吟游诗人还在创作！' },
  'audio.premium': { en: 'Premium', ms: 'Premium', zh: '高级' },
  'audio.free': { en: 'Free', ms: 'Percuma', zh: '免费' },

  // ═══════════════════════════════════════════
  // Common
  // ═══════════════════════════════════════════
  'common.loading': { en: 'Loading...', ms: 'Memuatkan...', zh: '加载中...' },
  'common.error': { en: 'Something went wrong', ms: 'Sesuatu tidak kena', zh: '出了点问题' },
  'common.back': { en: 'Back', ms: 'Kembali', zh: '返回' },
  'common.youHave': { en: 'You have', ms: 'Anda mempunyai', zh: '您有' },

  // ══════════════════════════════════════════
  // PWA Install Banner
  // ═══════════════════════════════════════════
  'pwa.title': { en: 'Install Foxy Adventure', ms: 'Pasang Foxy Adventure', zh: '安装 Foxy Adventure' },
  'pwa.iosStep1': { en: 'Tap the', ms: 'Tekan ikon', zh: '点击' },
  'pwa.share': { en: 'Share', ms: 'Kongsi', zh: '分享' },
  'pwa.iosStep2': { en: 'icon, then tap', ms: 'kemudian tekan', zh: '图标，然后点击' },
  'pwa.addToHome': { en: 'Add to Home Screen', ms: 'Tambah ke Skrin Utama', zh: '添加到主屏幕' },
  'pwa.iosStep3': { en: 'to play in full screen.', ms: 'untuk bermain skrin penuh.', zh: '即可全屏游玩。' },
  'pwa.androidDesc': { en: 'Install for a full-screen RPG experience with faster loading.', ms: 'Pasang untuk pengalaman RPG skrin penuh dan muatan lebih pantas.', zh: '安装以获得全屏RPG体验和更快的加载速度。' },
  'pwa.install': { en: 'Install', ms: 'Pasang', zh: '安装' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};