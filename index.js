require("dotenv").config();

const cron = require("node-cron");

const VideoGenerator = require("./VideoGenerator");

// Update the main function to handle the flow
async function main() {
  console.log("Starting video generation process:", new Date().toISOString());

  const generator = new VideoGenerator();

  try {
    // Generate content using Atoma
    console.log("Generating content...");
    const { script, tweetText, newsContext } =
      await generator.generateContent();
    console.log("Generated script:", script);
    console.log("Generated tweet:", tweetText);

    // Select appropriate image based on the script
    console.log("Selecting appropriate image...");
    const imageUrl = await generator.selectImageForScript(script);
    console.log("Selected image URL:", imageUrl);

    // Generate video with the AI-generated script
    console.log("Starting video generation...");
    const videoUrl = await generator.createVideo(imageUrl, script);
    console.log("Video generated successfully!");
    console.log("Video URL:", videoUrl);

    // Download the video
    console.log("Downloading video...");
    const videoBuffer = await generator.downloadVideo(videoUrl);

    // Post to Twitter with AI-generated tweet text
    console.log("Posting to Twitter...");
    const tweetResult = await generator.postToTwitter(videoBuffer, tweetText);
    console.log("Tweet posted successfully!", tweetResult);

    // Only after everything succeeds, save to database
    console.log("Saving successful post to database...");
    await generator.savePublishedPost(
      script,
      tweetText,
      newsContext,
      tweetResult.tweet_id
    );
    console.log("Post saved and marked as published!");
  } catch (error) {
    console.error("Failed in the process:", error);
    throw error;
  }
}

// Schedule the task to run every hour
cron.schedule("0 * * * *", main);

// Run initial execution on startup
main();

console.log("Video generator scheduler started. Will run every hour.");

// Only export if being required as a module
if (require.main !== module) {
  module.exports = DIDVideoGenerator;
}
