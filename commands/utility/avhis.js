const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

async function buildAvatarHistoryEmbed(client, targetId, requester) {
  let user = null;
  try {
    user = await client.users.fetch(targetId, { force: true });
  } catch (e) {
    return null;
  }

  if (!user) return null;

  const currentAvatarUrl = user.displayAvatarURL({ dynamic: true, size: 1024 });

  const res = await db.pool.query(
    'SELECT * FROM user_avatar_history WHERE user_id = $1 ORDER BY changed_at DESC LIMIT 10',
    [user.id]
  ).catch(() => ({ rows: [] }));

  const history = res.rows;

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`🖼️ LỊCH SỬ THAY AVATAR: ${user.globalName ? `${user.globalName} (@${user.username})` : `@${user.username}`}`)
    .setThumbnail(currentAvatarUrl)
    .setImage(currentAvatarUrl)
    .addFields(
      { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
      { name: '🖼️ Avatar hiện tại', value: `[Tải Avatar chất lượng cao](${currentAvatarUrl})`, inline: true }
    );

  if (history.length === 0) {
    embed.addFields({
      name: '📝 Nhật ký Avatar',
      value: '❌ *Chưa ghi nhận lần thay avatar nào trong bộ nhớ (Hệ thống tự động ghi vết mỗi khi tài khoản thay avatar mới).*',
      inline: false
    });
  } else {
    const historyLines = history.map((h, i) => {
      const timeTag = `<t:${Math.floor(new Date(h.changed_at).getTime() / 1000)}:R>`;
      return `**${i + 1}.** 🖼️ [Xem ảnh Avatar mẫu #${i + 1}](${h.avatar_url}) — ${timeTag}`;
    });

    embed.addFields({
      name: `📝 Lịch sử ảnh đại diện (${history.length} lần gần nhất)`,
      value: historyLines.join('\n'),
      inline: false
    });
  }

  embed.setFooter({ text: `Yêu cầu bởi ${requester.username}`, iconURL: requester.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avhis')
    .setDescription('Xem lịch sử thay đổi Avatar/Ảnh đại diện toàn cầu của một người dùng')
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

    const embed = await buildAvatarHistoryEmbed(interaction.client, targetId, interaction.user);
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

    const embed = await buildAvatarHistoryEmbed(message.client, targetId, message.author);
    if (!embed) {
      return message.reply(`❌ Không tìm thấy người dùng Discord với ID hoặc Mention: \`${args[0]}\`!`);
    }

    await message.reply({ embeds: [embed] });
  }
};
