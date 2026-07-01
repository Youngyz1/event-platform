export async function postToFacebook({ message, link }) {
  const GRAPH_API_VERSION = 'v25.0';
  const PAGE_ID = process.env.FB_PAGE_ID;
  const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

  const params = new URLSearchParams({ message, access_token: PAGE_ACCESS_TOKEN });
  if (link) params.append('link', link);

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/feed`,
    { method: 'POST', body: params }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error));
  return data.id;
}

// NEW: posts an image + caption together
export async function postPhotoToFacebook({ imageBase64, caption }) {
  const GRAPH_API_VERSION = 'v25.0';
  const PAGE_ID = process.env.FB_PAGE_ID;
  const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

  const imageBuffer = Buffer.from(imageBase64, 'base64');
  const blob = new Blob([imageBuffer], { type: 'image/png' });

  const formData = new FormData();
  formData.append('source', blob, 'post-image.png');
  formData.append('caption', caption);
  formData.append('access_token', PAGE_ACCESS_TOKEN);

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/photos`,
    { method: 'POST', body: formData }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error));
  return data.id; // photo id; Facebook auto-creates a feed post from it
}