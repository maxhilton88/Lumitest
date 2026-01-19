# 🦊 Project LUMI - KSSR SaaS Marketing Tester

A vibrant, premium playful B2B2C SaaS platform designed for Malaysian preschools to attract parent leads through an engaging KSSR readiness assessment game.

## 🎯 Project Purpose

**Product Type:** B2B2C SaaS Marketing & Assessment Tool  
**Primary Goal:** Act as a "Lead Magnet" for preschools  
**Business Model:** RM356/year subscription for kindergartens  

### Value Proposition
- **For Parents:** Get their child's "Standard 1 Readiness" score
- **For Schools:** Generate hot leads with contact info + child's academic profile

## 👥 Target Audience

- **Primary:** Malaysian Parents (Ages 25-45)
- **Secondary:** Preschool Owners/Principals

## 🎨 Visual Identity

**Design Philosophy:** "Premium Playful" - Think Duolingo meets Apple for Kids

### Color Palette
- **Energetic Yellow:** `#fac20a` / `#ffd93d`
- **Vibrant Cyan:** `#09e8e8` / `#6bfbfb`
- **Playful Pink:** `#ff6b9d` / `#ff8fb1`
- **Nature Green:** `#4caf50` / `#7ee8a8`
- **Magic Purple:** `#a855f7` / `#c084fc`

### UI Components
- **Glossy, bubbly buttons** with shadow depth
- **Whimsical forest/island backgrounds**
- **Soft, colorful lighting** effects
- **Rounded corners** everywhere (border-radius: 1-2rem)

## 🦊 Meet Foxy-01

Your AI guide throughout the assessment journey! Foxy appears on every test screen to:
- Read questions aloud (AI Voice Engine)
- Encourage and motivate children
- Provide friendly guidance

## 🌐 Multilingual Support

Instantly switch between:
- 🇬🇧 **English**
- 🇲🇾 **Bahasa Melayu**
- 🇨🇳 **中文 (Mandarin Simplified)**

All UI elements, questions, and voice narration adapt to the selected language.

## ✨ Core Features

### 1. **AI Speech Engine**
- Integration-ready for Aliyun TTS
- Browser fallback with Web Speech API
- Pulsating speaker icon on every question
- Foxy reads questions in child's preferred language

### 2. **Lead Capture Gate**
Strategically placed AFTER test completion but BEFORE results:
- Child's Name
- Parent's Name  
- WhatsApp Number
- High-conversion design with celebration effects

### 3. **Dynamic "Ladder" Report**
Visual progress indicator showing:
- **🌟 Advanced** (80%+): Top performers
- **📚 Ready for School** (50-79%): On track
- **🌱 Developing** (0-49%): Growing learners
- Comparison with "National Average" marker

### 4. **SaaS Subscription**
- **RM356/year** for kindergartens
- 14-day free trial
- Stripe integration ready
- Automated renewal system

## 📱 User Journeys

### Parent & Child Flow
1. **Welcome Screen** → Language selection
2. **Test Adventure** → 5 engaging questions with Foxy
3. **Lead Gate** → Parent enters contact info
4. **Results Screen** → Beautiful ladder report + social sharing

### Kindergarten Flow
1. **Sign Up** → Pay RM356/year (or start trial)
2. **Customize** → Upload logo, set thank you message
3. **Market** → Share unique test link on social media
4. **Convert** → Parent completes test
5. **Engage** → Click WhatsApp to invite for school tour

### Super Admin Flow
1. **Global Overview** → Total schools, leads, revenue
2. **School Management** → Monitor subscriptions
3. **Question Bank** → CRUD operations for KSSR questions
4. **Billing** → Manage pricing and promo codes

## 🧩 Question Types (5 Models)

### Model A: Grid MCQ
4 large image cards in 2×2 grid. Tap the correct answer.

### Model B: Drag & Drop
Drag items to correct positions (e.g., "Drag letter B to Bear")

### Model C: Hotspot Identification
Tap specific areas (e.g., "Tap the boy's hand")

### Model D: Matching Pairs
Draw lines or tap to connect related items

### Model E: Sequence Builder
Order items correctly (e.g., 1, 2, 3 or growth stages)

## 🏗 Technical Architecture

### Frontend
- **React** with TypeScript
- **Tailwind CSS v4** for styling
- **Lucide React** for icons
- **Motion/React** for animations
- Mobile-first responsive design

### Backend (Supabase)
- **Hono** web server on Supabase Edge Functions
- **KV Store** for data persistence
- RESTful API endpoints:
  - `/make-server-221a61bc/leads` - Lead management
  - `/make-server-221a61bc/schools` - School CRUD
  - `/make-server-221a61bc/stats/global` - Analytics

### Key Data Models

**Lead:**
```typescript
{
  id: string
  schoolId: string
  childName: string
  parentName: string
  whatsapp: string
  score: number
  answers: array
  date: string
}
```

**School:**
```typescript
{
  id: string
  name: string
  email: string
  logo: string
  subscriptionStatus: 'trial' | 'active' | 'expired'
  subscriptionExpiryDate: string
  leadsGenerated: number
}
```

## 📊 Dashboards

### Kindergarten Dashboard (4 Tabs)

**1. Lead CRM**
- Table of all parent leads
- WhatsApp quick-action button
- Score indicators (color-coded)
- Export to CSV

**2. Customize**
- Upload school logo
- Custom thank you message
- Toggle questions on/off

**3. Marketing Kit**
- Unique test link with copy button
- QR code download for banners
- Social media templates

**4. Subscription**
- Current plan details (RM356/year)
- Renewal date
- Payment history
- Update payment method

### Super Admin Dashboard (3 Tabs)

**1. School Management**
- List of all subscribed schools
- Subscription status tracking
- Leads generated per school
- Revenue attribution

**2. Master Question Bank**
- CRUD interface for questions
- Support for images, audio, text
- Difficulty levels
- Subject categorization

**3. Billing & Plans**
- Adjust pricing
- Generate promo codes
- View Stripe transaction logs
- Trial period configuration

## 🚀 Getting Started

### For Schools:
1. Sign up at the homepage
2. Complete RM356/year payment (or start free trial)
3. Upload your school logo
4. Copy your unique test link
5. Share on Facebook, Instagram, WhatsApp
6. Watch leads come in!
7. Click WhatsApp to contact interested parents

### For Parents:
1. Click school's test link
2. Child selects language (EN/BM/中文)
3. Play the fun KSSR game with Foxy
4. Enter contact info to see results
5. View child's readiness score
6. Share results on social media

## 🔒 Data Privacy Note

**Important:** Figma Make is designed for prototyping. For production deployment:
- Implement proper PII encryption
- Use secure payment gateway (Stripe)
- Comply with PDPA (Malaysia's data protection laws)
- Add proper authentication and authorization
- Set up SSL/TLS certificates

## 🎯 Next Steps for Production

### Essential Integrations:
1. **Aliyun TTS** - Replace browser speech with professional voice
2. **Stripe Payment** - Set up live payment gateway
3. **Email Service** - SendGrid/Mailgun for receipts
4. **WhatsApp Business API** - Automated notifications
5. **Analytics** - Google Analytics / Mixpanel
6. **QR Code Generator** - Dynamic QR for marketing

### Feature Enhancements:
- [ ] More question types (video, interactive)
- [ ] Parent progress tracking dashboard
- [ ] Gamification (badges, rewards)
- [ ] Multi-child profiles
- [ ] School comparison leaderboards
- [ ] PDF report generation
- [ ] Automated WhatsApp notifications

## 📈 Success Metrics

**For Schools:**
- Lead acquisition cost
- Conversion rate (lead → enrolled student)
- ROI on RM356 subscription

**For Platform:**
- Monthly Recurring Revenue (MRR)
- School retention rate
- Average leads per school
- Test completion rate

## 🎨 Design Inspiration

The UI follows the uploaded reference image style:
- ✅ Glossy, 3D-effect buttons
- ✅ Vibrant gradient backgrounds
- ✅ Whimsical character design
- ✅ Playful typography
- ✅ Soft shadows and depth
- ✅ Mobile-optimized layouts

## 📞 Support & Documentation

For technical support or feature requests, administrators can access detailed logs through the Super Admin dashboard.

---

**Built with ❤️ for Malaysian Preschools**  
*Empowering Parents • Growing Schools • Preparing Children*
