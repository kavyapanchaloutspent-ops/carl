const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

function hasHighestServerRole(member) {
  if (member.id === member.guild.ownerId) return true;
  const highestRole = member.guild.roles.cache
    .filter(role => role.id !== member.guild.id && !role.managed)
    .sort((a, b) => b.position - a.position)
    .first();
  return Boolean(highestRole && member.roles.cache.has(highestRole.id));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup-create')
    .setDescription('Tạo bản sao lưu cấu hình máy chủ hiện tại'),

  async execute(interaction) {
    if (!hasHighestServerRole(interaction.member)) {
      return interaction.reply({ content: '❌ Lệnh này chỉ dành cho người có role cao nhất server!', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      const roles = guild.roles.cache.filter(r => r.name !== '@everyone' && !r.managed).map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        permissions: r.permissions.bitfield.toString(),
        mentionable: r.mentionable,
        position: r.position
      }));

      const channels = guild.channels.cache.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId,
        position: c.position
      }));

      const backupData = { roles, channels };
      const backupId = `BU-${Date.now().toString(36).toUpperCase()}`;

      await db.pool.query(
        'INSERT INTO backups (backup_id, guild_id, creator_id, backup_data) VALUES ($1, $2, $3, $4)',
        [backupId, guild.id, interaction.user.id, JSON.stringify(backupData)]
      );

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ TẠO SAO LƯU THÀNH CÔNG')
        .setDescription(`Đã sao lưu cấu hình máy chủ thành công!\\n📦 Mã sao lưu của bạn: \`${backupId}\``)
        .addFields(
          { name: '👥 Tổng số vai trò', value: `${roles.length}`, inline: true },
          { name: '📺 Tổng số kênh', value: `${channels.length}`, inline: true }
        )
        .setFooter({ text: 'Lưu giữ mã này để khôi phục khi cần thiết' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: `❌ Lỗi tạo sao lưu: ${err.message}` });
    }
  },

  async executePrefix(message, args) {
    if (!hasHighestServerRole(message.member)) {
      return message.reply('❌ Lệnh này chỉ dành cho người có role cao nhất server!');
    }

    const replyMsg = await message.reply('🔄 Đang tiến hành tạo bản sao lưu cấu hình...');

    try {
      const guild = message.guild;
      const roles = guild.roles.cache.filter(r => r.name !== '@everyone' && !r.managed).map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        permissions: r.permissions.bitfield.toString(),
        mentionable: r.mentionable,
        position: r.position
      }));

      const channels = guild.channels.cache.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId,
        position: c.position
      }));

      const backupData = { roles, channels };
      const backupId = `BU-${Date.now().toString(36).toUpperCase()}`;

      await db.pool.query(
        'INSERT INTO backups (backup_id, guild_id, creator_id, backup_data) VALUES ($1, $2, $3, $4)',
        [backupId, guild.id, message.author.id, JSON.stringify(backupData)]
      );

      replyMsg.edit(`✅ **Tạo sao lưu thành công!**\\n📦 Mã sao lưu: \`${backupId}\` (Lưu giữ mã này để khôi phục khi cần)`);
    } catch (err) {
      replyMsg.edit(`❌ Lỗi tạo sao lưu: ${err.message}`);
    }
  }
};
