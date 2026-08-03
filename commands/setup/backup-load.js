const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database');

async function restoreBackup(guild, data) {
  await guild.roles.fetch();
  await guild.channels.fetch();
  let rolesCreated = 0, channelsCreated = 0;
  const errors = [];
  for (const saved of data.roles) {
    if (guild.roles.cache.some(role => !role.managed && role.name === saved.name)) continue;
    try {
      await guild.roles.create({ name: saved.name, color: saved.color || 0, hoist: Boolean(saved.hoist),
        permissions: saved.permissions || '0', mentionable: Boolean(saved.mentionable), reason: 'Restore server backup' });
      rolesCreated++;
    } catch (error) { errors.push(`role ${saved.name}: ${error.message}`); }
  }
  const ordered = [...data.channels.filter(c => c.type === 4), ...data.channels.filter(c => c.type !== 4)];
  const channelIdMap = new Map();
  for (const saved of ordered) {
    if (![0, 2, 4, 5, 13, 15].includes(saved.type)) continue;
    try {
      const parent = saved.parentId ? channelIdMap.get(saved.parentId) : undefined;
      let channel = guild.channels.cache.find(item => item.name === saved.name && item.type === saved.type &&
        (saved.type === 4 || !parent || item.parentId === parent));
      if (!channel) {
        channel = await guild.channels.create({ name: saved.name, type: saved.type, parent,
          position: saved.position, reason: 'Restore server backup' });
        channelsCreated++;
      }
      if (saved.id) channelIdMap.set(saved.id, channel.id);
    } catch (error) { errors.push(`channel ${saved.name}: ${error.message}`); }
  }
  return { rolesCreated, channelsCreated, errors };
}

function restoreMessage(code, data, result) {
  let text = `✅ Đã khôi phục \`${code}\`: tạo **${result.rolesCreated}/${data.roles.length} vai trò** và **${result.channelsCreated}/${data.channels.length} kênh**.`;
  if (result.errors.length) text += `\n⚠️ ${result.errors.length} mục bị lỗi: ${result.errors.slice(0, 3).join(' | ')}`;
  return text;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup-load')
    .setDescription('Khôi phục cấu hình máy chủ từ mã sao lưu')
    .addStringOption(opt => opt.setName('code').setDescription('Mã sao lưu của bạn').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Lệnh khôi phục máy chủ cực kỳ nguy hiểm, chỉ có Chủ sở hữu máy chủ mới được thực hiện!', ephemeral: true });
    }

    const code = interaction.options.getString('code').trim().toUpperCase();
    await interaction.deferReply({ ephemeral: true });

    try {
      const res = await db.pool.query('SELECT * FROM backups WHERE backup_id = $1', [code]);
      if (res.rows.length === 0) {
        return interaction.editReply({ content: '❌ Không tìm thấy bản sao lưu nào với mã được cung cấp!' });
      }

      await interaction.editReply({ content: '⚙️ Đang tiến hành khôi phục dữ liệu (xóa kênh cũ và tái tạo)...' });
      // Thao tác khôi phục thực tế sẽ xóa kênh cũ và tạo lại dựa trên dữ liệu JSONB
      // Để an toàn khi chạy thử, bot sẽ phản hồi thành công cấu trúc đọc được từ DB:
      const data = res.rows[0].backup_data;
      const result = await restoreBackup(interaction.guild, data);
      await interaction.editReply({ content: restoreMessage(code, data, result) });
    } catch (err) {
      await interaction.editReply({ content: `❌ Lỗi: ${err.message}` });
    }
  },

  async executePrefix(message, args) {
    if (message.author.id !== message.guild.ownerId) {
      return message.reply('❌ Lệnh khôi phục máy chủ chỉ có Chủ sở hữu máy chủ mới được sử dụng!');
    }

    const code = args[0]?.trim().toUpperCase();
    if (!code) return message.reply('❌ Vui lòng nhập mã sao lưu!');

    try {
      const res = await db.pool.query('SELECT * FROM backups WHERE backup_id = $1', [code]);
      if (res.rows.length === 0) return message.reply('❌ Mã sao lưu không tồn tại trong hệ thống!');

      const data = res.rows[0].backup_data;
      const result = await restoreBackup(message.guild, data);
      message.reply(restoreMessage(code, data, result));
    } catch (err) {
      message.reply(`❌ Lỗi: ${err.message}`);
    }
  }
};
