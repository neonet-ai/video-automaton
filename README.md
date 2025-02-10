# AI Video Content Generator

An automated system that generates and posts AI-driven video content to Twitter using D-ID's video generation API and Atoma SDK for content creation.

## Features

- 🤖 AI-powered script generation using Atoma SDK
- 🎥 Automated video creation with D-ID's API
- 🐦 Automatic Twitter posting
- ⏰ Scheduled hourly content generation and posting
- 🔄 Robust error handling and status polling
- 🍪 Support for both cookie-based and credential-based Twitter authentication

## Prerequisites

- Node.js (v14 or higher)
- Twitter Account
- D-ID API Account
- Atoma SDK Account

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

## Usage


Start the application:

```bash
npm start
```


The application will:
1. Generate an AI-powered script using Atoma SDK
2. Create a video using D-ID's API
3. Post the video to Twitter with an AI-generated tweet
4. Repeat this process every hour

## Technical Details

### Authentication Methods

The system supports two Twitter authentication methods:
1. Cookie-based authentication (preferred)
2. Credential-based authentication (fallback)

### Content Generation

- Scripts are generated using Atoma SDK with the DeepSeek-R1 model
- Videos are created using D-ID's API with Microsoft's text-to-speech
- Default voice: en-US-GuyNeural with Newscast style

### Error Handling

The application includes comprehensive error handling for:
- Content generation failures
- Video creation issues
- Network problems
- Authentication errors
- Twitter posting failures



