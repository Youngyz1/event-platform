import { generateDailyCaption, generateDailyImage } from '../../../../lib/generateCaption';
import { postToFacebook, postPhotoToFacebook } from '../../../../lib/facebook';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const caption = await generateDailyCaption(); // now AI-generated, with built-in fallback

  try {
    const imageBase64 = await generateDailyImage(caption);
    const postId = await postPhotoToFacebook({ imageBase64, caption });
    return Response.json({ success: true, postId, withImage: true });
  } catch (err) {
    console.error('Image generation/post failed, falling back to text-only:', err.message);
    try {
      const postId = await postToFacebook({ message: caption });
      return Response.json({ success: true, postId, withImage: false });
    } catch (fallbackErr) {
      console.error(fallbackErr);
      return Response.json({ error: fallbackErr.message }, { status: 500 });
    }
  }
}