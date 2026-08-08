const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

const VERIFICATION_LEVELS = {
  0: '🟢 Không (None)',
  1: '🟡 Thấp (Low)',
  2: '🟠 Trung bình (Medium)',
  3: '🔴 Cao (High)',
  4: '🛡️ Rất cao (Highest)'
};

const EXPLICIT_FILTER = {
  0: '❌ Tắt (Disabled)',
  1: '⚠️ Thành viên không vai trò',
  2: '🛡️ Kiểm tra tất cả tin nhắn'
};

async function buildServerEmbed(guild, requester) {
  const owner = await guild.fetchOwner().catch(() => null);
  const ownerText = owner ? `<@${guild.ownerId}> (\`${owner.user.tag}\`)` : `<@${guild.ownerId}>`;

  // Fetch all members if needed to get accurate bot/human count
  await guild.members.fetch().catch(() => {});
  const totalMembers = guild.memberCount;
  const botCount = guild.members.cache.filter(m => m.user.bot).size;
  const humanCount = totalMembers - botCount;

  // Channel Breakdown
  const channels = guild.channels.cache;
  const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
  const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
  const newsChannels = channels.filter(c => c.type === ChannelType.GuildAnnouncement).size;
  const stageChannels = channels.filter(c => c.type === ChannelType.GuildStageVoice).size;
  const forumChannels = channels.filter(c => c.type === ChannelType.GuildForum).size;
  const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

  // Emojis & Stickers
  const emojis = guild.emojis.cache;
  const staticEmojis = emojis.filter(e => !e.animated).size;
  const animatedEmojis = emojis.filter(e => e.animated).size;
  const stickerCount = guild.stickers.cache.size;

  // Roles
  const roleCount = guild.roles.cache.size;

  // Boosters
  const boosterCount = guild.members.cache.filter(m => m.premiumSinceTimestamp).size;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🏛️ Thông Tin Chi Tiết Máy Chủ: ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
      { name: '👑 Chủ sở hữu', value: ownerText, inline: true },
      { name: '📅 Ngày thành lập', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: false },

      { name: '👥 Thành viên', value: `👤 Người dùng: **${humanCount}**\n🤖 Bots: **${botCount}**\n📊 Tổng số: **${totalMembers}**`, inline: true },
      { name: '📺 Kênh chat', value: `💬 Văn bản: **${textChannels}** | 🔊 Thoại: **${voiceChannels}**\n📢 Thông báo: **${newsChannels}** | 💡 Forum: **${forumChannels}**\n📁 Danh mục: **${categories}** (Tổng: **${channels.size}**)`, inline: true },
      { name: '🎨 Tài nguyên', value: `🎭 Vai trò: **${roleCount}**\n😀 Emojis: **${emojis.size}** (*${staticEmojis} tĩnh, ${animatedEmojis} động*)\n🏷️ Stickers: **${stickerCount}**`, inline: true },

      { name: '⚡ Cấp độ Boost', value: `Cấp **${guild.premiumTier}** (${guild.premiumSubscriptionCount || 0} Boosts)\n💎 Số người Boost: **${boosterCount}**`, inline: true },
      { name: '🔒 Cấp độ bảo mật', value: `Xác minh: ${VERIFICATION_LEVELS[guild.verificationLevel] || 'Không rõ'}\nBộ lọc tin nhắn: ${EXPLICIT_FILTER[guild.explicitContentFilter] || 'Không rõ'}`, inline: true }
    );

  if (guild.description) {
    embed.setDescription(`📝 **Mô tả máy chủ:** ${guild.description}`);
  }

  if (guild.banner) {
    embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
  }

  embed.setFooter({ text: `Yêu cầu bởi ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Xem thông tin tổng quan chi tiết của máy chủ Discord'),

  async execute(interaction) {
    const embed = await buildServerEmbed(interaction.guild, interaction.user);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const embed = await buildServerEmbed(message.guild, message.author);
    await message.reply({ embeds: [embed] });
  }
};