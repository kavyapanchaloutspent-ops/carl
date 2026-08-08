const { SlashCommandBuilder, EmbedBuilder, version: djsVersion } = require('discord.js');
const process = require('process');

function formatUptime(uptimeMs) {
  const seconds = Math.floor((uptimeMs / 1000) % 60);
  const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
  const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  return `${days} ngày, ${hours} giờ, ${minutes} phút, ${seconds} giây`;
}

function buildBotInfoEmbed(client, requester) {
  const uptime = formatUptime(client.uptime);
  const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  const totalGuilds = client.guilds.cache.size;
  const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

  return new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle(`🤖 Thông Tin Bot: ${client.user.username}`)
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: '🆔 Bot ID', value: `\`${client.user.id}\``, inline: true },
      { name: '🏷️ Tên đăng nhập', value: `\`@${client.user.tag}\``, inline: true },
      { name: '📶 Độ trễ (Ping)', value: `\`${client.ws.ping}ms\``, inline: true },

      { name: '🏛️ Tổng máy chủ', value: `**${totalGuilds}** Server`, inline: true },
      { name: '👥 Tổng người dùng', value: `**${totalUsers}** Thành viên`, inline: true },
      { name: '⏳ Thời gian hoạt động', value: `\`${uptime}\``, inline: false },

      { name: '💻 Môi trường', value: `Node.js: \`${process.version}\` | Discord.js: \`v${djsVersion}\``, inline: true },
      { name: '🧠 Dung lượng RAM', value: `\`${ramUsage} MB\``, inline: true }
    )
    .setFooter({ text: `Yêu cầu bởi ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Xem thông số kỹ thuật và trạng thái hoạt động của Bot'),

  async execute(interaction) {
    const embed = buildBotInfoEmbed(interaction.client, interaction.user);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const embed = buildBotInfoEmbed(message.client, message.author);
    await message.reply({ embeds: [embed] });
  }
};
