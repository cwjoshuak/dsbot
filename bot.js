"use strict";

const Discord = require("discord.js");

require("dotenv").config();
const fetch = require("node-fetch");
const MongoClient = require("mongodb").MongoClient;
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PW}@database.mc895.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`;

const db = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
db.connect((err) => {
  if (err) return;
});
const client = new Discord.Client({
  partials: ["MESSAGE", "CHANNEL", "REACTION"],
});
const session_id = process.env.AOC_SESSION_ID;
const AOC_leaderboard_channel = "915535821912813608";
client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  const channel = await client.channels.fetch(AOC_leaderboard_channel);
  const message = await adventOfCode();
  let AOC_message_id =
    (await channel.messages.fetch({ limit: 1 })).first() ||
    (await channel.send(message));

  setInterval(
    async (AOC_message_id) => {
      const channel = await client.channels.fetch(AOC_leaderboard_channel);
      const message = await adventOfCode();
      const msg = await channel.messages.fetch(AOC_message_id);
      await msg.edit(message);
    },
    600000,
    AOC_message_id
  );
});

/**
 * @param {Discord.TextChannel} channel - Advent of Code text channel
 *
 */
async function adventOfCode() {
  const daysSinceStart = new Date().getDate();

  let data = await getAOCLeaderboard();
  data = Object.values(data.members).sort(
    (m1, m2) => m2.local_score - m1.local_score + m2.stars - m1.stars
  );
  data = data.map((m, idx) => {
    let starsPerDay = Object.values(m.completion_day_level).map((c) => {
      const length = Object.values(c).length;
      if (length === 2) return "🌟";
      else if (length === 1) return "⭐";
      return "";
    });

    starsPerDay = starsPerDay
      .concat(Array(daysSinceStart - starsPerDay.length).fill("⚫"))
      .slice(0, daysSinceStart);

    const scoreString = starsPerDay.join("").padEnd(25);
    return `${((idx + 1).toString() + ")").padStart(3)} ${m.local_score
      .toString()
      .padStart(3, " ")} ${scoreString} ${
      m.name === null ? "anonymous" : m.name
    }`;
  });

  return `🎄 **Advent of Code Leaderboard 2021**\
    \`\`\`${data.join("\n")}\`\`\``;
}
async function getAOCLeaderboard() {
  const response = await fetch(
    "https://adventofcode.com/2021/leaderboard/private/view/1519450.json",
    {
      headers: { cookie: `session=${session_id};` },
      credentials: "include",
    }
  );
  const json = await response.json();
  return json;
}

// Create an event listener for messages
client.on("message", (message) => {
  // If the message is "ping"
  if (message.content.startsWith(";link")) {
    linkVCtoText(message);
  }
  if (message.content.startsWith(";unlink")) {
    unlinkVC(message);
  }
});
client.on("messageReactionAdd", async (reaction, user) => {
  const message = !reaction.message.author
    ? await reaction.message.fetch()
    : reaction.message;

  if (
    ![
      "857725128498610176",
      "762832156212592662",
      "826927563158192128",
      "807005531674771466",
      "876569492082290699",
      "869740380906717264",
      "856429658564198480",
    ].includes(message.channel.id)
  ) {
    if (
      reaction.emoji.name === "💀" &&
      message.reactions.cache.get("💀").count >= 7
    ) {
      const msg = reaction.message;

      const embed = new Discord.MessageEmbed()
        .setColor([206, 214, 220])
        .setDescription(msg.cleanContent)
        .addField("Source", `[Jump to Message](${reaction.message.url})`)
        .setAuthor(msg.author.username, msg.author.displayAvatarURL())
        .setTimestamp()
        .setFooter(msg.id);
      if (msg.attachments.first() !== undefined) {
        embed.setImage(msg.attachments.first().attachment);
      } else if (msg.embeds.length > 0 && msg.embeds[0].type === "image") {
        embed.setDescription("");
        embed.setImage(msg.embeds[0].url);
      }
      msg.guild.channels.cache
        .get("876569492082290699")
        .send(msg.channel, { embed: embed })
        // .then(console.log)
        .catch(console.err);
    }
  }
});

client.on("voiceStateUpdate", (oldState, newState) => {
  if (oldState.channelID === newState.channelID) return;

  if (oldState.channelID !== null) {
    const collection = db.db("channels").collection("vc-text-link");
    collection.findOne({ voice: oldState.channelID }).then((res) => {
      if (res) {
        let textChat = newState.guild.channels.resolve(res.text);
        textChat.permissionOverwrites
          .find((m) => m.id === newState.member.id)
          .delete();
      }
    });
  }

  if (newState.channelID !== null) {
    const collection = db.db("channels").collection("vc-text-link");
    collection.findOne({ voice: newState.channelID }).then((res) => {
      if (res) {
        let textChat = newState.guild.channels.resolve(res.text);
        textChat.updateOverwrite(
          newState.member,
          { VIEW_CHANNEL: true },
          `${newState.member.displayName} joined ${newState.channel}`
        );
      }
    });
  }
});

client.login(process.env.DISCORD_TOKEN);

/**
 * @param {Discord.Message} message
 */
function linkVCtoText(message) {
  let args = message.cleanContent.split(" ").slice(1);
  if (args.length === 2 && message.member.hasPermission("ADMINISTRATOR")) {
    try {
      let channels = args.map((chn) => message.guild.channels.resolve(chn));
      let textChannel = channels.find((c) => c.type === "text");
      let vChannel = channels.find((c) => c.type === "voice");

      if (textChannel.type === "text" && vChannel.type === "voice") {
        const collection = db.db("channels").collection("vc-text-link");
        collection.findOneAndReplace(
          { voice: vChannel.id },
          { text: textChannel.id, voice: vChannel.id },
          { upsert: true }
        );

        textChannel.updateOverwrite(textChannel.guild.roles.everyone, {
          VIEW_CHANNEL: false,
          SEND_MESSAGES: true,
          READ_MESSAGE_HISTORY: true,
          ADD_REACTIONS: true,
          USE_EXTERNAL_EMOJIS: true,
          EMBED_LINKS: true,
          ATTACH_FILES: true,
          STREAM: true,
        });
        message.channel.send(
          `Successfully linked ${textChannel} and ${vChannel}!`
        );
      }
    } catch (error) {
      console.log(error);
      message.channel.send("Unable to link channels.");
    }
  }
}
function unlinkVC(message) {
  let args = message.cleanContent.split(" ").slice(1);
  if (args.length === 1 && message.member.hasPermission("ADMINISTRATOR")) {
    try {
      let channels = args.map((chn) => message.guild.channels.resolve(chn));
      let vChannel = channels.find((c) => c.type === "voice");
      const collection = db.db("channels").collection("vc-text-link");
      collection.findOneAndDelete({ voice: vChannel.id }, {}, (err, res) => {
        if (!err) {
          message.channel.send(`Successfully unlinked ${vChannel}`);
        }
      });
    } catch (error) {
      console.log(error);
      message.channel.send("Unable to unlink channel.");
    }
  }
}
