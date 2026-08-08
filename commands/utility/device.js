const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const STATUS_EMOJIS = {
  online: '🟢 Trực tuyến (Online)',
  idle: '🌙 Treo máy (Idle)',
  dnd: '🔴 Đừng làm phiền (DND)',
  offline: '⚪ Ngoại tuyến (Offline)'
};

function parseClientDevices(presence) {
  if (!presence || !presence.clientStatus) return ['⚪ Ngoại tuyến hoặc đang ẩn danh (Offline)'];
  const devices = [];
  if (presence.clientStatus.desktop) devices.push(`💻 **Máy tính (Desktop):** ${STATUS_EMOJIS[presence.clientStatus.desktop] || '🟢 Online'}`);
  if (presence.clientStatus.mobile) devices.push(`📱 **Điện thoại (Mobile):** ${STATUS_EMOJIS[presence.clientStatus.mobile] || '🟢 Online'}`);
  if (presence.clientStatus.web) devices.push(`🌐 **Trình duyệt Web:** ${STATUS_EMOJIS[presence.clientStatus.web] || '🟢 Online'}`);
  return devices.length > 0 ? devices : ['⚪ Ngoại tuyến hoặc đang ẩn danh (Offline)'];
}

function parseActivities(presence) {
  if (!presence || !presence.activities || presence.activities.length === 0) {
    return { spotify: null, game: null, customStatus: null };
  }

  let spotify = null;
  let game = null;
  let customStatus = null;

  for (const act of presence.activities) {
    if (act.name === 'Spotify') {
      let albumCover = null;
      if (act.assets && act.assets.largeImage) {
        albumCover = `https://i.scdn.co/image/${act.assets.largeImage.replace('spotify:', '')}`;
      }
      spotify = {
        song: act.details || 'Không rõ tên bài hát',
        artist: act.state || 'Không rõ nghệ sĩ',
        album: act.assets?.largeText || 'Không rõ Album',
        albumCover
      };
    } else if (act.type === 4) { // Custom Status
      customStatus = act.state ? (act.emoji ? `${act.emoji.name} ${act.state}` : act.state) : null;
    } else if (act.type === 0 || act.type === 1 || act.type === 2 || act.type === 3 || act.type === 5) {
      game = {
        name: act.name,
        details: act.details,
        state: act.state,
        startTime: act.timestamps?.start ? Math.floor(new Date(act.timestamps.start).getTime() / 1000) : null
      };
    }
  }

  return { spotify, game, customStatus };
}

async function buildDeviceEmbed(client, guild, targetId, requester) {
  let user = null;
  try {
    user = await client.users.fetch(targetId, { force: true });
  } catch (e) {
    return null;
  }

  if (!user) return null;

  const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
  const presence = member ? member.presence : null;

  const devices = parseClientDevices(presence);
  const { spotify, game, customStatus } = parseActivities(presence);

  const embed = new EmbedBuilder()
    .setColor(presence ? 0x00FF88 : 0x95A5A6)
    .setTitle(`📱 SOI THIẾT BỊ & HOẠT ĐỘNG: ${user.globalName ? `${user.globalName} (@${user.username})` : `@${user.username}`}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
      { name: '📶 Trạng thái tổng thể', value: presence ? (STATUS_EMOJIS[presence.status] || '🟢 Online') : '⚪ Ngoại tuyến (Offline)', inline: true }
    );

  if (customStatus) {
    embed.addFields({ name: '💭 Trạng thái tùy chỉnh (Custom Status)', value: `> ${customStatus}`, inline: false });
  }

  embed.addFields({
    name: '📱 Thiết bị đang đăng nhập',
    value: devices.join('\n'),
    inline: false
  });

  // Spotify Information
  if (spotify) {
    embed.addFields({
      name: '🎵 Đang nghe nhạc trên Spotify',
      value: `🎶 **Bài hát:** \`${spotify.song}\`\n👤 **Nghệ sĩ:** \`${spotify.artist}\`\n💿 **Album:** \`${spotify.album}\``,
      inline: false
    });

    if (spotify.albumCover) {
      embed.setImage(spotify.albumCover);
    }
  }

  // Game Activity Information
  if (game) {
    const timeText = game.startTime ? `\n⏱️ **Bắt đầu chơi từ:** <t:${game.startTime}:R>` : '';
    const detailsText = game.details ? ` (${game.details})` : '';
    embed.addFields({
      name: '🎮 Đang chơi Game',
      value: `🎮 **Tựa game:** \`${game.name}\`${detailsText}${timeText}`,
      inline: false
    });
  }

  embed.setFooter({ text: `Yêu cầu bởi ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('device')
    .setDescription('Soi thiết bị đăng nhập (Mobile, Desktop, Web) và hoạt động real-time (Spotify, Game)')
    .addUserOption(opt => opt.setName('user').setDescription('Chọn thành viên trong Server').setRequired(false))
    .addStringOption(opt => opt.setName('user_id').setDescription('Nhập Discord User ID').setRequired(false)),

  async execute(interaction) {
    const userOpt = interaction.options.getUser('user');
    const userIdOpt = interaction.options.getString('user_id')?.trim();

    let targetId = interaction.user.id;
    if (userIdOpt) {
      targetId = userIdOpt.replace(/[<@!>]/g, '');
    } else if (userOpt) {
      targetId = userOpt.id;
    }

    const embed = await buildDeviceEmbed(interaction.client, interaction.guild, targetId, interaction.user);
    if (!embed) {
      return interaction.reply({ content: `❌ Không tìm thấy người dùng với ID: \`${targetId}\`!`, ephemeral: true });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    let targetId = message.author.id;

    if (message.mentions.users.size > 0) {
      targetId = message.mentions.users.first().id;
    } else if (args[0]) {
      targetId = args[0].replace(/[<@!>]/g, '');
    }

    const embed = await buildDeviceEmbed(message.client, message.guild, targetId, message.author);
    if (!embed) {
      return message.reply(`❌ Không tìm thấy người dùng Discord với ID hoặc Mention: \`${args[0]}\`!`);
    }

    await message.reply({ embeds: [embed] });
  }
};
