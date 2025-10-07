const TelegramBot = require('node-telegram-bot-api');
const Parser = require('rss-parser');
const cron = require('node-cron');
const parser = new Parser();

const token = '8497045436:AAFH-5jGPVHLqgTlimPhgLWzbClEqhuWEeM'; // put your bot token here
const bot = new TelegramBot(token, { polling: true });

const feeds = {
  tech: "https://feeds.feedburner.com/TechCrunch/",
  world: "http://feeds.bbci.co.uk/news/world/rss.xml",
  india: "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",
  sports: "http://feeds.bbci.co.uk/sport/rss.xml",
  business: "http://feeds.bbci.co.uk/news/business/rss.xml",
  health: "http://feeds.bbci.co.uk/news/health/rss.xml",
  science: "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  entertainment: "http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
  finance: "https://www.livemint.com/rss/markets",
  environment: "https://www.theguardian.com/environment/rss"
};

function formatDate(dt) {
  const d = new Date(dt);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Helper to split and send long messages in chunks safe for Telegram
async function sendLongMessage(chatId, text, options = {}) {
  const limit = 4096;
  while (text.length > 0) {
    let chunk = text.slice(0, limit);
    const lastNewline = chunk.lastIndexOf('\n');
    if (lastNewline > 0 && lastNewline > limit - 100) {
      chunk = chunk.slice(0, lastNewline);
    }
    await bot.sendMessage(chatId, chunk, options);
    text = text.slice(chunk.length);
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userInput = msg.text.trim().toLowerCase();
  const categories = Object.keys(feeds);

  if (categories.includes(userInput)) {
    await bot.sendMessage(chatId, `Getting news for *${userInput}*, please wait...`, { parse_mode: 'Markdown' });
    try {
      const feed = await parser.parseURL(feeds[userInput]);
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
      let grouped = {};
      feed.items.forEach(item => {
        if (!item.pubDate) return;
        let pub = new Date(item.pubDate);
        if (pub >= twoDaysAgo && pub <= now) {
          const day = formatDate(pub);
          if (!grouped[day]) grouped[day] = [];
          grouped[day].push(item);
        }
      });

      let reply = `📰 News for last 2 days in *${userInput}*:\n`;
      const days = Object.keys(grouped).sort().reverse();
      for (const day of days) {
        reply += `\n*${day}:*\n`;
        for (const item of grouped[day]) {
          let description = item.contentSnippet || item.content || item.summary || "";
          reply += `• [${item.title}](${item.link})\n`;
          if (description) {
            reply += `   _${description}_\n`;
          }
          reply += `\n`; // Space between each news
        }
      }
      if (days.length === 0) {
        reply += "\nNo news found for the last 2 days!";
      }
      await sendLongMessage(chatId, reply, { parse_mode: 'Markdown', disable_web_page_preview: false });
    } catch (e) {
      await bot.sendMessage(chatId, "⚠️ Failed to fetch news.");
    }
  } else {
    // Keyword search across all categories
    await bot.sendMessage(chatId, `Looking for recent news containing: *${msg.text.trim()}*`, { parse_mode: 'Markdown' });
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
    let found = [];
    for (let [cat, feedUrl] of Object.entries(feeds)) {
      try {
        const feed = await parser.parseURL(feedUrl);
        feed.items.forEach(item => {
          if (!item.pubDate) return;
          let pub = new Date(item.pubDate);
          if (
            pub >= twoDaysAgo &&
            pub <= now &&
            item.title.toLowerCase().includes(userInput)
          ) {
            found.push({
              category: cat,
              date: formatDate(pub),
              title: item.title,
              link: item.link,
              description: item.contentSnippet || item.content || item.summary || ""
            });
          }
        });
      } catch (e) {
        // silently skip
      }
    }
    if (found.length === 0) {
      await bot.sendMessage(chatId, "No recent headlines found for this keyword in the last 2 days.");
    } else {
      let grouped = {};
      found.forEach(news => {
        if (!grouped[news.date]) grouped[news.date] = [];
        grouped[news.date].push(news);
      });

      let reply = `🟢 News headlines for "*${msg.text.trim()}*" (last 2 days):\n`;
      for (const date of Object.keys(grouped).sort().reverse()) {
        reply += `\n*${date}:*\n`;
        for (const news of grouped[date]) {
          reply += `• [${news.title}](${news.link}) _(in ${news.category})_\n`;
          if (news.description) {
            reply += `   _${news.description}_\n`;
          }
          reply += `\n`; // Space between each news
        }
      }
      await sendLongMessage(chatId, reply, { parse_mode: 'Markdown', disable_web_page_preview: false });
    }
  }
});

// DAILY DIGEST CODE (optional)
const digestChatId = "123456789"; // Replace with your chat id

cron.schedule('0 8 * * *', async () => {
  const category = 'tech'; // Or loop for multiple categories
  try {
    const feed = await parser.parseURL(feeds[category]);
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    let grouped = {};
    feed.items.forEach(item => {
      if (!item.pubDate) return;
      let pub = new Date(item.pubDate);
      if (pub >= oneDayAgo && pub <= now) {
        const day = formatDate(pub);
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(item);
      }
    });

    let reply = `📰 *Daily ${category} Digest:*\n`;
    const days = Object.keys(grouped).sort().reverse();
    for (const day of days) {
      reply += `\n*${day}:*\n`;
      for (const item of grouped[day]) {
        let description = item.contentSnippet || item.content || item.summary || "";
        reply += `• [${item.title}](${item.link})\n`;
        if (description) {
          reply += `   _${description}_\n`;
        }
        reply += `\n`; // Space between each news
      }
    }
    if (days.length === 0) {
      reply += "\nNo headlines in the last 24 hours!";
    }
    await sendLongMessage(digestChatId, reply, { parse_mode: 'Markdown', disable_web_page_preview: false });
  } catch (e) {
    await bot.sendMessage(digestChatId, "⚠️ Failed to send daily digest.");
  }
});
