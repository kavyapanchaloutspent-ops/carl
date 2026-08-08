const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Cấu hình hệ thống chống Spam thông minh (Anti-Spam)')
    .addBooleanOption(opt => opt.setName('state').setDescription('True = Bật, False = Tắt').setRequired(false))
    .addIntegerOption(opt => opt.setName('limit').setDescription('Ngưỡng số tin nhắn tối đa trong 5s (Mặc định: 5)').setMinValue(3).setMaxValue(15).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const state = interaction.options.getBoolean('state');
    const limit = interaction.options.getInteger('limit');

    const config = await db.getGuildConfig(interaction.guild.id);

    if (state === null && limit === null) {
      const embed = new EmbedBuilder()
        .setColor(config.anti_spam_toggle ? 0x00FF00 : 0xFF0000)
        .setTitle('🛡️ CẤU HÌNH HỆ THỐNG ANTI-SPAM THÔNG MINH')
        .addFields(
          { name: '🔌 Trạng thái', value: config.anti_spam_toggle ? '✅ **ĐANG BẬT**' : '❌ **ĐANG TẮT**', inline: true },
          { name: '⚡ Ngưỡng giới hạn', value: `**${config.anti_spam_limit || 5} tin** / 5 giây`, inline: true },
          { name: '🧹 Tự động dọn dẹp', value: '✅ Đang kích hoạt (Bulk purge)', inline: true },
          { name: '📈 Phân cấp cách ly', value: '1️⃣ Cảnh báo DM\n2️⃣ Mute 1 phút\n3️⃣ Mute 10 phút\n4️⃣ Mute 1 giờ + Log\n5️⃣ Mute 24 giờ + Log', inline: false }
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
      const newState = state !== null ? state : config.anti_spam_toggle;
      const newLimit = limit !== null ? limit : (config.anti_spam_limit || 5);

      await db.pool.query(
        'UPDATE guild_configs SET anti_spam_toggle = $1, anti_spam_limit = $2 WHERE guild_id = $3',
        [newState, newLimit, interaction.guild.id]
      );

      await interaction.reply({
        content: `🔒 Đã cập nhật cấu hình **Anti-Spam**:\n- Trạng thái: **${newState ? 'KÍCH HOẠT ✅' : 'VÔ HIỆU HÓA ❌'}**\n- Ngưỡng giới hạn: **${newLimit} tin / 5 giây**`,
        ephemeral: true
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Lỗi cập nhật cấu hình bảo mật vào database!', ephemeral: true });
    }
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ Bạn cần có quyền `Manage Guild` để cấu hình bảo mật!');
    }

    const config = await db.getGuildConfig(message.guild.id);
    const subCmd = args[0]?.toLowerCase();

    if (!subCmd || subCmd === 'info' || subCmd === 'status') {
      const embed = new EmbedBuilder()
        .setColor(config.anti_spam_toggle ? 0x00FF00 : 0xFF0000)
        .setTitle('🛡️ CẤU HÌNH HỆ THỐNG ANTI-SPAM THÔNG MINH')
        .setDescription('Sử dụng `?antispam true/false` để bật/tắt hoặc `?antispam limit <3-15>` để đặt ngưỡng.')
        .addFields(
          { name: '🔌 Trạng thái', value: config.anti_spam_toggle ? '✅ **ĐANG BẬT**' : '❌ **ĐANG TẮT**', inline: true },
          { name: '⚡ Ngưỡng giới hạn', value: `**${config.anti_spam_limit || 5} tin** / 5 giây`, inline: true },
          { name: '🧹 Tự động dọn dẹp', value: '✅ Đang kích hoạt (Bulk Purge)', inline: true },
          { name: '📈 Phân cấp cách ly', value: '1️⃣ Cảnh báo DM\n2️⃣ Mute 1 phút\n3️⃣ Mute 10 phút\n4️⃣ Mute 1 giờ + Log\n5️⃣ Mute 24 giờ + Log', inline: false }
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (subCmd === 'true' || subCmd === 'false' || subCmd === 'on' || subCmd === 'off') {
      const state = subCmd === 'true' || subCmd === 'on';
      try {
        await db.pool.query(
          'UPDATE guild_configs SET anti_spam_toggle = $1 WHERE guild_id = $2',
          [state, message.guild.id]
        );
        return message.reply(`🔒 Tính năng **Anti-Spam** đã được thiết lập thành: **${state ? 'KÍCH HOẠT ✅' : 'VÔ HIỆU HÓA ❌'}**`);
      } catch (err) {
        console.error(err);
        return message.reply('❌ Thất bại khi ghi nhận cấu hình bảo mật!');
      }
    }

    if (subCmd === 'limit' || subCmd === 'setlimit') {
      const num = parseInt(args[1], 10);
      if (isNaN(num) || num < 3 || num > 15) {
        return message.reply('❌ Số lượng giới hạn phải là một số nguyên từ 3 đến 15 (VD: `?antispam limit 5`)!');
      }
      try {
        await db.pool.query(
          'UPDATE guild_configs SET anti_spam_limit = $1 WHERE guild_id = $2',
          [num, message.guild.id]
        );
        return message.reply(`⚡ Ngưỡng phát hiện **Anti-Spam** đã được đặt thành: **${num} tin / 5 giây**!`);
      } catch (err) {
        console.error(err);
        return message.reply('❌ Thất bại khi cập nhật giới hạn Anti-Spam!');
      }
    }

    message.reply('❌ Cú pháp không hợp lệ! Sử dụng `?antispam true/false`, `?antispam limit <3-15>` hoặc `?antispam info`.');
  }
};