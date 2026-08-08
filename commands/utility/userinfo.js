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

async function buildUserEmbed(client, guild, targetId, requester) {
  let user = null;
  try {
    user = await client.users.fetch(targetId, { force: true });
  } catch (e) {
    return null;
  }

  if (!user) return null;

  const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;

  const embed = new EmbedBuilder()
    .setColor(member ? member.displayColor || 0x00AAFF : 0x00AAFF)
    .setTitle(`👤 Hồ Sơ Tài Khoản: ${user.globalName ? `${user.globalName} (@${user.username})` : `@${user.username}`}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
      { name: '🏷️ Tên tài khoản', value: `\`@${user.username}\``, inline: true },
      { name: '🤖 Loại tài khoản', value: user.bot ? '🤖 Bot' : '👤 Người dùng (Human)', inline: true },
      { name: '📅 Ngày tạo tài khoản', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: false }
    );

  // Parse Discord Flags / Badges
  try {
    const flags = await user.fetchFlags();
    const userBadges = flags.toArray().map(flag => BADGE_FLAGS[flag]).filter(Boolean);
    if (userBadges.length > 0) {
      embed.addFields({ name: '🎖️ Huy hiệu Discord', value: userBadges.join('\n'), inline: false });
    }
  } catch (e) {}

  // User Banner Image
  if (user.banner) {
    embed.setImage(user.bannerURL({ dynamic: true, size: 1024 }));
  }

  if (member) {
    const rolesList = member.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.toString());
    
    const displayRoles = rolesList.length > 0
      ? (rolesList.length > 6 ? `${rolesList.slice(0, 6).join(', ')}... (+${rolesList.length - 6} khác)` : rolesList.join(', '))
      : 'Không có vai trò';

    embed.addFields(
      { name: '📥 Ngày tham gia Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n(<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`, inline: true },
      { name: '🏷️ Biệt danh Server', value: member.nickname ? `\`${member.nickname}\`` : '*Không có*', inline: true },
      { name: '🎭 Vai trò cao nhất', value: `${member.roles.highest}`, inline: true },
      { name: `📜 Vai trò (${member.roles.cache.size - 1})`, value: displayRoles, inline: false }
    );

    // Timeout status
    if (member.isCommunicationDisabled()) {
      embed.addFields({ name: '🔇 Trạng thái cách ly', value: `Đang bị Mute/Timeout đến <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`, inline: false });
    }

    // Server Booster status
    if (member.premiumSinceTimestamp) {
      embed.addFields({ name: '⚡ Server Booster', value: `Đã Boost server từ <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`, inline: false });
    }

    // Key permissions
    const keyPermissions = [];
    if (member.permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push('Administrator');
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) keyPermissions.push('Manage Server');
    if (member.permissions.has(PermissionFlagsBits.ManageRoles)) keyPermissions.push('Manage Roles');
    if (member.permissions.has(PermissionFlagsBits.ManageChannels)) keyPermissions.push('Manage Channels');
    if (member.permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push('Ban Members');
    if (member.permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push('Kick Members');
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) keyPermissions.push('Manage Messages');

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