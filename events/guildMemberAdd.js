const db = require('../database'); // Lùi 1 cấp chính xác
const { EmbedBuilder } = require('discord.js');

// Bộ lưu trữ in-memory chống spam bot gia nhập dồn dập
const raidMap = new Map();

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const config = await db.getGuildConfig(member.guild.id);

    // ============ 1. CHỐNG TÀI KHOẢN CLONE (Alt Account check) ============
    // Nếu alt_age_limit bằng 0 hoặc chưa cấu hình đúng, hệ thống sẽ tự động BỎ QUA không kick tài khoản
    const altLimit = (config.alt_age_limit !== null && config.alt_age_limit !== undefined) ? config.alt_age_limit : 3;
    if (altLimit > 0) {
      const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
      if (accountAgeDays < altLimit) {
        await member.kick('Tài khoản clone bị bảo vệ tự động bởi hệ thống Anti-Alt.').catch(() => {});
        return;
      }
    }

    // ============ 2. CHỐNG THAM GIA Ồ ẠT (Anti-raid) ============
    const now = Date.now();
    const joinTimestamps = raidMap.get(member.guild.id) || [];
    joinTimestamps.push(now);

    const recentJoins = joinTimestamps.filter(time => now - time < 10000);
    raidMap.set(member.guild.id, recentJoins);

    if (recentJoins.length > (config.anti_raid_limit || 10)) {
      await member.kick('Server đang bị tấn công dồn dập (Raid), kích hoạt bảo vệ tự động!').catch(() => {});
      return;
    }

    // ============ 3. GÁN VAI TRÒ TỰ ĐỘNG (Autorole) ============
    if (config.autorole_id) {
      const role = member.guild.roles.cache.get(config.autorole_id);
      if (role) await member.roles.add(role).catch(() => {});
    }

    // ============ 3.5 TỰ ĐỘNG ĐỔI BIỆT DANH (Auto Nickname) ============
    if (config.auto_nickname_format) {
      const formattedNick = config.auto_nickname_format
        .replace(/{username}/g, member.user.username)
        .replace(/{tag}/g, member.user.tag)
        .replace(/{server}/g, member.guild.name)
        .substring(0, 32);
      await member.setNickname(formattedNick).catch(() => {});
    }

    // ============ 4. GỬI TIN CHÀO MỪNG (Welcome Message) ============
    if (config.welcome_channel_id && config.welcome_message) {
      const channel = member.guild.channels.cache.get(config.welcome_channel_id);
      if (channel) {
        let msg = config.welcome_message
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{server}/g, `**${member.guild.name}**`);

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🎉 Chào mừng thành viên mới!')
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  }
};
