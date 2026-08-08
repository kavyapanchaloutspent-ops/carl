const { EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
  name: 'messageDelete',
  async execute(message, client) {
    if (message.author?.bot || !message.guild) return;

    // 1. Lưu bộ nhớ đệm Snipe (xem lại tin vừa xóa trong kênh)
    if (client && client.snipes) {
      client.snipes.set(message.channel.id, {
        author: message.author,
        content: message.content || '*Không có văn bản*',
        attachment: message.attachments.first()?.url || null,
        createdAt: message.createdTimestamp,
        deletedAt: Date.now()
      });
    }

    // 2. Gửi thông báo trực tiếp vào kênh chat nơi tin nhắn bị xóa
    try {
      const config = await db.getGuildConfig(message.guild.id);
      const deletedText = message.content ? message.content.slice(0, 1024) : '*[Hình ảnh / Đính kèm / Không có văn bản]*';
      const hasGhostPing = message.mentions.users.size > 0;

      const embed = new EmbedBuilder()
        .setColor(hasGhostPing ? 0xFF0000 : 0xE74C3C)
        .setTitle(hasGhostPing ? '👻 PHÁT HIỆN GHOST PING (TAG RỒI XÓA TIN)' : '🗑️ THÔNG BÁO XÓA TIN NHẮN')
        .setDescription(
          `💬 **NỘI DUNG TIN NHẮN MÀ <@${message.author.id}> ĐÃ XÓA LÀ:**\n` +
          `>>> ${deletedText}`
        )
        .setFooter({ text: `Tác giả: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      if (message.attachments.first()) {
        embed.setImage(message.attachments.first().url);
      }

      // Gửi thông báo trực tiếp ngay tại kênh vừa xóa tin
      await message.channel.send({ embeds: [embed] }).catch(() => {});

      // Đồng thời ghi nhật ký vào log_channel_id nếu đã cấu hình kênh log riêng khác kênh hiện tại
      if (config.log_channel_id && config.log_channel_id !== message.channel.id) {
        const logChannel = message.guild.channels.cache.get(config.log_channel_id);
        if (logChannel) {
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
};