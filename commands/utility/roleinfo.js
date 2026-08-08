const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

function buildRoleEmbed(role, requester) {
  const memberCount = role.members.size;
  const hexColor = role.hexColor.toUpperCase();

  const keyPermissions = [];
  if (role.permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push('Administrator');
  if (role.permissions.has(PermissionFlagsBits.ManageGuild)) keyPermissions.push('Manage Server');
  if (role.permissions.has(PermissionFlagsBits.ManageRoles)) keyPermissions.push('Manage Roles');
  if (role.permissions.has(PermissionFlagsBits.ManageChannels)) keyPermissions.push('Manage Channels');
  if (role.permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push('Ban Members');
  if (role.permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push('Kick Members');
  if (role.permissions.has(PermissionFlagsBits.ManageMessages)) keyPermissions.push('Manage Messages');
  if (role.permissions.has(PermissionFlagsBits.MentionEveryone)) keyPermissions.push('Mention Everyone');

  const permText = keyPermissions.length > 0 ? keyPermissions.map(p => `\`${p}\``).join(', ') : 'Không có quyền hạn cao đặc biệt';

  return new EmbedBuilder()
    .setColor(role.color || 0x99AAB5)
    .setTitle(`🎭 Thông Tin Vai Trò: ${role.name}`)
    .addFields(
      { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true },
      { name: '🏷️ Vai trò', value: `${role}`, inline: true },
      { name: '🎨 Mã màu', value: `\`${hexColor}\``, inline: true },

      { name: '👥 Số thành viên sở hữu', value: `**${memberCount}** người dùng`, inline: true },
      { name: '📊 Thứ tự vị trí', value: `**${role.position}**`, inline: true },
      { name: '⚙️ Tính chất', value: `Hiển thị riêng: ${role.hoist ? '✅' : '❌'}\nCho phép tag: ${role.mentionable ? '✅' : '❌'}\nTạo bởi tích hợp: ${role.managed ? '✅' : '❌'}`, inline: true },

      { name: '📅 Ngày tạo vai trò', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(role.createdTimestamp / 1000)}:R>)`, inline: false },
      { name: '🔑 Quyền hạn nổi bật', value: permText, inline: false }
    )
    .setFooter({ text: `Yêu cầu bởi ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Xem thông tin chi tiết của một Vai trò/Role trong Server')
    .addRoleOption(opt => opt.setName('role').setDescription('Chọn Vai trò/Role cần xem').setRequired(true)),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const embed = buildRoleEmbed(role, interaction.user);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role) {
      return message.reply('❌ Vui lòng tag một vai trò hoặc nhập Role ID hợp lệ (VD: `?roleinfo @Admin` hoặc `?roleinfo 123456789`)!');
    }

    const embed = buildRoleEmbed(role, message.author);
    await message.reply({ embeds: [embed] });
  }
};
