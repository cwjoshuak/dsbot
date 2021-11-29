"use strict";

const Discord = require("discord.js");

require("dotenv").config();

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

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

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
        .addField('', `[Jump to Message](${reaction.message.url})`)
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
