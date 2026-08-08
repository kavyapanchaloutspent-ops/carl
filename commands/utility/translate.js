const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const LANG_NAMES = {
  vi: '🇻🇳 Tiếng Việt (Vietnamese)',
  en: '🇬🇧 Tiếng Anh (English)',
  ja: '🇯🇵 Tiếng Nhật (Japanese)',
  ko: '🇰🇷 Tiếng Hàn (Korean)',
  zh: '🇨🇳 Tiếng Trung (Chinese)',
  'zh-cn': '🇨🇳 Tiếng Trung giản thể',
  'zh-tw': '🇹🇼 Tiếng Trung phồn thể',
  fr: '🇫🇷 Tiếng Pháp (French)',
  de: '🇩🇪 Tiếng Đức (German)',
  es: '🇪🇸 Tiếng Tây Ban Nha (Spanish)',
  ru: '🇷🇺 Tiếng Nga (Russian)',
  th: '🇹🇭 Tiếng Thái (Thai)',
  id: '🇮🇩 Tiếng Indonesia',
  la: '🇻🇳 Tiếng Lào / Latin'
};

async function translateText(text, targetLang = 'vi') {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data[0]) return null;

    const translatedText = data[0].map(item => item[0]).filter(Boolean).join('');
    const detectedLang = data[2] || 'auto';

    return {
      translatedText,
      detectedLang,
      targetLang
    };
  } catch (e) {
    console.error('Lỗi dịch thuật:', e);
    return null;
  }
}

function buildTranslateEmbed(originalText, result, author) {
  const srcName = LANG_NAMES[result.detectedLang.toLowerCase()] || `\`${result.detectedLang.toUpperCase()}\``;
  const targetName = LANG_NAMES[result.targetLang.toLowerCase()] || `\`${result.targetLang.toUpperCase()}\``;

  const shortOriginal = originalText.length > 100 ? originalText.slice(0, 100) + '...' : originalText;

  return new EmbedBuilder()
    .setColor(0x00FF88)
    .setDescription(
      `# ✨ ${result.translatedText}\n\n` +
      `-# 🌐 **Dịch từ:** ${srcName} ➔ ${targetName}\n` +
      `-# 💬 **Văn bản gốc:** *"${shortOriginal}"*`
    )
    .setFooter({ text: `Yêu cầu bởi ${author.username}`, iconURL: author.displayAvatarURL({ dynamic: true }) });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Dịch thuật văn bản tự động sang mọi ngôn ngữ (Tiếng Việt, Anh, Nhật, Hàn, Trung...)')
    .addStringOption(opt => opt.setName('text').setDescription('Nội dung cần dịch').setRequired(true))
    .addStringOption(opt => opt.setName('target_lang').setDescription('Mã ngôn ngữ đích (vi, en, ja, ko, zh, fr, de...) - Mặc định: vi').setRequired(false)),

  async execute(interaction) {
    const text = interaction.options.getString('text');
    let targetLang = interaction.options.getString('target_lang') || 'vi';

    await interaction.deferReply();

    const result = await translateText(text, targetLang);
    if (!result) {
      return interaction.editReply({ content: '❌ Lỗi hệ thống khi dịch thuật! Vui lòng thử lại sau.' });
    }

    const embed = buildTranslateEmbed(text, result, interaction.user);
    await interaction.editReply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    let textToTranslate = null;
    let targetLang = 'vi';

    // 🎯 Nếu dùng REPLIES (Trả lời tin nhắn người khác)
    if (message.reference && message.reference.messageId) {
      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMsg && repliedMsg.content) {
          textToTranslate = repliedMsg.content;
          if (args[0] && args[0].length <= 5 && !args[0].includes(' ')) {
            targetLang = args[0].toLowerCase();
          }
        }
      } catch (e) {}
    }

    if (!textToTranslate) {
      if (!args[0]) {
        return message.reply('❌ Cú pháp:\n- Nhập văn bản: `?translate <nội_dung>` hoặc `?translate en <nội_dung>`\n- Hoặc **Reply tin nhắn** cần dịch và gõ `?translate` hoặc `?translate en`');
      }

      // Kiểm tra nếu tham số đầu tiên là mã ngôn ngữ (VD: en, vi, ja, ko)
      const possibleLang = args[0].toLowerCase();
      if (args.length > 1 && possibleLang.length <= 5 && /^[a-z]{2,5}(-[a-z]{2,5})?$/.test(possibleLang)) {
        targetLang = possibleLang;
        textToTranslate = args.slice(1).join(' ');
      } else {
        textToTranslate = args.join(' ');
      }
    }

    const statusMsg = await message.reply('🔄 Đang tiến hành dịch thuật...');
    const result = await translateText(textToTranslate, targetLang);

    if (!result) {
      return statusMsg.edit('❌ Không thể dịch văn bản này! Vui lòng kiểm tra lại.');
    }

    const embed = buildTranslateEmbed(textToTranslate, result, message.author);
    await statusMsg.edit({ content: null, embeds: [embed] });
  }
};
