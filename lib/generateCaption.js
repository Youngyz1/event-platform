const dailyTemplates = [
  "💛 Every day is a chance to make a difference. Support Fund4Good's mission today!",
  "🌍 Small actions, big impact. Here's how Fund4Good is making change happen.",
  "🤝 Together we're stronger. Thank you for standing with Fund4Good.",
  "✨ Change starts with people who care — thank you for being part of ours.",
  "📣 Your support fuels real change. See what's happening at Fund4Good today.",
  "🌱 Communities grow stronger when we show up for each other. That's what Fund4Good is all about.",
  "❤️ Behind every donation, every share, every message — there's a real story of impact.",
  "🙌 We couldn't do this without our incredible community. Thank you for standing with us.",
  "🔎 Curious what your support makes possible? Stop by and see what Fund4Good has been up to.",
  "🌟 One act of kindness can ripple further than you think. Be part of that ripple today.",
  "🎉 Every fundraiser starts with someone who cared enough to try. Thank you for caring.",
  "🌈 Hope looks like a community showing up for each other. That's you. That's Fund4Good.",
  "📅 Take a moment today to see what's happening around you — there's a cause that needs you.",
  "💬 Have a story about how Fund4Good impacted you or your community? We'd love to hear it.",
  "🕊️ Giving isn't about how much — it's about showing up. Thank you for showing up.",
  "🔥 Passion meets purpose when a community comes together. That's the heart of Fund4Good.",
  "🎈 Fundraisers aren't just about money — they're about people believing in something together.",
  "🧡 Thank you to everyone who's donated, shared, or simply cheered us on. It matters.",
  "🚀 Big goals start with small steps. Thanks for taking one with us today.",
  "🌻 Every cause has a first supporter. Be someone's first supporter today.",
];

const dailyThemes = [
  "the impact of small daily acts of kindness",
  "how communities grow stronger when people show up for each other",
  "gratitude toward supporters and donors",
  "encouraging someone to become a first-time supporter of a cause",
  "the story behind why people fundraise for causes they care about",
  "hope and encouragement for people facing hard times",
  "the ripple effect of generosity",
  "what it means to give, even in small ways",
  "showing up for your community",
  "believing in something bigger than yourself",
];

// Fallback used only if the Gemini call itself fails
function getFallbackTemplate() {
  return dailyTemplates[Math.floor(Math.random() * dailyTemplates.length)];
}

export async function generateDailyCaption() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const theme = dailyThemes[Math.floor(Math.random() * dailyThemes.length)];

  const prompt = `Write a short, warm Facebook post (under 60 words) for a nonprofit called Fund4Good. The post should be about: ${theme}.

Rules:
- Plain text only. No Markdown, no asterisks, no formatting symbols.
- Include exactly one relevant emoji at the start.
- Write the complete, finished post only — no placeholders, no brackets, no notes to yourself.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Gemini');

    return text;
  } catch (err) {
    console.error('Gemini daily caption failed, using fallback template:', err.message);
    return getFallbackTemplate();
  }
}

export async function generateDailyImage(caption) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const imagePrompt = `Create a warm, uplifting photo-style image for a nonprofit Facebook post. The post's message is: "${caption}". The image should feel like a real community/charity photo — people helping each other, volunteering, or a hopeful scene. No text or words in the image.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: imagePrompt }] }] }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  const imagePart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!imagePart) throw new Error('No image returned from Gemini');

  return imagePart.inlineData.data; // base64 image data
}

export async function generateContentCaption({ title, excerpt, url }) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const prompt = `Write a short, warm Facebook post (under 80 words) announcing this new update from a nonprofit called Fund4Good.

Title: ${title}
Details: ${excerpt}

Rules:
- Plain text only. Do not use Markdown, asterisks, or any formatting symbols.
- Do not include placeholder text, brackets, or instructions to yourself — write the complete, finished post only.
- Write as if this is the final text going live on Facebook right now.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Gemini');
    return text;
  } catch (err) {
    console.error('Gemini caption generation failed, using fallback:', err.message);
    return `📣 New update from Fund4Good: ${title}! ${excerpt}`;
  }
}