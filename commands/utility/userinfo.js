const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const BADGE_FLAGS = {
  Staff: '👑 Discord Staff',
  Partner: '🌟 Partnered Server Owner',
  Hypesquad: '🎉 HypeSquad Events',
  BugHunterLevel1: '🐛 Bug Hunter Lvl 1',
  BugHunterLevel2: '🐛 Bug Hunter Lvl 2',
  HypeSquadOnlineHouse1: '🏠 HypeSquad Bravery',
  HypeSquadOnlineHouse2: '🏠 HypeSquad Brilliance',
  HypeSquadOnlineHouse3: '🏠 HypeSquad Balance',
  PremiumEarlySupporter: '💎 Early Supporter',
  VerifiedBot: '🤖 Verified Bot',
  VerifiedDeveloper: '👨‍💻 Early Verified Bot Developer',
  ActiveDeveloper: '👨‍💻 Active Developer',
  CertifiedModerator: '🛡️ Moderation Programs Alumni'
};

const db = require('../../database');

const STATUS_EMOJIS = {
  online: '🟢 Online',
  idle: '🌙 Treo máy',
  dnd: '🔴 Đừng làm phiền',
  offline: '⚪ Offline'
};

function calculateTrustScore(user, member) {
  let score = 50;

  const accountAgeDays = (Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24);
  if (accountAgeDays > 365) score += 20;
  else if (accountAgeDays > 30) score += 10;
  else if (accountAgeDays < 7) score -= 30;

  if (user.avatar) score += 10;
  if (user.banner) score += 10;

  if (member) {
    const joinDays = (Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24);
    if (joinDays > 180) score += 10;

    if (member.premiumSinceTimestamp) score += 15;
    if (member.isCommunicationDisabled()) score -= 25;
  }

  score = Math.max(0, Math.min(100, score));

  let rating = '🟢 SAFE (An toàn)';
  if (score < 40) rating = '🔴 CRITICAL (Rủi ro cao / Acc Clone nghi vấn)';
  else if (score < 70) rating = '🟡 MEDIUM (Bình thường)';

  return { score, rating };
}

function parseClientDevices(presence) {
  if (!presence || !presence.clientStatus) return '⚪ Ngoại tuyến / Ẩn danh';
  const devices = [];
  if (presence.clientStatus.desktop) devices.push(`💻 Desktop (${STATUS_EMOJIS[presence.clientStatus.desktop] || 'Online'})`);
  if (presence.clientStatus.mobile) devices.push(`📱 Mobile (${STATUS_EMOJIS[presence.clientStatus.mobile] || 'Online'})`);
  if (presence.clientStatus.web) devices.push(`🌐 Web (${STATUS_EMOJIS[presence.clientStatus.web] || 'Online'})`);
  return devices.length > 0 ? devices.join(' | ') : '⚪ Ngoại tuyến / Ẩn danh';
}

function parseActivities(presence) {
  if (!presence || !presence.activities || presence.activities.length === 0) {
    return { spotify: null, game: null };
  }

  let spotify = null;
  let game = null;

  for (const act of presence.activities) {
    if (act.name === 'Spotify') {
      let albumCover = null;
      if (act.assets && act.assets.largeImage) {
        albumCover = `https://i.scdn.co/image/${act.assets.largeImage.replace('spotify:', '')}`;
      }
      spotify = {
        song: act.details || 'Không rõ tên bài hát',
        artist: act.state || 'Không rõ nghệ sĩ',
        albumCover
      };
    } else if (act.type === 0 || act.type === 1 || act.type === 2 || act.type === 3 || act.type === 5) {
      game = {
        name: act.name,
        startTime: act.timestamps?.start ? Math.floor(new Date(act.timestamps.start).getTime() / 1000) : null
      };
    }
  }

  return { spotify, game };
}

async function buildUserEmbed(client, guild, targetId, requester) {
  let user = null;
  try {
    user = await client.users.fetch(targetId, { force: true });
  } catch (e) {
    return null;
  }

  if (!user) return null;

  const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
  const presence = member ? member.presence : null;

  const { score, rating } = calculateTrustScore(user, member);
  const devicesText = parseClientDevices(presence);
  const { spotify, game } = parseActivities(presence);

  // Thống kê lịch sử trong Database
  const nameHisCount = await db.pool.query('SELECT COUNT(*) FROM user_name_history WHERE user_id = $1', [user.id]).then(r => r.rows[0].count).catch(() => 0);
  const avHisCount = await db.pool.query('SELECT COUNT(*) FROM user_avatar_history WHERE user_id = $1', [user.id]).then(r => r.rows[0].count).catch(() => 0);
  const warnCount = guild ? await db.pool.query('SELECT COUNT(*) FROM warnings WHERE guild_id = $1 AND user_id = $2', [guild.id, user.id]).then(r => r.rows[0].count).catch(() => 0) : 0;

  // Tính vị trí gia nhập Server
  let joinPositionText = 'Không rõ';
  if (member && guild) {
    await guild.members.fetch().catch(() => {});
    const sortedMembers = guild.members.cache.sort((a, b) => a.joinedTimestamp - b.joinedTimestamp).map(m => m.id);
    const pos = sortedMembers.indexOf(member.id) + 1;
    if (pos > 0) joinPositionText = `**#${pos}** / ${guild.memberCount}`;
  }

  const embed = new EmbedBuilder()
    .setColor(member ? member.displayColor || 0x00AAFF : 0x00AAFF)
    .setTitle(`👤 ULTRA USER LOOKUP: ${user.globalName ? `${user.globalName} (@${user.username})` : `@${user.username}`}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
      { name: '🏷️ Tên tài khoản', value: `\`@${user.username}\``, inline: true },
      { name: '🤖 Loại tài khoản', value: user.bot ? '🤖 Bot' : '👤 Người dùng (Human)', inline: true },

      { name: '🛡️ Điểm tin cậy (Trust Score)', value: `**${score}%** — ${rating}`, inline: false },
      { name: '📱 Thiết bị đăng nhập', value: devicesText, inline: false },

      { name: '📅 Ngày tạo tài khoản', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: false }
    );

  // Spotify / Game Activity
  if (spotify) {
    embed.addFields({ name: '🎵 Đang nghe nhạc trên Spotify', value: `🎶 **${spotify.song}** — \`${spotify.artist}\``, inline: false });
    if (spotify.albumCover) embed.setImage(spotify.albumCover);
  } else if (game) {
    const timeText = game.startTime ? ` (<t:${game.startTime}:R>)` : '';
    embed.addFields({ name: '🎮 Đang chơi Game', value: `🎮 **${game.name}**${timeText}`, inline: false });
  }

  // Parse Discord Badges
  try {
    const flags = await user.fetchFlags();
    const userBadges = flags.toArray().map(flag => BADGE_FLAGS[flag]).filter(Boolean);
    if (userBadges.length > 0) {
      embed.addFields({ name: '🎖️ Huy hiệu Discord', value: userBadges.join('\n'), inline: false });
    }
  } catch (e) {}

  // Banner nếu có (và chưa bị đè bởi Spotify Album Cover)
  if (user.banner && !spotify?.albumCover) {
    embed.setImage(user.bannerURL({ dynamic: true, size: 1024 }));
  }

  if (member) {
    const rolesList = member.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.toString());
    
    const displayRoles = rolesList.length > 0
      ? (rolesList.length > 5 ? `${rolesList.slice(0, 5).join(', ')}... (+${rolesList.length - 5} khác)` : rolesList.join(', '))
      : 'Không có vai trò';

    embed.addFields(
      { name: '📥 Ngày tham gia Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n(<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`, inline: true },
      { name: '🔢 Vị trí gia nhập', value: joinPositionText, inline: true },
      { name: '🎭 Vai trò cao nhất', value: `${member.roles.highest}`, inline: true },
      { name: `📜 Vai trò (${member.roles.cache.size - 1})`, value: displayRoles, inline: false },
      { name: '📊 Thống kê bộ nhớ Bot', value: `📝 Lịch sử đổi tên: **${nameHisCount}** lần\n🖼️ Lịch sử avatar: **${avHisCount}** lần\n⚠️ Cảnh cáo vi phạm: **${warnCount}** lần`, inline: false }
    );

    if (member.isCommunicationDisabled()) {
      embed.addFields({ name: '🔇 Trạng thái cách ly', value: `Đang bị Mute đến <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`, inline: false });
    }

    if (member.premiumSinceTimestamp) {
      embed.addFields({ name: '⚡ Server Booster', value: `Đã Boost server từ <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`, inline: false });
    }

    const keyPermissions = [];
    if (member.permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push('Administrator');
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) keyPermissions.push('Manage Server');
    if (member.permissions.has(PermissionFlagsBits.ManageRoles)) keyPermissions.push('Manage Roles');
    if (member.permissions.has(PermissionFlagsBits.ManageChannels)) keyPermissions.push('Manage Channels');
    if (member.permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push('Ban Members');
    if (member.permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push('Kick Members');

    if (keyPermissions.length > 0) {
      embed.addFields({ name: '🔑 Quyền hạn chính', value: keyPermissions.map(p => `\`${p}\``).join(', '), inline: false });
    }
  } else {
    embed.addFields({ name: '🌐 Trạng thái máy chủ', value: '🌐 **Người dùng Discord toàn cầu (Ngoài máy chủ này)**', inline: false });
  }

  embed.setFooter({ text: `Yêu cầu bởi ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Xem thông tin chi tiết hồ sơ tài khoản (Hỗ trợ tra cứu ngoài Server bằng ID)')
    .addUserOption(opt => opt.setName('user').setDescription('Chọn người dùng trong Server').setRequired(false))
    .addStringOption(opt => opt.setName('user_id').setDescription('Nhập Discord User ID để tra cứu ngoài Server').setRequired(false)),

  async execute(interaction) {
    const userOption = interaction.options.getUser('user');
    const userIdOption = interaction.options.getString('user_id')?.trim();

    let targetId = interaction.user.id;
    if (userIdOption) {
      targetId = userIdOption.replace(/[<@!>]/g, '');
    } else if (userOption) {
      targetId = userOption.id;
    }

    const embed = await buildUserEmbed(interaction.client, interaction.guild, targetId, interaction.user);
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

    const embed = await buildUserEmbed(message.client, message.guild, targetId, message.author);
    if (!embed) {
      return message.reply(`❌ Không tìm thấy người dùng Discord với ID hoặc Mention: \`${args[0]}\`!`);
    }

    await message.reply({ embeds: [embed] });
  }
};