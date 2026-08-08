const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    // 1. Cấu hình chung cho từng Server (Guild Configs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS guild_configs (
        guild_id TEXT PRIMARY KEY,
        prefix TEXT DEFAULT '?',
        log_channel_id TEXT,
        welcome_channel_id TEXT,
        welcome_message TEXT,
        goodbye_message TEXT,
        autorole_id TEXT,
        verify_role_id TEXT,
        anti_spam_toggle BOOLEAN DEFAULT FALSE,
        anti_link_toggle BOOLEAN DEFAULT FALSE,
        anti_invite_toggle BOOLEAN DEFAULT FALSE,
        anti_mention_limit INT DEFAULT 5,
        anti_nuke_limit INT DEFAULT 3,
        anti_raid_limit INT DEFAULT 10,
        alt_age_limit INT DEFAULT 3,
        anti_spam_limit INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Migrations cho bảng guild_configs nếu bảng đã tồn tại từ trước
    await client.query(`
      ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS anti_spam_limit INT DEFAULT 5;
      ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS auto_nickname_format TEXT;
    `);

    // 2. Nhật ký cảnh cáo (Warnings)
    await client.query(`
      CREATE TABLE IF NOT EXISTS warnings (
        id SERIAL PRIMARY KEY,
        guild_id TEXT,
        user_id TEXT,
        moderator_id TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 3. Tin nhắn dính cuối kênh chat (Sticky Messages)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sticky_messages (
        channel_id TEXT PRIMARY KEY,
        last_message_id TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 4. Lệnh phản hồi nhanh tự tạo (Custom Commands)
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_commands (
        guild_id TEXT,
        cmd_name TEXT,
        response_text TEXT,
        PRIMARY KEY (guild_id, cmd_name)
      )
    `);

    // 5. Bản sao lưu cấu hình máy chủ (Backups)
    await client.query(`
      CREATE TABLE IF NOT EXISTS backups (
        backup_id TEXT PRIMARY KEY,
        guild_id TEXT,
        creator_id TEXT,
        backup_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Hệ thống Database quản lý đã được khởi tạo thành công!');
  } catch (err) {
    console.error('❌ Lỗi khởi tạo Database:', err);
  } finally {
    client.release();
  }
}

initDatabase();

async function getGuildConfig(guildId) {
  const res = await pool.query('SELECT * FROM guild_configs WHERE guild_id = $1', [guildId]);
  if (res.rows.length === 0) {
    await pool.query('INSERT INTO guild_configs (guild_id) VALUES ($1)', [guildId]);
    return { guild_id: guildId, prefix: '?', anti_spam_toggle: false, anti_spam_limit: 5, anti_link_toggle: false, anti_mention_limit: 5 };
  }
  return res.rows[0];
}

module.exports = {
  pool,
  getGuildConfig
};