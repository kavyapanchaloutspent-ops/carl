const { SlashCommandBuilder, EmbedBuilder, AuditLogEvent } = require('discord.js');
const db = require('../../database');

const CHANGE_TYPES = {
  username: '🏷️ Username Discord',
  global_name: '👤 Global Display Name',
  nickname: '🎭 Biệt danh Server'
};

async function buildNameHistoryEmbed(client, guild, targetId, requester) {
  let user = null;
  try {
    user = await client.users.fetch(targetId, { force: true });
  } catch (e) {
    return null;
  }

  if (!user) return null;

  const res = await db.pool.query(
    'SELECT * FROM user_name_history WHERE user_id = $1 ORDER BY changed_at DESC LIMIT 15',
    [user.id]
  ).catch(() => ({ rows: [] }));

  const history = res.rows;

  // 🔍 QUÉT THÊM NHẬT KÝ SERVER (AUDIT LOGS) ĐỂ LẤY CẢ TÊN CŨ TRƯỚC KHI BOT HOẠT ĐỘNG
  if (guild) {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
        limit: 50
      }).catch(() => null);

      if (auditLogs) {
        const userLogs = auditLogs.entries.filter(entry => entry.target && entry.target.id === user.id);
        for (const [, entry] of userLogs) {
          const change = entry.changes?.find(c => c.key === 'nick');
          if (change) {
            const oldNick = change.old || `(Gốc: ${user.username})`;
            const newNick = change.new || `(Khôi phục: ${user.username})`;
            // Kiểm tra tránh trùng lặp
            const exists = history.some(h => h.old_name === oldNick && h.new_name === newNick);
            if (!exists) {
              history.push({
                old_name: oldNick,
                new_name: newNick,
                change_type: 'nickname',
                changed_at: entry.createdAt
              });
            }
          }
        }
      }
    } catch (e) {}
  }

  // Sắp xếp lại lịch sử theo thời gian mới nhất
  history.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`📜 LỊCH SỬ ĐỔI TÊN & BIỆT DANH: ${user.globalName ? `${user.globalName} (@${user.username})` : `@${user.username}`}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
      { name: '🏷️ Username hiện tại', value: `\`@${user.username}\``, inline: true },
      { name: '👤 Tên hiển thị hiện tại', value: user.globalName ? `\`${user.globalName}\`` : '*Không có*', inline: true }
    );

  if (history.length === 0) {
    embed.addFields({
      name: '📝 Nhật ký lịch sử',
      value: '❌ *Chưa ghi nhận lịch sử đổi tên nào cho tài khoản này (Hệ thống tự động ghi lại mỗi khi có thay đổi mới).*',
      inline: false
    });
  } else {
    const historyLines = history.map((h, i) => {
      const typeText = CHANGE_TYPES[h.change_type] || '📌 Đổi tên';
      const timeTag = `<t:${Math.floor(new Date(h.changed_at).getTime() / 1000)}:R>`;
      return `**${i + 1}.** [${typeText}]\n└ \`${h.old_name}\` ➔ **\`${h.new_name}\`** (${timeTag})`;
    });

    embed.addFields({
      name: `📝 Lịch sử thay đổi (${history.length} lần gần nhất)`,
      value: historyLines.join('\n\n').slice(0, 1024),
      inline: false
    });
  }

  embed.setFooter({ text: `Yêu cầu bởi ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('namehis')
    .setDescription('Xem lịch sử đổi tên và biệt danh toàn cầu của một người dùng')
    .addUserOption(opt => opt.setName('user').setDescription('Chọn người dùng trong Server').setRequired(false))
    .addStringOption(opt => opt.setName('user_id').setDescription('Nhập Discord User ID').setRequired(false)),

  async execute(interaction) {
    const userOpt = interaction.options.getUser('user');
    const userIdOpt = interaction.options.getString('user_id')?.trim();

    let targetId = interaction.user.id;
    if (userIdOpt) {
      targetId = userIdOpt.replace(/[<@!>]/g, '');
    } else if (userOpt) {
      targetId = userOpt.id;
    }

    const embed = await buildNameHistoryEmbed(interaction.client, interaction.guild, targetId, interaction.user);
    if (!embed) {
      return interaction.reply({ content: `❌ Không tìm thấy người dùng với ID: \`${targetId}\`!`, ephemeral: true });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    let targetId = message.author.id;

    if (message.mentions.users.size > 0) {
      targetId = message.mentions.users.first().id;
    } else if (args[0]) {
      targetId = args[0].replace(/[<@!>]/g, '');
    }

    const embed = await buildNameHistoryEmbed(message.client, message.guild, targetId, message.author);
    if (!embed) {
      return message.reply(`❌ Không tìm thấy người dùng Discord với ID hoặc Mention: \`${args[0]}\`!`);
    }

    await message.reply({ embeds: [embed] });
  }
};
