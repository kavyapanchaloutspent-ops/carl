const db = require('../database');

module.exports = {
  name: 'userUpdate',
  async execute(oldUser, newUser) {
    if (newUser.bot) return;

    try {
      // 1. Theo dõi thay đổi Username Discord
      if (oldUser.username !== newUser.username) {
        await db.pool.query(
          'INSERT INTO user_name_history (user_id, old_name, new_name, change_type) VALUES ($1, $2, $3, $4)',
          [newUser.id, `@${oldUser.username}`, `@${newUser.username}`, 'username']
        );
      }

      // 2. Theo dõi thay đổi Global Display Name
      if (oldUser.globalName !== newUser.globalName) {
        await db.pool.query(
          'INSERT INTO user_name_history (user_id, old_name, new_name, change_type) VALUES ($1, $2, $3, $4)',
          [newUser.id, oldUser.globalName || '*Không có*', newUser.globalName || '*Không có*', 'global_name']
        );
      }

      // 3. Theo dõi thay đổi Avatar toàn cầu
      if (oldUser.avatar !== newUser.avatar) {
        const newAvatarUrl = newUser.displayAvatarURL({ dynamic: true, size: 1024 });
        await db.pool.query(
          'INSERT INTO user_avatar_history (user_id, avatar_url) VALUES ($1, $2)',
          [newUser.id, newAvatarUrl]
        );
      }
    } catch (err) {
      console.error('Lỗi lưu vết userUpdate history:', err);
    }
  }
};
