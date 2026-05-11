import React, { useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { FantasyPanel, GoldOrnament } from './FantasyBackground';
import { ExternalLink, Gift, Mic, MonitorOff, BarChart3 } from 'lucide-react';
import foxyToyImage from 'figma:asset/b61978b8324fd7cbb0fe6f55a1541b1f1e24ee8a.png';

interface FoxyToySectionProps {
  childName: string;
  weakSubjects: string[];
  questionsAnswered: number;
  /** ID for html2canvas to capture in PDF */
  id?: string;
}

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PURCHASE_URL = 'https://projectlumi.org/store';

/**
 * "Bring Foxy Home" section — the sales close for the Foxy AI Companion Toy.
 * Designed to sit at the bottom of the scrollable report, naturally reached by scrolling.
 */
export const FoxyToySection: React.FC<FoxyToySectionProps> = ({
  childName,
  weakSubjects,
  questionsAnswered,
  id,
}) => {
  const { language } = useLanguage();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const lang = language as 'en' | 'ms' | 'zh';

  // Generate QR code on mount
  useEffect(() => {
    const generateQR = async () => {
      try {
        const QRCodeModule = await import('qrcode');
        const QRCode = QRCodeModule.default || QRCodeModule;
        if (qrCanvasRef.current && QRCode.toCanvas) {
          await QRCode.toCanvas(qrCanvasRef.current, PURCHASE_URL, {
            width: 120,
            margin: 1,
            color: {
              dark: '#2a1f0e',
              light: '#ffeaa7',
            },
          });
        }
      } catch (err) {
        console.error('QR code generation failed:', err);
      }
    };
    generateQR();
  }, []);

  const gapText = weakSubjects.length > 0
    ? weakSubjects.join(lang === 'zh' ? '和' : lang === 'ms' ? ' dan ' : ' and ')
    : '';

  const content = {
    title: {
      en: 'Bring Foxy Home',
      ms: 'Bawa Foxy Pulang',
      zh: '把Foxy带回家',
    },
    intro: {
      en: `${childName} already spent the whole adventure with Foxy today, answering ${questionsAnswered} questions together. Now Foxy can come home and help every day.`,
      ms: `${childName} telah menghabiskan seluruh pengembaraan bersama Foxy hari ini, menjawab ${questionsAnswered} soalan bersama. Kini Foxy boleh pulang dan membantu setiap hari.`,
      zh: `${childName}今天与Foxy一起完成了整个冒险，共回答了${questionsAnswered}个问题。现在Foxy可以回家每天帮助学习。`,
    },
    gapBridge: gapText
      ? {
          en: `The assessment showed ${childName} needs extra practice in ${gapText}. Foxy speaks to your child at their level, answers their questions, and guides them through daily learning moments — like a patient tutor that never gets tired.`,
          ms: `Penilaian menunjukkan ${childName} memerlukan latihan tambahan dalam ${gapText}. Foxy bercakap dengan anak anda pada tahap mereka, menjawab soalan mereka, dan membimbing mereka melalui sesi pembelajaran harian — seperti tutor sabar yang tidak pernah penat.`,
          zh: `评估显示${childName}需要在${gapText}方面进行额外练习。Foxy会以您孩子的水平与他们交谈，回答他们的问题，并指导他们的日常学习——像一个永不疲倦的耐心导师。`,
        }
      : null,
    features: [
      {
        lucideIcon: 'mic' as const,
        label: {
          en: 'Speaks & Listens',
          ms: 'Bercakap & Mendengar',
          zh: '说话和倾听',
        },
        desc: {
          en: "Answers your child's questions in BM, English & Mandarin",
          ms: 'Menjawab soalan anak anda dalam BM, Inggeris & Mandarin',
          zh: '用马来语、英语和中文回答您孩子的问题',
        },
      },
      {
        lucideIcon: 'monitor-off' as const,
        label: {
          en: 'Built for Kids',
          ms: 'Dibina untuk Kanak-kanak',
          zh: '专为儿童设计',
        },
        desc: {
          en: 'No screen. No subscription. Just conversation.',
          ms: 'Tiada skrin. Tiada langganan. Hanya perbualan.',
          zh: '无屏幕。无订阅。只有对话。',
        },
      },
      {
        lucideIcon: 'chart' as const,
        label: {
          en: `Knows ${childName}`,
          ms: `Mengenali ${childName}`,
          zh: `了解${childName}`,
        },
        desc: {
          en: "Starts from their assessment level and grows with them",
          ms: 'Bermula dari tahap penilaian mereka dan berkembang bersama',
          zh: '从评估水平开始，与孩子一起成长',
        },
      },
    ],
    price: 'RM365',
    priceNote: {
      en: 'One-time purchase. No monthly fees. Ever.',
      ms: 'Pembelian sekali. Tiada yuran bulanan. Selamanya.',
      zh: '一次性购买。无月费。永远。',
    },
    orderBtn: {
      en: 'Order Now',
      ms: 'Tempah Sekarang',
      zh: '立即订购',
    },
    referralTitle: {
      en: 'Share & Earn',
      ms: 'Kongsi & Raih',
      zh: '分享赚取',
    },
    referralDesc: {
      en: 'Every Foxy you help sell earns you RM36.50 cash back.',
      ms: 'Setiap Foxy yang anda bantu jual memberikan anda RM36.50 pulangan tunai.',
      zh: '每卖出一只Foxy，您将获得RM36.50现金回馈。',
    },
    referralHighlight: {
      en: 'Share with 10 friends and YOUR FOXY WAS FREE!',
      ms: 'Kongsi dengan 10 rakan dan FOXY ANDA PERCUMA!',
      zh: '与10位朋友分享，您的FOXY就是免费的！',
    },
    referralNote: {
      en: "After purchase, you'll receive your personal referral link. Share it on WhatsApp, Facebook, or anywhere.",
      ms: 'Selepas pembelian, anda akan menerima pautan rujukan peribadi anda. Kongsi di WhatsApp, Facebook, atau di mana sahaja.',
      zh: '购买后，您将收到您的个人推荐链接。在WhatsApp、Facebook或任何地方分享。',
    },
  };

  return (
    <div id={id} className="space-y-6">
      {/* Section A: Product pitch */}
      <FantasyPanel gold className="p-6 md:p-8">
        <GoldOrnament className="mb-4" />

        <h2
          className="text-2xl md:text-3xl font-bold text-center mb-2"
          style={{
            fontFamily: "'Cinzel Decorative', serif",
            background: 'linear-gradient(180deg, #ffeaa7 0%, #d4a44a 40%, #c6872e 70%, #ffeaa7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 10px rgba(212,164,74,0.4))',
          }}
        >
          🦊 {content.title[lang]}
        </h2>

        {/* Product image */}
        <div className="flex justify-center my-6">
          <div
            className="rounded-2xl overflow-hidden max-w-[320px] w-full"
            style={{
              border: '2px solid rgba(212,164,74,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(212,164,74,0.15)',
            }}
          >
            <img
              src={foxyToyImage}
              alt="Foxy AI Companion Toy"
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          </div>
        </div>

        {/* Emotional intro */}
        <p
          className="text-center text-sm md:text-base leading-relaxed mb-4 italic"
          style={{ color: '#c8b88a' }}
        >
          {content.intro[lang]}
        </p>

        {/* Gap bridge (if weak subjects exist) */}
        {content.gapBridge && (
          <p
            className="text-center text-sm md:text-base leading-relaxed mb-6"
            style={{ color: 'rgba(200,184,138,0.85)' }}
          >
            {content.gapBridge[lang]}
          </p>
        )}

        {/* Feature bullets */}
        <div className="space-y-3 mb-6">
          {[
            {
              icon: <Mic className="w-5 h-5" style={{ color: GOLD }} />,
              label: content.features[0].label,
              desc: content.features[0].desc,
            },
            {
              icon: <MonitorOff className="w-5 h-5" style={{ color: GOLD }} />,
              label: content.features[1].label,
              desc: content.features[1].desc,
            },
            {
              icon: <BarChart3 className="w-5 h-5" style={{ color: GOLD }} />,
              label: content.features[2].label,
              desc: content.features[2].desc,
            },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  background: 'rgba(212,164,74,0.1)',
                  border: '1.5px solid rgba(212,164,74,0.25)',
                }}
              >
                {f.icon}
              </div>
              <div>
                <span
                  className="font-bold text-sm md:text-base"
                  style={{ color: GOLD_LIGHT }}
                >
                  {f.label[lang]}
                </span>
                <span
                  className="text-sm md:text-base ml-1"
                  style={{ color: 'rgba(200,184,138,0.7)' }}
                >
                  — {f.desc[lang]}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Price */}
        <div className="text-center mb-4">
          <div
            className="inline-block text-4xl md:text-5xl font-black"
            style={{
              background: 'linear-gradient(180deg, #ffeaa7 0%, #d4a44a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 8px rgba(212,164,74,0.4))',
            }}
          >
            {content.price}
          </div>
          <p className="text-sm mt-1" style={{ color: 'rgba(200,184,138,0.6)' }}>
            {content.priceNote[lang]}
          </p>
        </div>

        {/* Order button + QR */}
        <div className="flex flex-col items-center gap-4">
          <a
            href={PURCHASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-black text-lg uppercase tracking-wider transition-all duration-200 active:scale-95 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #d4a44a 0%, #f0d078 50%, #d4a44a 100%)',
              color: '#2a1f0e',
              border: '3px solid #ffeaa7',
              boxShadow: '0 0 25px rgba(212,164,74,0.4), 0 6px 0 #a67c2e',
              textDecoration: 'none',
            }}
          >
            🛒 {content.orderBtn[lang]}
            <ExternalLink className="w-5 h-5" />
          </a>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-1">
            <canvas
              ref={qrCanvasRef}
              className="rounded-lg"
              style={{
                border: '2px solid rgba(212,164,74,0.3)',
              }}
            />
            <p className="text-xs" style={{ color: 'rgba(200,184,138,0.4)' }}>
              {lang === 'en' ? 'Scan to order' : lang === 'ms' ? 'Imbas untuk tempah' : '扫码订购'}
            </p>
          </div>
        </div>

        <GoldOrnament className="mt-6" />
      </FantasyPanel>

      {/* Section B: Referral program */}
      <div
        className="rounded-2xl p-5 md:p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(212,164,74,0.08) 0%, rgba(124,198,67,0.06) 100%)',
          border: '1.5px solid rgba(212,164,74,0.25)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-5 h-5" style={{ color: GOLD }} />
          <h3 className="font-bold text-lg" style={{ color: GOLD_LIGHT }}>
            {content.referralTitle[lang]}
          </h3>
        </div>

        <p className="text-sm md:text-base mb-2" style={{ color: '#c8b88a' }}>
          {content.referralDesc[lang]}
        </p>

        <p
          className="text-base md:text-lg font-black mb-4"
          style={{
            color: GOLD_LIGHT,
            textShadow: '0 0 8px rgba(212,164,74,0.3)',
          }}
        >
          {content.referralHighlight[lang]}
        </p>

        {/* Visual referral progress */}
        <div className="flex items-center justify-between mb-4 overflow-x-auto gap-1 pb-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <div key={n} className="flex flex-col items-center flex-shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: n === 10
                    ? 'linear-gradient(135deg, #d4a44a, #f0d078)'
                    : 'rgba(212,164,74,0.15)',
                  color: n === 10 ? '#2a1f0e' : 'rgba(200,184,138,0.5)',
                  border: n === 10 ? '2px solid #ffeaa7' : '1px solid rgba(212,164,74,0.2)',
                  boxShadow: n === 10 ? '0 0 10px rgba(212,164,74,0.4)' : 'none',
                }}
              >
                {n === 10 ? '🎉' : n}
              </div>
              <span
                className="text-[9px] mt-0.5 font-bold"
                style={{ color: 'rgba(200,184,138,0.4)' }}
              >
                {n === 10
                  ? (lang === 'en' ? 'FREE!' : lang === 'ms' ? 'PERCUMA!' : '免费!')
                  : `RM${(n * 36.5).toFixed(0)}`}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs" style={{ color: 'rgba(200,184,138,0.5)' }}>
          {content.referralNote[lang]}
        </p>
      </div>
    </div>
  );
};