const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function parseDuration(str) {
  if (!str) return null;
  const match = str.trim().toLowerCase().match(/^(\d+)([s|m|h|d|w]?)$/);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2] || 's';
  let seconds = val;
  if (unit === 's') seconds = val;
  else if (unit === 'm') seconds = val * 60;
  else if (unit === 'h') seconds = val * 3600;
  else if (unit === 'd') seconds = val * 86400;
  else if (unit === 'w') seconds = val * 604800;
  return seconds;
}

function formatDurationText(seconds) {
  if (seconds < 60) return `${seconds} giây`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày`;
  return `${Math.floor(seconds / 604800)} tuần`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Cách ly/Mute thành viên vi phạm (Hỗ trợ định dạng thời gian 10s, 5m, 2h, 7d)')
    .addUserOption(opt => opt.setName('user').setDescription('Thành viên cần Mute').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Thời gian (VD: 10s, 5m, 1h, 7d)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Lý do cách ly').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'Không có lý do cụ thể';

    if (!target) return interaction.reply({ content: '❌ Không tìm thấy thành viên này trong Server!', ephemeral: true });
    if (!target.moderatable) return interaction.reply({ content: '❌ Bot không đủ thẩm quyền để Mute/Timeout thành viên này!', ephemeral: true });

    const seconds = parseDuration(durationInput);
    if (!seconds || seconds <= 0 || seconds > 28 * 86400) {
      return interaction.reply({ content: '❌ Thời gian không hợp lệ! Vui lòng nhập định dạng như: `10s`, `5m`, `2h`, `7d` (Tối đa 28 ngày).', ephemeral: true });
    }

    try {
      await target.timeout(seconds * 1000, reason);
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('🔇 CÁCH LY THÀNH VIÊN (MUTE)')
        .setDescription(`Đã tạm thời Mute/Cách ly thành công **${target.user.tag}**`)
        .addFields(
          { name: '👤 Đối tượng', value: `<@${target.id}> (\`${target.id}\`)`, inline: true },
          { name: '⏳ Thời gian cách ly', value: `**${formatDurationText(seconds)}** (\`${seconds}s\`)`, inline: true },
          { name: '📝 Lý do', value: reason, inline: false }
        )
        .setFooter({ text: `Thực hiện bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ Lỗi khi thực thi Mute: ${err.message}`, ephemeral: true });
    }
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ Bạn không có quyền `Moderate Members` để sử dụng lệnh Mute!');
    }

    let targetMember = null;
    let durationStr = null;
    let reason = 'Không có lý do cụ thể';

    // 🎯 Kiểm tra nếu lệnh được gửi dưới dạng REPLIES (Trả lời tin nhắn người khác)
    if (message.reference && message.reference.messageId) {
      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMsg && repliedMsg.author) {
          targetMember = await message.guild.members.fetch(repliedMsg.author.id).catch(() => null);
        }
      } catch (e) {}
    }

    // Nếu có tag hoặc truyền ID ở tham số đầu tiên
    const firstArgIsUser = args[0] && (args[0].startsWith('<@') || /^\d{17,20}$/.test(args[0]));
    if (firstArgIsUser) {
      const explicitUser = message.mentions.members.first() || await message.guild.members.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null);
      if (explicitUser) {
        targetMember = explicitUser;
        durationStr = args[1];
        reason = args.slice(2).join(' ') || reason;
      }
    } else if (targetMember) {
      // Đã tự động nhận diện user từ tin nhắn Reply
      durationStr = args[0];
      reason = args.slice(1).join(' ') || reason;
    }

    if (!targetMember) {
      return message.reply('❌ Vui lòng tag thành viên, nhập ID hoặc **Reply (trả lời)** vào tin nhắn của người cần Mute!\nCú pháp: `?mute @user 7d <lý do>` hoặc Reply tin nhắn và gõ `?mute 7d <lý do>`');
    }

    if (!targetMember.moderatable) {
      return message.reply('❌ Bot không có quyền Mute/Timeout thành viên này!');
    }

    const seconds = parseDuration(durationStr);
    if (!seconds || seconds <= 0 || seconds > 28 * 86400) {
      return message.reply('❌ Định dạng thời gian không hợp lệ! Ví dụ: `?mute 10s`, `?mute 5m`, `?mute 2h`, `?mute 7d` (Tối đa 28 ngày).');
    }

    try {
      await targetMember.timeout(seconds * 1000, reason);
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('🔇 CÁCH LY THÀNH VIÊN (MUTE)')
        .setDescription(`Đã Mute/Cách ly thành công thành viên **${targetMember.user.tag}**`)
        .addFields(
          { name: '👤 Đối tượng', value: `<@${targetMember.id}> (\`${targetMember.id}\`)`, inline: true },
          { name: '⏳ Thời gian', value: `**${formatDurationText(seconds)}** (\`${seconds}s\`)`, inline: true },
          { name: '📝 Lý do', value: reason, inline: false }
        )
        .setFooter({ text: `Thực hiện bởi ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();
      message.reply({ embeds: [embed] });
    } catch (err) {
      message.reply(`❌ Lỗi thực thi Mute: ${err.message}`);
    }
  }
};
