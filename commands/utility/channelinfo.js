const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

const CHANNEL_TYPES = {
  [ChannelType.GuildText]: '💬 Kênh Văn Bản (Text)',
  [ChannelType.GuildVoice]: '🔊 Kênh Thoại (Voice)',
  [ChannelType.GuildCategory]: '📁 Thư Mục (Category)',
  [ChannelType.GuildAnnouncement]: '📢 Kênh Thông Báo (Announcement)',
  [ChannelType.GuildStageVoice]: '🎭 Kênh Sân Khấu (Stage)',
  [ChannelType.GuildForum]: '💡 Kênh Diễn Đàn (Forum)'
};

function buildChannelEmbed(channel, requester) {
  const channelTypeName = CHANNEL_TYPES[channel.type] || `Kênh dạng ${channel.type}`;
  const parentCategory = channel.parent ? channel.parent.name : 'Không thuộc danh mục';
  const slowmode = channel.rateLimitPerUser ? `${channel.rateLimitPerUser} giây` : 'Không có (Tắt)';

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`📺 Thông Tin Kênh: #${channel.name}`)
    .addFields(
      { name: '🆔 Channel ID', value: `\`${channel.id}\``, inline: true },
      { name: '📌 Kênh', value: `${channel}`, inline: true },
      { name: '📂 Loại kênh', value: channelTypeName, inline: true },

      { name: '📁 Danh mục cha', value: `\`${parentCategory}\``, inline: true },
      { name: '⏱️ Chế độ gửi chậm (Slowmode)', value: `\`${slowmode}\``, inline: true },
      { name: '🔞 Kênh nhạy cảm (NSFW)', value: channel.nsfw ? '🔞 **Có**' : '✅ **Không**', inline: true },

      { name: '📅 Ngày tạo kênh', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(channel.createdTimestamp / 1000)}:R>)`, inline: false }
    );

  if (channel.topic) {
    embed.addFields({ name: '📝 Chủ đề kênh (Topic)', value: channel.topic, inline: false });
  }

  embed.setFooter({ text: `Yêu cầu bởi ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Xem thông tin chi tiết của một Kênh trong Server')
    .addChannelOption(opt => opt.setName('channel').setDescription('Chọn Kênh cần xem').setRequired(false)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const embed = buildChannelEmbed(channel, interaction.user);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]) || message.channel;
    const embed = buildChannelEmbed(channel, message.author);
    await message.reply({ embeds: [embed] });
  }
};
