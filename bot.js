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
const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Create an event listener for messages
client.on("message", (message) => {
  // If the message is "ping"
  if (message.content.startsWith(";link")) {
    linkVCtoText(message);
  }
});

client.on("voiceStateUpdate", (oldState, newState) => {
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
  let args = message.content.split(" ").slice(1);
  if (args.length === 2 && message.member.hasPermission("ADMINISTRATOR")) {
    try {
      console.log(args);
      let channels = args.map((chn) => message.guild.channels.resolve(chn));
      console.log(channels);
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
