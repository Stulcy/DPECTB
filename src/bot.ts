import { Client, Events, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const clientToken = process.env.CLIENT_TOKEN;

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // servers
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client
  .once("ready", async () => {
    try {
      const user = await client.users.fetch(process.env.USER_ID as string);
      await user.send("Let's gremo!");
      console.log("DM sent");
    } catch (error) {
      console.error("Failed to send DM:", error);
    }
  })
  .on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
  });

const initialize = async () => {
  try {
    await client.login(clientToken);
    console.log("[INFO] DPECTB Online");
  } catch (e) {
    console.error("[ERROR] Login failed", e);
    process.exit(1);
  }
};

initialize();
