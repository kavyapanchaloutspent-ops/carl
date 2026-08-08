const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function buildHelpEmbed() {
  return new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('📖 DANH SÁCH LỆNH HỆ THỐNG BOT')
    .setDescription(
      `**🛠️ Điều hành (Moderation):**\n` +
      `└ \`?mute <7d/2h/5m>\` *(Reply tin nhắn người cần Mute hoặc Tag @user)*\n` +
      `└ \`?timeout\`, \`?ban\`, \`?kick\`, \`?unban\`, \`?purge\`, \`?slowmode\`, \`?lock\`, \`?unlock\`, \`?warn\`, \`?clearwarn\`\n\n` +
      `**🔒 Bảo mật & Anti-Spam thông minh:**\n` +
      `└ \`?antispam true/false\` *(Bật/tắt anti-spam)*\n` +
      `└ \`?antispam limit <3-15>\` *(Đặt ngưỡng số tin/5s)*\n` +
      `└ \`?antispam info\` *(Xem cấu hình anti-spam)*\n` +
      `└ \`?antimention\`, \`?antilink\`, \`?antiinvite\`, \`?antiraid\`\n\n` +
      `**⚙️ Cấu hình máy chủ:**\n` +
      `└ \`?autonickname Member | {username}\` *(Tự đổi tên người mới)*\n` +
      `└ \`?autorole\`, \`?customcmd\`, \`?sticky\`, \`?setup-welcome\`, \`?setup-verification\`\n\n` +
      `**🎨 Tiện ích & Đổi biệt danh:**\n` +
      `└ \`?snipe\` *(Xem lại tin nhắn vừa bị xóa gần đây nhất trong kênh)*\n` +
      `└ \`?nickname all/bots/humans <tên_mới>\` *(Đổi biệt danh hàng loạt)*\n` +
      `└ \`?userinfo <@user|ID>\` *(Tra cứu tài khoản trong & ngoài Server bằng ID)*\n` +
      `└ \`?serverinfo\` *(Xem chi tiết máy chủ & thành viên)*\n` +
      `└ \`?botinfo\`, \`?roleinfo\`, \`?channelinfo\`, \`?av\`, \`?banner\`, \`?ping\`, \`?remind\`, \`?poll\`, \`?embed\``
    )
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hiển thị danh sách các lệnh cấu hình, bảo mật và tiện ích'),

  async execute(interaction) {
    const embed = buildHelpEmbed();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async executePrefix(message, args) {
    const embed = buildHelpEmbed();
    message.reply({ embeds: [embed] });
  }
};