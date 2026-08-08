const db = require('../database');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    if (newMember.user.bot) return;

    try {
      // 1. Theo dõi thay đổi Server Nickname
      if (oldMember.nickname !== newMember.nickname) {
        const oldNick = oldMember.nickname ? oldMember.nickname : `(Tên mặc định: ${oldMember.user.username})`;
        const newNick = newMember.nickname ? newMember.nickname : `(Khôi phục tên mặc định: ${newMember.user.username})`;

        await db.pool.query(
          'INSERT INTO user_name_history (user_id, old_name, new_name, change_type, guild_id) VALUES ($1, $2, $3, $4, $5)',
          [newMember.id, oldNick, newNick, 'nickname', newMember.guild.id]
        );
      }

      // 2. Theo dõi thay đổi Server Avatar riêng
      if (oldMember.avatar !== newMember.avatar) {
        const newAvatarUrl = newMember.displayAvatarURL({ dynamic: true, size: 1024 });
        await db.pool.query(
          'INSERT INTO user_avatar_history (user_id, avatar_url, guild_id) VALUES ($1, $2, $3)',
          [newMember.id, newAvatarUrl, newMember.guild.id]
        );
      }
    } catch (err) {
      console.error('Lỗi lưu vết guildMemberUpdate history:', err);
    }
  }
};
