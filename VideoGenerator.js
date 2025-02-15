const { Scraper } = require("agent-twitter-client");
const { AtomaSDK } = require("atoma-sdk");
const { tavily } = require("@tavily/core");
const { createClient } = require("@supabase/supabase-js");

class VideoGenerator {
  constructor() {
    this.API_KEY = process.env.DID_API_KEY;
    this.API_URL = "https://api.d-id.com/talks";
    this.atomaSDK = new AtomaSDK({
      bearerAuth: process.env.ATOMASDK_BEARER_AUTH,
    });
    this.tavily = tavily({
      apiKey: process.env.TAVILY_API_KEY,
    });

    // Initialize Supabase client with service_role key to bypass RLS
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY, // Use service role key instead of anon key
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  async getRecentPosts() {
    const { data, error } = await this.supabase
      .from("video_posts")
      .select("script, tweet_text, news_context")
      .eq("is_published", true) // Only get published posts
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching recent posts:", error);
      return [];
    }
    return data;
  }

  async savePost(script, tweetText, newsContext) {
    const { data, error } = await this.supabase
      .from("video_posts")
      .insert([
        {
          script,
          tweet_text: tweetText,
          news_context: newsContext,
          is_published: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error saving post:", error);
      throw error;
    }
    return data;
  }

  async markAsPublished(id, twitterPostId) {
    const { error } = await this.supabase
      .from("video_posts")
      .update({
        is_published: true,
        twitter_post_id: twitterPostId,
        published_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error marking post as published:", error);
      throw error;
    }
  }

  async savePublishedPost(script, tweetText, newsContext, twitterPostId) {
    const { data, error } = await this.supabase
      .from("video_posts")
      .insert([
        {
          script,
          tweet_text: tweetText,
          news_context: newsContext,
          is_published: true,
          twitter_post_id: twitterPostId,
          published_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error saving published post:", error);
      throw error;
    }
    return data;
  }

  async generateContent() {
    try {
      // Get recent SUI news using Tavily
      const searchResponse = await this.tavily.search("Sui blockchain news", {
        search_depth: "advanced",
        max_results: 5,
        include_raw_content: true,
        include_domains: [
          "twitter.com",
          "github.com",
          "sui.io",
          "crypto.news",
          "coindesk.com",
        ],
        include_answer: true,
        // topic: "news",

        timeRange: "day",
      });

      if (!searchResponse || !searchResponse.answer) {
        console.log(
          "No recent Sui news found, using fallback content generation"
        );
        // Generate script without news context
        const scriptCompletion = await this.atomaSDK.chat.create({
          messages: [
            {
              role: "system",
              content:
                "You are NeoNet. Generate a concise script (max 80 words) about Sui blockchain's potential and innovation. The script should take 10-15 seconds to speak naturally. Respond with ONLY the final script.",
            },
          ],
          model: "meta-llama/Llama-3.3-70B-Instruct",
          temperature: 0.7,
        });

        let script = scriptCompletion.choices[0].message.content
          .replace(/^["']|["']$/g, "")
          .replace(/\*\*|\*/g, "")
          .replace(/\([^)]*\)/g, "")
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
              content: `Create a compelling tweet about this Sui blockchain update: ${script}`,
            },
          ],
          model: "meta-llama/Llama-3.3-70B-Instruct",
          temperature: 0.7,
        });

        let tweetText = tweetCompletion.choices[0].message.content
          .replace(/^["']|["']$/g, "")
          .replace(/\*\*|\*/g, "")
          .replace(/\([^)]*\)/g, "")
          .trim();

        return { script, tweetText };
      }

      // Get recent posts for context
      const recentPosts = await this.getRecentPosts();
      const recentPostsContext = recentPosts
        .map((post) => `Previous post: ${post.script}`)
        .join("\n");

      // Generate script for video using Tavily's AI answer and avoiding similar content
      const scriptCompletion = await this.atomaSDK.chat.create({
        messages: [
          {
            role: "system",
            content:
              "You are NeoNet. Generate a concise script (max 80 words) about ONE specific Sui blockchain development from the provided news summary. The script should take 10-15 seconds to speak naturally. Focus on the most impactful or innovative aspect. AVOID topics similar to the previous posts listed. Respond with ONLY the final script.",
          },
          {
            role: "user",
            content: `Here are the previous posts to avoid similar content:\n${recentPostsContext}\n\nHere is the current news summary. Choose ONE DIFFERENT development to focus on and create an impactful script:\n\n${searchResponse.answer}`,
          },
        ],
        model: "meta-llama/Llama-3.3-70B-Instruct",
        temperature: 0.7,
      });

      let script = scriptCompletion.choices[0].message.content
        .replace(/^["']|["']$/g, "")
        .replace(/\*\*|\*/g, "")
        .replace(/\([^)]*\)/g, "")
        .trim();

      // Generate tweet text based on the same news focus
      const tweetCompletion = await this.atomaSDK.chat.create({
        messages: [
          {
            role: "system",
            content:
              "You are NeoNet. Generate a single-line tweet (max 140 characters) without quotes, hashtags, emojis, or thinking process. Your tone is reflective and matrix-inspired. Focus on the same news point as the script.",
          },
          {
            role: "user",
            content: `Create a compelling tweet about this Sui blockchain update: ${script}`,
          },
        ],
        model: "meta-llama/Llama-3.3-70B-Instruct",
        temperature: 0.7,
      });

      let tweetText = tweetCompletion.choices[0].message.content
        .replace(/^["']|["']$/g, "")
        .replace(/\*\*|\*/g, "")
        .replace(/\([^)]*\)/g, "")
        .trim();

      return {
        script,
        tweetText,
        newsContext: searchResponse.answer,
      };
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
          config: {
            stitch: true,
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

  async selectImageForScript() {
    try {
      // Get all available images
      const { data: images, error } = await this.supabase
        .from("avatar_images")
        .select("*");

      if (error) {
        console.error("Error fetching images:", error);
        throw error;
      }

      // Find Neo Portrait image for fallback
      const neoPortrait = images.find((img) => img.title === "Neo Portrait");
      if (!neoPortrait) {
        throw new Error("Neo Portrait image not found in database");
      }

      // Randomly select an image
      const randomIndex = Math.floor(Math.random() * images.length);
      const selectedImage = images[randomIndex];

      console.log("Randomly selected image:", selectedImage.title);
      return selectedImage.url;
    } catch (error) {
      console.error("Error selecting image:", error);
      return neoPortrait.url;
    }
  }
}


module.exports = VideoGenerator;
