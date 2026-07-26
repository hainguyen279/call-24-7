require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');

// ===== Cấu hình =====
const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.COMMAND_PREFIX || '!add';
const LEAVE_CMD = process.env.LEAVE_COMMAND || '!leave';
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'target.json');

if (!TOKEN) {
  console.error('❌ Thiếu biến môi trường bắt buộc: DISCORD_TOKEN');
  process.exit(1);
}

// ===== Lưu / đọc channel mục tiêu để bot tự join lại khi restart (Render deploy lại, sập, v.v.) =====
function saveTarget(guildId, channelId) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ guildId, channelId }, null, 2));
}

function loadTarget() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearTarget() {
  try {
    fs.unlinkSync(DATA_FILE);
  } catch (e) {}
}

// ===== Web server nhỏ để Render nhận diện Web Service đang sống =====
const app = express();
app.get('/', (req, res) => res.send('Bot dang chay ✅'));
app.listen(PORT, () => console.log(`🌐 HTTP server đang chạy ở port ${PORT}`));

// ===== Discord client =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let reconnectTimeout = null;

async function joinChannel(guildId, channelId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);

    if (!channel || !channel.isVoiceBased()) {
      console.error('❌ Channel không phải voice channel hợp lệ.');
      return false;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    connection.removeAllListeners();

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log('⚠️  Bị ngắt kết nối voice, đang thử kết nối lại...');
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        console.log('❌ Không tự resume được, join lại từ đầu...');
        try { connection.destroy(); } catch (e) {}
        scheduleReconnect();
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      const current = loadTarget();
      if (current) {
        console.log('🔌 Kết nối voice bị hủy, sẽ join lại sau vài giây...');
        scheduleReconnect();
      }
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    console.log(`✅ Đã vào voice channel: ${channel.name} (${guild.name})`);
    return true;
  } catch (error) {
    console.error('❌ Lỗi khi join voice channel:', error.message);
    scheduleReconnect();
    return false;
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  reconnectTimeout = setTimeout(() => {
    const target = loadTarget();
    if (!target) return;
    const existing = getVoiceConnection(target.guildId);
    if (existing) {
      try { existing.destroy(); } catch (e) {}
    }
    joinChannel(target.guildId, target.channelId);
  }, 5_000);
}

client.once('ready', () => {
  console.log(`🤖 Đăng nhập thành công với tên: ${client.user.tag}`);
  console.log(`ℹ️  Lệnh: gõ "${PREFIX}" trong channel để bot vào voice bạn đang ở. Gõ "${LEAVE_CMD}" để bot rời đi.`);

  // Nếu trước đó đã có channel được lưu (do restart), tự join lại
  const saved = loadTarget();
  if (saved) {
    console.log('🔁 Tìm thấy voice channel đã lưu trước đó, đang join lại...');
    joinChannel(saved.guildId, saved.channelId);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.trim().toLowerCase();

  if (content === PREFIX.toLowerCase()) {
    const member = message.member;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      message.reply('⚠️ Bạn cần đang ở trong 1 voice channel thì mới gõ lệnh này được.');
      return;
    }

    const ok = await joinChannel(message.guild.id, voiceChannel.id);
    if (ok) {
      saveTarget(message.guild.id, voiceChannel.id);
      message.reply(`✅ Đã vào **${voiceChannel.name}** và sẽ ở lại 24/7. Gõ \`${LEAVE_CMD}\` nếu muốn bot rời đi.`);
    } else {
      message.reply('❌ Không vào được voice channel, kiểm tra lại quyền của bot (Connect, Speak).');
    }
    return;
  }

  if (content === LEAVE_CMD.toLowerCase()) {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
    }
    clearTarget();
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    message.reply('👋 Đã rời voice channel.');
    return;
  }
});

// Nếu bị đá ra khỏi voice, tự động join lại channel đã lưu
client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.member?.id === client.user.id && oldState.channelId && !newState.channelId) {
    const target = loadTarget();
    if (target) {
      console.log('⚠️  Bot bị đá ra khỏi voice channel, đang join lại...');
      scheduleReconnect();
    }
  }
});

client.on('error', (error) => {
  console.error('❌ Lỗi client:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});

client.login(TOKEN);
