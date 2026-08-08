const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autonickname')
    .setDescription('Tự động đổi biệt danh cho thành viên mới khi vừa tham gia Server')
    .addStringOption(opt => opt.setName('format').setDescription('Mẫu biệt danh (VD: Member | {username}, nhập "off" để tắt)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const format = interaction.options.getString('format');
    const config = await db.getGuildConfig(interaction.guild.id);

    if (!format) {
      const embed = new EmbedBuilder()
        .setColor(0x00AAFF)
        .setTitle('🏷️ CẤU HÌNH AUTO-NICKNAME TỰ ĐỘNG')
        .setDescription('Cấu hình mẫu biệt danh tự động được đặt cho thành viên mới khi vào Server.')
        .addFields(
          { name: '📌 Mẫu hiện tại', value: config.auto_nickname_format ? `\`${config.auto_nickname_format}\`` : '❌ *Đang tắt*', inline: true },
          { name: '💡 Các biến hỗ trợ', value: '`{username}` - Tên tài khoản người dùng\n`{tag}` - Discord Tag\n`{server}` - Tên máy chủ', inline: false }
        )
        .setFooter({ text: 'Ví dụ thiết lập: /autonickname format: Member | {username}' })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (format.toLowerCase() === 'off' || format.toLowerCase() === 'disable') {
      await db.pool.query('UPDATE guild_configs SET auto_nickname_format = NULL WHERE guild_id = $1', [interaction.guild.id]);
      return interaction.reply({ content: '❌ Đã **tắt** tính năng tự động đặt biệt danh cho người mới!', ephemeral: true });
    }

    await db.pool.query('UPDATE guild_configs SET auto_nickname_format = $1 WHERE guild_id = $2', [format, interaction.guild.id]);
    return interaction.reply({
      content: `✅ Đã thiết lập mẫu **Auto-Nickname** thành: \`${format}\`\n*Mẫu thử nghiệm:* \`${format.replace(/{username}/g, interaction.user.username).replace(/{tag}/g, interaction.user.tag).replace(/{server}/g, interaction.guild.name)}\``,
      ephemeral: true
    });
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ Bạn cần có quyền `Manage Guild` để cấu hình Auto-Nickname!');
    }

    const config = await db.getGuildConfig(message.guild.id);
    const input = args.join(' ').trim();

    if (!input || input.toLowerCase() === 'status' || input.toLowerCase() === 'info') {
      const embed = new EmbedBuilder()
        .setColor(0x00AAFF)
        .setTitle('🏷️ CẤU HÌNH AUTO-NICKNAME TỰ ĐỘNG')
        .setDescription('Cấu hình mẫu biệt danh tự động được đặt cho thành viên mới khi vào Server.')
        .addFields(
          { name: '📌 Mẫu hiện tại', value: config.auto_nickname_format ? `\`${config.auto_nickname_format}\`` : '❌ *Đang tắt*', inline: true },
          { name: '💡 Các biến hỗ trợ', value: '`{username}` - Tên tài khoản người dùng\n`{tag}` - Discord Tag\n`{server}` - Tên máy chủ', inline: false }
        )
        .setFooter({ text: 'Sử dụng: ?autonickname Member | {username} (hoặc ?autonickname off)' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (input.toLowerCase() === 'off' || input.toLowerCase() === 'disable') {
      await db.pool.query('UPDATE guild_configs SET auto_nickname_format = NULL WHERE guild_id = $1', [message.guild.id]);
      return message.reply('❌ Đã **tắt** tính năng tự động đặt biệt danh cho người mới!');
    }

    await db.pool.query('UPDATE guild_configs SET auto_nickname_format = $1 WHERE guild_id = $2', [input, message.guild.id]);
    return message.reply(`✅ Đã thiết lập mẫu **Auto-Nickname** thành: \`${input}\`\n*Mẫu thử nghiệm:* \`${input.replace(/{username}/g, message.author.username).replace(/{tag}/g, message.author.tag).replace(/{server}/g, message.guild.name)}\``);
  }
};
