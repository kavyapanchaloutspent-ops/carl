const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function buildSnipeEmbed(snipeData) {
  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('🔍 XEM LẠI TIN NHẮN VỪA XÓA (SNIPE)')
    .setDescription(
      `💬 **NỘI DUNG TIN NHẮN MÀ <@${snipeData.author.id}> ĐÃ XÓA LÀ:**\n` +
      `>>> ${snipeData.content}`
    )
    .setFooter({ text: `Tác giả: ${snipeData.author.tag}`, iconURL: snipeData.author.displayAvatarURL({ dynamic: true }) })
    .setTimestamp(snipeData.deletedAt);

  if (snipeData.attachment) {
    embed.setImage(snipeData.attachment);
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Xem lại tin nhắn vừa mới bị xóa gần đây nhất trong kênh chat'),

  async execute(interaction) {
    const snipeData = interaction.client.snipes ? interaction.client.snipes.get(interaction.channel.id) : null;
    if (!snipeData) {
      return interaction.reply({ content: '❌ Không tìm thấy tin nhắn nào vừa bị xóa gần đây trong kênh này!', ephemeral: true });
    }

    const embed = buildSnipeEmbed(snipeData);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const snipeData = message.client.snipes ? message.client.snipes.get(message.channel.id) : null;
    if (!snipeData) {
      return message.reply('❌ Không tìm thấy tin nhắn nào vừa bị xóa gần đây trong kênh này!');
    }

    const embed = buildSnipeEmbed(snipeData);
    message.reply({ embeds: [embed] });
  }
};
