const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

async function processMassNickname(guild, targetType, newName) {
  await guild.members.fetch().catch(() => {});
  let members = guild.members.cache;

  if (targetType === 'bots') {
    members = members.filter(m => m.user.bot);
  } else if (targetType === 'humans') {
    members = members.filter(m => !m.user.bot);
  }

  let successCount = 0;
  let failCount = 0;

  const nickToSet = (newName && newName.toLowerCase() !== 'reset') ? newName.substring(0, 32) : null;

  for (const [, member] of members) {
    if (member.id === guild.ownerId) {
      failCount++;
      continue;
    }
    try {
      await member.setNickname(nickToSet);
      successCount++;
    } catch (err) {
      failCount++;
    }
  }

  return { successCount, failCount, total: members.size, nickToSet };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Thay đổi biệt danh (nickname) cho một người dùng hoặc hàng loạt (all/bots/humans)')
    .addUserOption(opt => opt.setName('user').setDescription('Thành viên cần đổi').setRequired(false))
    .addStringOption(opt => opt.setName('target_group').setDescription('Nhóm đối tượng cần đổi hàng loạt')
      .setRequired(false)
      .addChoices(
        { name: 'Tất cả thành viên (All)', value: 'all' },
        { name: 'Tất cả Bot (Bots)', value: 'bots' },
        { name: 'Tất cả Người dùng thật (Humans)', value: 'humans' }
      ))
    .addStringOption(opt => opt.setName('new_name').setDescription('Biệt danh mới (nhập "reset" hoặc để trống để khôi phục)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async execute(interaction) {
    const targetMember = interaction.options.getMember('user');
    const targetGroup = interaction.options.getString('target_group');
    const newName = interaction.options.getString('new_name');

    if (!targetMember && !targetGroup) {
      return interaction.reply({ content: '❌ Vui lòng chọn một thành viên cụ thể hoặc chọn nhóm đối tượng (`all`/`bots`/`humans`)!', ephemeral: true });
    }

    if (targetGroup) {
      await interaction.deferReply();
      const result = await processMassNickname(interaction.guild, targetGroup, newName);
      const actionText = result.nickToSet ? `đổi biệt danh thành **${result.nickToSet}**` : 'khôi phục biệt danh mặc định';
      return interaction.editReply({
        content: `✅ Đã tiến hành ${actionText} cho nhóm **${targetGroup.toUpperCase()}**!\n- Thành công: **${result.successCount}** / **${result.total}**\n- Thất bại (thiếu quyền): **${result.failCount}**`
      });
    }

    if (!targetMember.manageable) {
      return interaction.reply({ content: '❌ Bot không đủ thẩm quyền thay đổi biệt danh của người này!', ephemeral: true });
    }

    try {
      const nickToSet = (newName && newName.toLowerCase() !== 'reset') ? newName.substring(0, 32) : null;
      await targetMember.setNickname(nickToSet);
      if (nickToSet) {
        await interaction.reply({ content: `✅ Đã thay đổi biệt danh của **${targetMember.user.username}** thành: **${nickToSet}**` });
      } else {
        await interaction.reply({ content: `✅ Đã khôi phục biệt danh mặc định cho **${targetMember.user.username}**` });
      }
    } catch (err) {
      await interaction.reply({ content: `❌ Lỗi thực thi: ${err.message}`, ephemeral: true });
    }
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      return message.reply('❌ Bạn cần có quyền `Manage Nicknames` để sử dụng lệnh này!');
    }

    const firstArg = args[0]?.toLowerCase();

    if (firstArg === 'all' || firstArg === 'bots' || firstArg === 'humans') {
      const newName = args.slice(1).join(' ');
      const statusMsg = await message.reply(`🔄 Đang tiến hành đổi biệt danh hàng loạt cho nhóm **${firstArg.toUpperCase()}**...`);
      const result = await processMassNickname(message.guild, firstArg, newName);
      const actionText = result.nickToSet ? `đổi biệt danh thành **${result.nickToSet}**` : 'khôi phục biệt danh mặc định';
      return statusMsg.edit(`✅ Đã ${actionText} cho nhóm **${firstArg.toUpperCase()}**!\n- Thành công: **${result.successCount}** / **${result.total}**\n- Bỏ qua / Thất bại: **${result.failCount}**`);
    }

    const targetMember = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
    if (!targetMember) {
      return message.reply('❌ Cú pháp:\n- Đổi 1 người: `?nickname @user <Biệt_danh_mới>`\n- Đổi tất cả: `?nickname all <Biệt_danh_mới>`\n- Đổi bot: `?nickname bots <Biệt_danh_mới>`\n- Khôi phục tên: `?nickname @user reset` hoặc `?nickname all reset`');
    }

    const newName = args.slice(1).join(' ');
    const nickToSet = (newName && newName.toLowerCase() !== 'reset') ? newName.substring(0, 32) : null;

    try {
      await targetMember.setNickname(nickToSet);
      if (nickToSet) {
        message.reply(`✅ Đã đổi biệt danh của **${targetMember.user.username}** thành: **${nickToSet}**`);
      } else {
        message.reply(`✅ Đã khôi phục biệt danh mặc định cho **${targetMember.user.username}**`);
      }
    } catch (err) {
      message.reply(`❌ Lỗi phân quyền: ${err.message}`);
    }
  }
};