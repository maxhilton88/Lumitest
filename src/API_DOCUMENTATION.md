# 🦊 Foxy Adventure API Documentation

**Base URL:** `https://{projectId}.supabase.co/functions/v1/make-server-221a61bc`

---

## 🔐 Authentication

All authenticated endpoints require:
```
Authorization: Bearer {access_token}
```

### POST `/auth/signup`
Create a new kindergarten account

**Request:**
```json
{
  "name": "Teacher Name",
  "email": "school@example.com",
  "password": "securepassword",
  "schoolName": "Happy Kindergarten" // optional
}
```

**Response:**
```json
{
  "success": true,
  "user": { "id": "...", "email": "..." },
  "school": { "id": "...", "name": "...", "kindergarten_url": "..." }
}
```

### POST `/auth/login`
Login to kindergarten account

**Request:**
```json
{
  "email": "school@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "session": { "access_token": "...", "refresh_token": "..." },
  "user": { "id": "...", "email": "..." },
  "school": { "id": "...", "name": "...", "kindergarten_url": "..." }
}
```

---

## 📝 Questions Management

### GET `/questions`
Get questions (filtered)

**Query Params:**
- `quest` - english | numbers | bahasa | mandarin | science
- `age` - 4 | 5 | 6 | 7
- `language` - global | en | ms | zh

**Response:**
```json
{
  "questions": [
    {
      "id": "...",
      "quest": "english",
      "type": "mcq",
      "language": "en",
      "age_difficulty": 5,
      "question_text": { "en": "What color is the sky?", "ms": "...", "zh": "..." },
      "foxy_message": { "en": "Good job!", "ms": "...", "zh": "..." },
      "options": ["Blue", "Red", "Green"],
      "correct_answer": "Blue",
      "skills": ["colors", "recognition"],
      "tags": ["basic"],
      "is_lumi_official": false
    }
  ]
}
```

### POST `/questions`
Create a new question

**Request:** (Same structure as question object above)

### PUT `/questions/:id`
Update a question

### DELETE `/questions/:id`
Delete a question

### POST `/questions/bulk`
Bulk upload questions

**Request:**
```json
{
  "questions": [
    { /* question object */ },
    { /* question object */ }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "questions": [...]
}
```

---

## 🗺️ Quest Configuration

### GET `/quests`
Get all quest configs for the kindergarten

**Response:**
```json
{
  "configs": [
    {
      "id": "...",
      "school_id": "...",
      "quest_id": "english",
      "language": "en",
      "number_of_questions": 20,
      "skill_filters": ["phonics", "vocabulary"]
    }
  ]
}
```

### PUT `/quests/:questId`
Update quest configuration (upsert)

**Request:**
```json
{
  "language": "en",
  "number_of_questions": 25,
  "skill_filters": ["phonics", "vocabulary", "reading"]
}
```

---

## 👶 Test Results / Leads

### POST `/leads`
Submit a test result (public endpoint - no auth required)

**Request:**
```json
{
  "school_id": "...",
  "child_name": "Ahmad",
  "parent_name": "Siti Abdullah",
  "whatsapp": "+60123456789",
  "age": 5,
  "score": 18,
  "total_questions": 20,
  "detailed_answers": [...],
  "quest_results": {
    "english": { "score": 9, "total": 10 },
    "numbers": { "score": 9, "total": 10 }
  },
  "age_performance": {
    "age4": { "score": 5, "total": 5 },
    "age5": { "score": 10, "total": 12 },
    "age6": { "score": 3, "total": 3 }
  }
}
```

### GET `/leads`
Get all leads for the kindergarten (with pagination)

**Query Params:**
- `limit` - default: 50
- `offset` - default: 0

**Response:**
```json
{
  "leads": [...],
  "total": 156,
  "limit": 50,
  "offset": 0
}
```

### GET `/leads/:id`
Get a single lead detail

---

## ⚙️ Settings

### GET `/settings`
Get kindergarten settings

**Response:**
```json
{
  "settings": {
    "id": "...",
    "name": "Happy Kindergarten",
    "email": "school@example.com",
    "logo_url": "https://...",
    "primary_color": "#7cc643",
    "kindergarten_url": "happy-kindergarten",
    "test_page_bg_color": "#ffffff",
    "map_background_image": "https://...",
    "test_background_image": "https://...",
    "subscription_status": "trial"
  }
}
```

### PUT `/settings`
Update kindergarten settings

**Request:** (Same structure as settings object)

---

## 🌐 Public Endpoints (For Child Test Pages)

### GET `/public/school/:kindergartenUrl`
Get school info by kindergarten URL (no auth required)

**Example:** `/public/school/happy-kindergarten`

### GET `/public/questions`
Get questions for test (no auth required)

**Query Params:**
- `school_id` - **required**
- `quest` - english | numbers | bahasa | mandarin | science
- `age` - 4 | 5 | 6 | 7
- `language` - en | ms | zh
- `limit` - default: 20

### GET `/public/quests`
Get quest configs (no auth required)

**Query Params:**
- `school_id` - **required**

---

## 📤 File Upload

### POST `/upload`
Upload an image file (logo or background)

**Request:** `multipart/form-data`
- `file` - The image file (JPEG, PNG, WebP)
- `folder` - Optional folder name (default: 'general')

**Response:**
```json
{
  "success": true,
  "url": "https://.../make-221a61bc-uploads/logos/user-id-123456789.png",
  "filename": "logos/user-id-123456789.png"
}
```

**Limits:**
- Max file size: 5MB
- Allowed types: JPEG, PNG, WebP

### DELETE `/upload/:filename`
Delete an uploaded file

---

## 📊 Database Schema

### schools
- `id` - UUID primary key
- `user_id` - UUID (auth.users)
- `name` - text
- `email` - text (unique)
- `logo_url` - text
- `primary_color` - text
- `kindergarten_url` - text (unique)
- `test_page_bg_color` - text
- `map_background_image` - text
- `test_background_image` - text
- `subscription_status` - trial | active | expired

### questions
- `id` - UUID primary key
- `school_id` - UUID (schools)
- `quest` - english | numbers | bahasa | mandarin | science
- `type` - mcq | dragdrop | hotspot | sequence
- `language` - global | en | ms | zh
- `age_difficulty` - 4 | 5 | 6 | 7
- `question_text` - JSONB { en, ms, zh }
- `foxy_message` - JSONB { en, ms, zh }
- `options` - JSONB (array or object depending on type)
- `correct_answer` - text
- `hotspot_image` - text (URL for hotspot questions)
- `skills` - text[] array
- `tags` - text[] array
- `is_lumi_official` - boolean

### quest_configs
- `id` - UUID primary key
- `school_id` - UUID (schools)
- `quest_id` - english | numbers | bahasa | mandarin | science
- `language` - global | en | ms | zh
- `number_of_questions` - integer
- `skill_filters` - text[] array

### test_results
- `id` - UUID primary key
- `school_id` - UUID (schools)
- `child_name` - text
- `parent_name` - text
- `whatsapp` - text
- `age` - integer (4-7)
- `score` - integer
- `total_questions` - integer
- `detailed_answers` - JSONB array
- `quest_results` - JSONB object
- `age_performance` - JSONB object
- `completed_at` - timestamp

---

## 🚀 Environment Variables

Required in Supabase Edge Functions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## ✅ Error Handling

All endpoints return errors in this format:
```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error
