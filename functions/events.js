// functions/events.js
export async function onRequest(context) {
  const today = new Date();
  const startDate = today.toLocaleDateString('en-GB').replace(/\//g, '-');
  const endDateObj = new Date();
  endDateObj.setDate(today.getDate() + 30);
  const endDate = endDateObj.toLocaleDateString('en-GB').replace(/\//g, '-');

  const allEvents = [];

  for (let page = 1; page <= 10; page++) {
    const url = `https://asia.pokemon-card.com/hk/event-search/search/?pageNo=${page}&keyword=&startDate=${startDate}&endDate=${endDate}`;
    const res = await fetch(url);
    const html = await res.text();

    const eventMatches = [...html.matchAll(/<tr>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(.*?)<\/td>/g)];

    if (eventMatches.length === 0) break; // No more events

    for (const match of eventMatches) {
      const [_, date, time, location] = match;
      if (location.includes("澳門")) {
        allEvents.push({ date, time, location });
      }
    }
  }

  return new Response(JSON.stringify(allEvents), {
    headers: { 'Content-Type': 'application/json' },
  });
}
