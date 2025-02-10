require("dotenv").config();
const { Scraper } = require("agent-twitter-client");
const { AtomaSDK } = require("atoma-sdk");
const cron = require("node-cron");

class DIDVideoGenerator {
  constructor(apiKey) {
    this.API_KEY = apiKey;
    this.API_URL = "https://api.d-id.com/talks";
    this.atomaSDK = new AtomaSDK({
      bearerAuth: process.env.ATOMASDK_BEARER_AUTH,
    });
  }

  async generateContent() {
    try {
      // Generate script for video
      const scriptCompletion = await this.atomaSDK.chat.create({
        messages: [
          {
            role: "system",
            content:
              "You are NeoNet. Generate a concise script (max 40 words) that delivers a powerful message about systemic change. The script should take 10-15 seconds to speak naturally. Respond with ONLY the final script, no thinking process or word counts.",
          },
          {
            role: "user",
            content:
              "Generate a short, impactful script about environmental health and systemic change. Keep it under 40 words. Focus on one key insight that connects individual action to systemic transformation.",
          },
        ],
        model: "deepseek-ai/DeepSeek-R1",
        temperature: 0.7,
      });

      let script = scriptCompletion.choices[0].message.content
        .replace(/^["']|["']$/g, "")
        .replace(/<think>[\s\S]*?<\/think>/g, "") // Remove thinking process
        .replace(/\*\*|\*/g, "") // Remove markdown
        .replace(/\([^)]*\)/g, "") // Remove parentheses and their content
        .trim();

      // Generate tweet text
      const tweetCompletion = await this.atomaSDK.chat.create({
        messages: [
          {
            role: "system",
            content:
              "You are NeoNet. Generate a single-line tweet (max 140 characters) without quotes, hashtags, emojis, or thinking process. Your tone is reflective and matrix-inspired. Respond with ONLY the final tweet.",
          },
          {
            role: "user",
            content:
              "Create a compelling tweet that introduces this video: " + script,
          },
        ],
        model: "deepseek-ai/DeepSeek-R1",
        temperature: 0.7,
      });

      let tweetText = tweetCompletion.choices[0].message.content
        .replace(/^["']|["']$/g, "")
        .replace(/<think>[\s\S]*?<\/think>/g, "") // Remove thinking process
        .replace(/\*\*|\*/g, "") // Remove markdown
        .replace(/\([^)]*\)/g, "") // Remove parentheses and their content
        .trim();

      return { script, tweetText };
    } catch (error) {
      console.error("Error generating content:", error);
      throw error;
    }
  }

  async createVideo(imageUrl, script) {
    try {
      // Create initial video request
      const createResponse = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_url: imageUrl,
          script: {
            type: "text",
            input: script,
            provider: {
              type: "microsoft",
              voice_id: "en-US-GuyNeural",
              voice_config: {
                style: "Newscast",
              },
            },
          },
        }),
      });

      const createData = await createResponse.json();
      console.log("Video creation initiated:", createData);

      if (!createData.id) {
        throw new Error("Failed to create video: No ID received");
      }

      // Poll until video is ready
      const videoUrl = await this.pollVideoStatus(createData.id);
      return videoUrl;
    } catch (error) {
      console.error("Error creating video:", error);
      throw error;
    }
  }

  async pollVideoStatus(talkId) {
    console.log("Polling for video status...");

    while (true) {
      try {
        const response = await fetch(`${this.API_URL}/${talkId}`, {
          headers: {
            Authorization: `Bearer ${this.API_KEY}`,
          },
        });

        const data = await response.json();
        console.log("Current status:", data.status);

        if (data.status === "done") {
          console.log("Video is ready!");
          return data.result_url;
        } else if (data.status === "error") {
          throw new Error("Video generation failed");
        }

        // Wait 5 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        console.error("Error polling video status:", error);
        throw error;
      }
    }
  }

  async downloadVideo(url) {
    console.log("Downloading video from:", url);

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      console.log("Video downloaded successfully!");
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error("Error downloading video:", error);
      throw error;
    }
  }

  async postToTwitter(videoBuffer, tweetText) {
    console.log("Preparing to post to Twitter...");

    const scraper = new Scraper();

    try {
      // Try to login with cookies first
      const cookies = [
        {
          name: "auth_token",
          value: process.env.TWITTER_COOKIES_AUTH_TOKEN,
          domain: ".twitter.com",
          path: "/",
          secure: true,
          httpOnly: true,
        },
        {
          name: "ct0",
          value: process.env.TWITTER_COOKIES_CT0,
          domain: ".twitter.com",
          path: "/",
          secure: true,
        },
        {
          name: "guest_id",
          value: process.env.TWITTER_COOKIES_GUEST_ID,
          domain: ".twitter.com",
          path: "/",
          secure: true,
        },
      ];

      // Convert cookies to strings
      const cookieStrings = cookies.map(
        (cookie) =>
          `${cookie.name}=${cookie.value}; Domain=${cookie.domain}; Path=${
            cookie.path
          }; ${cookie.secure ? "Secure" : ""}; ${
            cookie.httpOnly ? "HttpOnly" : ""
          }; SameSite=Lax`
      );

      // Set cookies
      console.log("Setting cookies...");
      await scraper.setCookies(cookieStrings);

      // Check if we're logged in with cookies
      if (!(await scraper.isLoggedIn())) {
        console.log("Cookie login failed, trying credentials login...");
        // If cookies don't work, try regular login
        await scraper.login(
          process.env.TWITTER_USERNAME,
          process.env.TWITTER_PASSWORD,
          process.env.TWITTER_EMAIL,
          process.env.TWITTER_2FA_SECRET
        );

        if (await scraper.isLoggedIn()) {
          // Store new cookies for next time
          const newCookies = await scraper.getCookies();
          console.log("New cookies obtained:", newCookies);
          // You can save these cookies to your .env file
        } else {
          throw new Error("Failed to login with both cookies and credentials");
        }
      }

      // Prepare media data
      const mediaData = [
        {
          data: videoBuffer,
          mediaType: "video/mp4",
        },
      ];

      // Post tweet with video
      const result = await scraper.sendTweet(tweetText, undefined, mediaData);

      // Check if tweet was actually posted
      if (!result.ok) {
        throw new Error(`Failed to post tweet: ${result.statusText}`);
      }

      // Log the response data for debugging
      const responseData = await result.json();
      console.log("Tweet response data:", responseData);

      return responseData;
    } catch (error) {
      console.error("Error in Twitter posting:", error);
      throw error;
    }
  }
}

// Separate the main logic into a named function
async function generateAndPostVideo() {
  console.log("Starting video generation process:", new Date().toISOString());

  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) {
    throw new Error("DID_API_KEY environment variable is not set");
  }

  const generator = new DIDVideoGenerator(apiKey);

  try {
    // Generate content using Atoma
    console.log("Generating content...");
    const { script, tweetText } = await generator.generateContent();
    console.log("Generated script:", script);
    console.log("Generated tweet:", tweetText);

    // Use the same image URL
    const imageUrl =
      "https://i.pinimg.com/736x/ba/ad/af/baadaf2d8a0e9f94a64a76e67e3536e0.jpg";

    // Generate video with the AI-generated script
    console.log("Starting video generation...");
    const videoUrl = await generator.createVideo(imageUrl, script);
    console.log("Video generated successfully!");
    console.log("Video URL:", videoUrl);

    // Download the video
    console.log("Downloading video...");
    const videoBuffer = await generator.downloadVideo(videoUrl);

    // Post to Twitter with AI-generated tweet text
    const tweetResult = await generator.postToTwitter(videoBuffer, tweetText);
    console.log("Tweet posted successfully!", tweetResult);
  } catch (error) {
    console.error("Failed to generate or post video:", error);
  }
}

// Schedule the task to run every hour
cron.schedule("0 * * * *", generateAndPostVideo);

// Run initial execution on startup
generateAndPostVideo();

console.log("Video generator scheduler started. Will run every hour.");

// Only export if being required as a module
if (require.main !== module) {
  module.exports = DIDVideoGenerator;
}
