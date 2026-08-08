const db = require('../database'); // Đã sửa lại đường dẫn lùi 1 cấp chính xác

// Bộ nhớ đệm lưu trữ số lượng tin nhắn tạm thời để chống Spam
const antiSpamMap = new Map();
// Bộ nhớ đệm đếm số lần vi phạm của từng người dùng để phân cấp hình phạt cách ly
const spamInfractionMap = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // A. PHÁT HIỆN LỆNH TÙY CHỈNH CHẠY KHÔNG CẦN PREFIX (Không cần ?)
    const triggerWord = message.content.toLowerCase().trim();
    const customRes = await db.pool.query(
      'SELECT response_text FROM custom_commands WHERE guild_id = $1 AND cmd_name = $2',
      [message.guild.id, triggerWord]
    ).catch(() => ({ rows: [] }));

    if (customRes.rows.length > 0) {
      return await message.reply(customRes.rows[0].response_text).catch(() => {});
    }

    const config = await db.getGuildConfig(message.guild.id);

    // B. ANTI-MENTION (Chống spam tag)
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    const mentionLimit = config.anti_mention_limit || 5;
    if (mentionCount > mentionLimit) {
      await message.delete().catch(() => {});
      return message.channel.send(`⚠️ **${message.author.username}**, không được tag quá nhiều người cùng một lúc!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    // C. ANTI-INVITE (Chặn link mời server khác)
    if (config.anti_invite_toggle && /discord\.(gg|com\/invite)\/[a-zA-Z0-9]+/i.test(message.content)) {
      await message.delete().catch(() => {});
      return message.channel.send(`⚠️ **${message.author.username}**, quảng cáo link máy chủ khác bị cấm ở đây!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    // D. ANTI-LINK (Chặn các liên kết ngoài)
    if (config.anti_link_toggle && (message.content.includes('http://') || message.content.includes('https://'))) {
      await message.delete().catch(() => {});
      return message.channel.send(`⚠️ **${message.author.username}**, liên kết ngoài bị cấm tại kênh chat này!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    // E. ANTI-SPAM THÔNG MINH BẢO MẬT (Rate limiting, Duplicate message detection, Bulk purge & Progressive punishments)
    if (config.anti_spam_toggle && !message.member.permissions.has('ManageMessages')) {
      const userKey = `${message.guild.id}:${message.author.id}`;
      const now = Date.now();
      
      const userSpamState = antiSpamMap.get(userKey) || { timestamps: [], lastContent: '', duplicateCount: 0 };
      userSpamState.timestamps.push(now);

      // Lọc các tin nhắn trong 5 giây gần đây
      userSpamState.timestamps = userSpamState.timestamps.filter(time => now - time < 5000);

      // Kiểm tra gửi tin nhắn trùng lặp liên tục
      const currentContent = message.content.trim().toLowerCase();
      if (currentContent.length > 2 && currentContent === userSpamState.lastContent) {
        userSpamState.duplicateCount += 1;
      } else {
        userSpamState.lastContent = currentContent;
        userSpamState.duplicateCount = 1;
      }

      antiSpamMap.set(userKey, userSpamState);

      const spamLimit = config.anti_spam_limit || 5;
      const isRateSpam = userSpamState.timestamps.length >= spamLimit;
      const isDuplicateSpam = userSpamState.duplicateCount >= 3;

      if (isRateSpam || isDuplicateSpam) {
        // Tự động xóa tin nhắn vi phạm vừa gửi
        await message.delete().catch(() => {});

        // Thực hiện tự động dọn dẹp các tin nhắn rác vừa gửi trong 15 giây gần đây
        try {
          const recentMsgs = await message.channel.messages.fetch({ limit: 20 });
          const userSpamMsgs = recentMsgs.filter(m => m.author.id === message.author.id && (now - m.createdTimestamp) < 15000);
          if (userSpamMsgs.size > 0) {
            await message.channel.bulkDelete(userSpamMsgs, true).catch(() => {});
          }
        } catch (e) {
          // Bỏ qua nếu kênh không đủ quyền bulkDelete
        }

        // Reset bộ đệm tin nhắn tức thời sau khi phát hiện spam
        antiSpamMap.set(userKey, { timestamps: [], lastContent: '', duplicateCount: 0 });

        // Tự động giảm mức vi phạm nếu người dùng đã cư xử đúng mực quá 10 phút
        const infractionState = spamInfractionMap.get(userKey) || { count: 0, lastTime: 0 };
        if (now - infractionState.lastTime > 10 * 60 * 1000) {
          infractionState.count = 0;
        }

        infractionState.count += 1;
        infractionState.lastTime = now;
        spamInfractionMap.set(userKey, infractionState);

        const violationCount = infractionState.count;
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        const reasonText = isDuplicateSpam ? 'Anti-Spam: Gửi tin nhắn trùng lặp nhiều lần' : 'Anti-Spam: Gửi tin nhắn quá nhanh';

        if (violationCount === 1) {
          // Mức 1: Cảnh báo nhẹ
          await message.author.send(`⚠️ **CẢNH BÁO SPAM (Máy chủ ${message.guild.name}):** Vui lòng không gửi tin nhắn quá nhanh hoặc lặp lại!`).catch(() => {});
          const pubMsg = await message.channel.send(`⚠️ <@${message.author.id}>, phát hiện hành vi spam! Đã tự động dọn dẹp tin nhắn. *(Cảnh báo 1/5)*`);
          setTimeout(() => pubMsg.delete().catch(() => {}), 6000);
        } else if (violationCount === 2) {
          // Mức 2: Timeout 1 phút
          if (member && member.moderatable) {
            await member.timeout(1 * 60 * 1000, reasonText).catch(() => {});
            const pubMsg = await message.channel.send(`🔇 Phát hiện vi phạm spam từ <@${message.author.id}>! Đã tạm thời cách ly **1 phút** *(Cảnh báo 2/5)*.`);
            setTimeout(() => pubMsg.delete().catch(() => {}), 7000);
          }
        } else if (violationCount === 3) {
          // Mức 3: Timeout 10 phút
          if (member && member.moderatable) {
            await member.timeout(10 * 60 * 1000, reasonText).catch(() => {});
            const pubMsg = await message.channel.send(`🔇 Phát hiện vi phạm spam lặp lại từ <@${message.author.id}>! Đã cách ly **10 phút** *(Cảnh báo 3/5)*.`);
            setTimeout(() => pubMsg.delete().catch(() => {}), 8000);
          }
        } else if (violationCount === 4) {
          // Mức 4: Timeout 1 giờ + Log bảo mật
          if (member && member.moderatable) {
            await member.timeout(60 * 60 * 1000, reasonText).catch(() => {});
            const pubMsg = await message.channel.send(`🚨 <@${message.author.id}> vi phạm spam nhiều lần! Đã cách ly **1 giờ** *(Cảnh báo 4/5)*.`);
            setTimeout(() => pubMsg.delete().catch(() => {}), 10000);
          }
        } else if (violationCount >= 5) {
          // Mức 5+: Timeout 24 giờ + Log bảo mật
          if (member && member.moderatable) {
            await member.timeout(24 * 60 * 60 * 1000, reasonText).catch(() => {});
            const pubMsg = await message.channel.send(`⛔ Hành vi spam nghiêm trọng từ <@${message.author.id}>! Đã khóa tài khoản **24 giờ** *(Cảnh báo 5/5)*.`);
            setTimeout(() => pubMsg.delete().catch(() => {}), 12000);
          }
        }

        // Ghi log vào kênh nhật ký bảo mật nếu đã cấu hình log_channel_id
        if (config.log_channel_id && violationCount >= 3) {
          const logChannel = message.guild.channels.cache.get(config.log_channel_id);
          if (logChannel) {
            const { EmbedBuilder } = require('discord.js');
            const logEmbed = new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle('🛡️ NHẬT KÝ BẢO MẬT: PHÁT HIỆN SPAM')
              .addFields(
                { name: '👤 Người vi phạm', value: `<@${message.author.id}> (\`${message.author.id}\`)`, inline: true },
                { name: '📌 Kênh vi phạm', value: `<#${message.channel.id}>`, inline: true },
                { name: '⚠️ Mức cảnh báo', value: `Cảnh cáo cấp **${violationCount}/5**`, inline: true },
                { name: '📝 Lý do', value: reasonText, inline: false }
              )
              .setTimestamp();
            logChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }

        return; // Dừng xử lý tiếp các logic tin nhắn này
      }
    }

    // F. STICKY MESSAGES (Tin nhắn dán cuối kênh chat)
    const stickyRes = await db.pool.query('SELECT * FROM sticky_messages WHERE channel_id = $1', [message.channel.id]).catch(() => ({ rows: [] }));
    if (stickyRes.rows.length > 0) {
      const sticky = stickyRes.rows[0];
      
      if (sticky.last_message_id) {
        const lastMsg = await message.channel.messages.fetch(sticky.last_message_id).catch(() => null);
        if (lastMsg) await lastMsg.delete().catch(() => {});
      }

      const newStickyMsg = await message.channel.send({ content: `📌 **LƯU Ý:**\n${sticky.content}` });
      await db.pool.query('UPDATE sticky_messages SET last_message_id = $1 WHERE channel_id = $2', [newStickyMsg.id, message.channel.id]).catch(() => {});
    }

    // G. Xử lý các lệnh prefix hệ thống thông thường khác
    const prefix = config.prefix || '?';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (command && typeof command.executePrefix === 'function') {
      try {
        await command.executePrefix(message, args);
      } catch (err) {
        console.error(err);
      }
    }
  }
};