const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('./database');

// ============ EXPRESS SERVER (Để chạy trên Render Web Service) ============
const app = express();
app.use(express.json());
app.get('/', (req, res) => res.json({ status: 'online' }));
app.get('/health', (req, res) => res.status(200).send('OK'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server chạy tại cổng ${PORT}`));

// ============ DISCORD BOT CLIENT ============
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences
  ]
});

client.commands = new Collection();
client.snipes = new Collection();
const slashCommands = [];

// Tự động quét và nạp thư mục lệnh (Command Loader)
const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
  const commandFolders = fs.readdirSync(foldersPath);
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
      }
    }
  }
}

// Tự động quét và nạp thư mục sự kiện (Event Loader)
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

client.once('ready', async () => {
  console.log(`🤖 Bot trực tuyến: ${client.user.tag}`);
  
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    if (process.env.GUILD_ID) {
      // Đăng ký lệnh tức thì cho Server cấu hình trong Render [4]
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID.trim()),
        { body: slashCommands }
      );
      console.log(`✅ Đồng bộ Slash Command thành công cho Server: ${process.env.GUILD_ID}`);
    } else {
      // Đăng ký toàn cầu
      await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
      console.log('✅ Đồng bộ Slash Command toàn cầu thành công!');
    }
  } catch (error) {
    console.error('❌ Lỗi nạp lệnh Slash:', error);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Lỗi đăng nhập Bot Discord:', err);
});