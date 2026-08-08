const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autotranslate')
    .setDescription('Tự động dịch thuật tất cả tin nhắn trong 1 kênh chỉ định')
    .addChannelOption(opt => opt.setName('channel').setDescription('Kênh cần tự động dịch').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .addStringOption(opt => opt.setName('lang').setDescription('Mã ngôn ngữ đích (vi, en, ja, ko...). Mặc định: vi').setRequired(false))
    .addBooleanOption(opt => opt.setName('off').setDescription('True = Tắt tự động dịch').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const lang = interaction.options.getString('lang') || 'vi';
    const isOff = interaction.options.getBoolean('off');

    const config = await db.getGuildConfig(interaction.guild.id);

    if (isOff) {
      await db.pool.query('UPDATE guild_configs SET auto_translate_channel_id = NULL WHERE guild_id = $1', [interaction.guild.id]);
      return interaction.reply({ content: '❌ Đã **tắt** tính năng tự động dịch thuật trong máy chủ!', ephemeral: true });
    }

    if (!interaction.options.getChannel('channel') && !interaction.options.getString('lang')) {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🌐 CẤU HÌNH AUTO-TRANSLATE TỰ ĐỘNG')
        .addFields(
          { name: '📌 Kênh tự động dịch', value: config.auto_translate_channel_id ? `<#${config.auto_translate_channel_id}>` : '❌ *Chưa cài đặt*', inline: true },
          { name: '🎯 Ngôn ngữ đích', value: `\`${config.auto_translate_lang || 'vi'}\``, inline: true }
        )
        .setFooter({ text: 'Cách cài đặt: /autotranslate channel:#kênh lang:vi (hoặc off:true để tắt)' })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await db.pool.query(
      'UPDATE guild_configs SET auto_translate_channel_id = $1, auto_translate_lang = $2 WHERE guild_id = $3',
      [channel.id, lang, interaction.guild.id]
    );

    return interaction.reply({
      content: `✅ Đã bật tự động dịch thuật cho kênh ${channel} sang ngôn ngữ **\`${lang}\`**!`,
      ephemeral: true
    });
  },

  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ Bạn cần có quyền `Manage Guild` để cấu hình Auto-Translate!');
    }

    const config = await db.getGuildConfig(message.guild.id);
    const subCmd = args[0]?.toLowerCase();

    if (!subCmd || subCmd === 'info' || subCmd === 'status') {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🌐 CẤU HÌNH AUTO-TRANSLATE TỰ ĐỘNG')
        .addFields(
          { name: '📌 Kênh tự động dịch', value: config.auto_translate_channel_id ? `<#${config.auto_translate_channel_id}>` : '❌ *Chưa cài đặt*', inline: true },
          { name: '🎯 Ngôn ngữ đích', value: `\`${config.auto_translate_lang || 'vi'}\``, inline: true }
        )
        .setFooter({ text: 'Cú pháp: ?autotranslate #channel vi (hoặc ?autotranslate off)' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (subCmd === 'off' || subCmd === 'disable') {
      await db.pool.query('UPDATE guild_configs SET auto_translate_channel_id = NULL WHERE guild_id = $1', [message.guild.id]);
      return message.reply('❌ Đã **tắt** tính năng tự động dịch thuật trong máy chủ!');
    }

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]) || message.channel;
    const lang = args[1] || 'vi';

    await db.pool.query(
      'UPDATE guild_configs SET auto_translate_channel_id = $1, auto_translate_lang = $2 WHERE guild_id = $3',
      [channel.id, lang, message.guild.id]
    );

    return message.reply(`✅ Đã bật tự động dịch thuật cho kênh ${channel} sang ngôn ngữ **\`${lang}\`**!`);
  }
};
