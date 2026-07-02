const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

async function run() {
  const photoIds = ['122121474375302089', '122097475977302089'];
  for (const id of photoIds) {
    try {
      console.log(`\n--- Photo ${id} ---`);
      const res = await fetch(`https://graph.facebook.com/v25.0/${id}?fields=id,name,created_time,from,link,can_delete&access_token=${PAGE_ACCESS_TOKEN}`);
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`Error fetching photo ${id}:`, err);
    }
  }
}

run();
