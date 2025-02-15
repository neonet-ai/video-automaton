# AI Video Content Generator

An automated system that generates and posts AI-driven video content about Sui blockchain to Twitter, using Tavily for news gathering, D-ID for video generation, and Atoma SDK for content creation.

## Features

- 📰 Real-time Sui blockchain news fetching using Tavily API
- 🤖 AI-powered script and tweet generation using Atoma SDK
- 🎨 Dynamic image selection from a curated database
- 🎥 Automated video creation with D-ID's API
- 🐦 Automatic Twitter posting
- 📊 Content tracking in Supabase database
- 🔄 Duplicate content prevention
- ⚡ Robust error handling and fallbacks

## Prerequisites

- Node.js (v14 or higher)
- Twitter Account
- D-ID API Account
- Atoma SDK Account
- Tavily API Key
- Supabase Account

## Installation

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your credentials:

```bash
cp .env.example .env
```

3. Set up Supabase database:
   - Create required tables using provided SQL scripts
   - Configure image database with provided assets

## Environment Variables

```env
# Twitter credentials
TWITTER_USERNAME=
TWITTER_PASSWORD=
TWITTER_EMAIL=
TWITTER_2FA_SECRET=

# Twitter cookies
TWITTER_COOKIES_AUTH_TOKEN=
TWITTER_COOKIES_CT0=
TWITTER_COOKIES_GUEST_ID=

# D-ID credentials
DID_API_KEY=

# Atoma SDK Configuration
ATOMASDK_BEARER_AUTH=

# Tavily API Key
TAVILY_API_KEY=

# Supabase Configuration
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Usage

Start the application:

```bash
npm start
```

The application will:

1. Fetch latest Sui blockchain news using Tavily
2. Generate an AI-powered script and tweet using Atoma SDK
3. Select a random image from the database
4. Create a video using D-ID's API
5. Post the video to Twitter
6. Store the successful post in Supabase

## Technical Details

### Content Generation Flow

1. **News Gathering**: Uses Tavily API to fetch recent Sui blockchain news
2. **Content Creation**: Generates unique scripts and tweets using Atoma SDK
3. **Image Selection**: Randomly selects from a curated set of themed images
4. **Video Generation**: Creates talking head videos using D-ID API
5. **Social Posting**: Publishes content to Twitter
6. **Database Storage**: Records successful posts in Supabase

### Database Schema

#### Video Posts Table

```sql
CREATE TABLE video_posts (
    id BIGSERIAL PRIMARY KEY,
    script TEXT NOT NULL,
    tweet_text TEXT NOT NULL,
    news_context TEXT NOT NULL,
    is_published BOOLEAN DEFAULT false,
    twitter_post_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);
```

#### Avatar Images Table

```sql
CREATE TABLE avatar_images (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    style TEXT NOT NULL,
    theme TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Error Handling

- Comprehensive error catching at each step
- Neo Portrait image as fallback
- Failed attempts tracking
- Duplicate content prevention
- Database error logging

### Authentication Methods

- Cookie-based Twitter authentication (preferred)
- Credential-based authentication (fallback)
