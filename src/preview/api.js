// Synthetic local state for visual/interaction review, not a server emulator.
const now = '2026-09-12T09:00:00.000Z';
const clone = value => structuredClone(value);
export const demoUser = { id: 1, name: 'Alex Morgan', email: 'alex@example.test', email_verified: true, address_line1: '1 Example Lane', city: 'Sampleton', postcode: 'SW1A 1AA', country: 'United Kingdom', rating_avg: 4.9, rating_count: 12, matching_paused: false, created_at: '2026-06-01', xp: 240, level: 3 };
const albums = [{ id: 1, name: "World Cup Stickers 2026" }, { id: 2, name: "Men's Premier League Trading Cards 2026/27" }];
const people = [{ id: 2, name: 'Jamie R.', rating_avg: 4.9, rating_count: 12 }, { id: 3, name: 'Sam W.', rating_avg: 4.8, rating_count: 8 }, { id: 4, name: 'Morgan L.', rating_avg: 5, rating_count: 19 }];
const stickers = albums.flatMap(a => Array.from({ length: 36 }, (_, n) => ({ id: a.id * 1000 + n + 1, sticker_id: a.id * 1000 + n + 1, album_id: a.id, sticker_number: String(n + 1).padStart(3, '0'), team_name: ['England', 'France', 'Spain', 'Germany', 'Brazil', 'Argentina'][n % 6], description: ['Oliver Reed', 'Lucas Moreau', 'Mateo Vega', 'Felix Adler', 'Rafael Costa', 'Nico Romero'][n % 6], preview_art: n % 6 })));
let user, duplicates, needs, matches, swaps, chats, conversations, blocked, notifications;
export function resetFixtures() {
 user = clone(demoUser);
 duplicates = stickers.filter(s => s.id % 1000 <= 12).map(s => ({ ...s, quantity: 2 }));
 needs = stickers.filter(s => s.id % 1000 > 12 && s.id % 1000 <= 30);
 matches = albums.flatMap(a => people.map((p, i) => ({ id: a.id * 10 + i, album_id: a.id, other_user_id: p.id, other_user_name: p.name, rating_avg: p.rating_avg, rating_count: p.rating_count, a_gives_b_count: 6 - i, b_gives_a_count: 6 - i, distance_miles: 12 + i * 8, last_login_at: now })));
 swaps = [makeSwap(1042, 1, 2, 'accepted'), makeSwap(1043, 1, 3, 'proposed'), makeSwap(1044, 2, 4, 'posted')];
 chats = { 1042: [{ id: 1, sender_id: 2, user_id: 2, sender_name: 'Jamie R.', body: 'Hi Alex! Your stickers are packed and ready. Looking forward to this swap.', created_at: now }] };
 conversations = [{ conversation_id: 21, other_user_id: 2, other_user_name: 'Jamie R.', unread_count: 1, last_message: 'Your stickers are packed and ready!', last_sender_id: 2, last_message_at: now, other_user_last_login_at: now }];
 blocked = [];
 notifications = [{ id: 1, title: 'Your next swap is waiting', body: 'Jamie has accepted your swap. You are ready to post.', type: 'swap_accepted', is_read: false, created_at: now }];
}
function makeSwap(id, album, other, status) { const p = people.find(p => p.id === other); return { id, album_id: album, user_a_id: 1, user_b_id: other, user_a_accepted: status !== 'proposed', user_b_accepted: true, user_a_posted: status === 'posted', user_b_posted: status === 'posted', user_a_received: false, user_b_received: false, status, other_user_id: other, other_user_name: p.name, display_give_count: 6, display_get_count: 6, created_at: now, updated_at: now, last_login_at: now }; }
function previewFor(album, count = 6) { return { userAId: 1, aGivesB: stickers.filter(s => s.album_id === album).slice(0, count), bGivesA: stickers.filter(s => s.album_id === album).slice(12, 12 + count) }; }
function detail(s) { const p = previewFor(s.album_id, s.display_give_count); return { swap: s, items: [...p.aGivesB.map(x => ({ ...x, from_user_id: 1, to_user_id: s.user_b_id })), ...p.bGivesA.map(x => ({ ...x, from_user_id: s.user_b_id, to_user_id: 1 }))], otherUser: people.find(p => p.id === s.user_b_id), otherUserAddress: { name: s.other_user_name, address_line1: '2 Fictional Street', city: 'Sampleton', postcode: 'SW1A 1AA' } }; }
resetFixtures();
export async function previewRequest(path, { method = 'GET', body } = {}) {
 const url = new URL(path, 'https://preview.invalid');
 const p = url.pathname, a = Number(url.searchParams.get('albumId') || 1);
 let result;
 if (p === '/albums') result = albums;
 else if (p === '/stats') result = { collectors: 1248, activeThisWeek: 326, completedSwaps: 512, totalSwaps: 3712 };
 else if (p === '/activity') result = [];
 else if (p === '/auth/login' || p === '/auth/signup') result = { user, token: 'preview-alex' };
 else if (p === '/auth/me') { if (method === 'PUT') Object.assign(user, body); if (method === 'DELETE') throw new Error('Account deletion is unavailable in this fictional preview.'); result = user; }
 else if (p === '/auth/me/referral') result = { code: 'PREVIEW' };
 else if (p === '/auth/search') result = people.filter(x => x.name.toLowerCase().includes((url.searchParams.get('q') || '').toLowerCase()));
 else if (p.startsWith('/auth/')) result = { success: true };
 else if (p === '/stickers') result = stickers.filter(s => s.album_id === a && (!url.searchParams.get('team') || s.team_name === url.searchParams.get('team')) && (!url.searchParams.get('search') || `${s.sticker_number} ${s.description} ${s.team_name}`.toLowerCase().includes(url.searchParams.get('search').toLowerCase())));
 else if (p === '/stickers/teams') result = [...new Set(stickers.filter(s => s.album_id === a).map(s => s.team_name))].map(team_name => ({ team_name, sticker_count: 6, first_number: stickers.find(s => s.album_id === a && s.team_name === team_name).sticker_number, last_number: stickers.filter(s => s.album_id === a && s.team_name === team_name).at(-1).sticker_number }));
 else if (p.startsWith('/stickers/me/')) {
   const isDup = p.includes('/duplicates'), list = isDup ? duplicates : needs;
   if (p.includes('/all') && method === 'DELETE') { duplicates = duplicates.filter(s => s.album_id !== a); needs = needs.filter(s => s.album_id !== a); result = null; }
   else if (method === 'GET') result = list.filter(s => s.album_id === a);
   else if (method === 'DELETE') { const i = list.findIndex(s => s.sticker_id === Number(p.split('/').pop())); if (i >= 0) list.splice(i, 1); result = null; }
   else { for (const id of body.stickerIds || [body.stickerId]) { const sticker = stickers.find(s => s.id === Number(id)); if (!sticker) throw new Error('Sticker not in the fictional checklist'); const existing = list.find(s => s.sticker_id === sticker.id); if (existing && isDup) existing.quantity = body.quantity || 1; else if (!existing) list.push({ ...sticker, ...(isDup ? { quantity: body.quantity || 1 } : {}) }); } result = { success: true }; }
 }
 else if (p === '/swaps/matches') result = matches.filter(m => m.album_id === a);
 else if (p === '/swaps/mine') result = swaps.filter(s => s.album_id === a);
 else if (p === '/swaps/history') result = swaps.filter(s => s.album_id === a && ['completed', 'declined'].includes(s.status));
 else if (p.startsWith('/swaps/preview/')) { const m = matches.find(m => m.id === Number(p.split('/').pop())); if (!m) throw new Error('Preview match not found'); result = previewFor(m.album_id, m.a_gives_b_count); }
 else if (p.startsWith('/swaps/stats/')) result = { ...(people.find(p => p.id === Number(url.pathname.split('/').pop())) || user), ratingAvg: 4.9, ratingCount: 12, lastLoginAt: now, city: 'Sampleton', completedSwaps: 12, successRatePct: 100, stickersExchanged: 72, activeSwaps: 2, memberSince: '2026-06-01', avgResponseHours: 2, avgDispatchDays: 1, currentStreak: 4 };
 else if (p === '/swaps' && method === 'POST') { const m = matches.find(m => m.id === body.matchId); if (!m) throw new Error('Match is no longer available'); const s = makeSwap(Math.max(...swaps.map(s => s.id)) + 1, m.album_id, m.other_user_id, 'proposed'); s.user_b_accepted = false; s.display_give_count = m.a_gives_b_count; s.display_get_count = m.b_gives_a_count; swaps.push(s); matches = matches.filter(x => x.id !== m.id); result = { swap: s }; }
 else if (/^\/swaps\/\d+/.test(p)) {
   const [, , id, action] = p.split('/'), s = swaps.find(s => s.id === Number(id));
   if (!s) throw new Error('Swap not found');
   if (action === 'messages') { chats[id] ||= []; if (method === 'POST') { const msg = { id: Date.now(), sender_id: 1, user_id: 1, sender_name: user.name, body: body.body, created_at: new Date().toISOString() }; chats[id].push(msg); result = msg; } else result = chats[id]; }
   else { if (method === 'POST') { if (action === 'accept') { s.user_a_accepted = true; if (s.user_b_accepted) s.status = 'accepted'; } else if (['decline', 'withdraw'].includes(action)) { s.status = 'declined'; s.declined_by_id = 1; s.decline_reason = body?.reason || 'Withdrawn after acceptance'; } else if (action === 'posted') { s.user_a_posted = true; s.user_a_postage_photo = body?.photo; if (s.user_b_posted) s.status = 'posted'; } else if (action === 'received') { s.user_a_received = true; if (s.user_b_received) s.status = 'completed'; } else if (action === 'sticker-photo') s.user_a_sticker_photo = body.photo; else throw new Error(`Unsupported preview swap action: ${action}`); } result = detail(s); }
 }
 else if (p === '/messages/blocked') result = blocked;
 else if (p.includes('/messages/block/')) { const id = Number(p.split('/').pop()); if (method === 'DELETE') blocked = blocked.filter(x => x.id !== id); else blocked.push(people.find(x => x.id === id)); result = { success: true }; }
 else if (p === '/messages') { if (method === 'POST') { const other = people.find(p => p.id === body.recipientId); const c = conversations.find(c => c.other_user_id === other.id) || { conversation_id: Date.now(), other_user_id: other.id, other_user_name: other.name, unread_count: 0 }; if (!conversations.includes(c)) conversations.push(c); chats[c.conversation_id] ||= []; chats[c.conversation_id].push({ id: Date.now(), sender_id: 1, body: body.body, created_at: now }); result = { conversationId: c.conversation_id }; } else result = conversations; }
 else if (/^\/messages\/\d+/.test(p)) { const [, , id, action] = p.split('/'); chats[id] ||= [{ id: 51, sender_id: 2, sender_name: 'Jamie R.', body: 'Hi Alex! Your stickers are packed and ready.', created_at: now }]; if (action === 'send') { const msg = { id: Date.now(), sender_id: 1, body: body.body, created_at: now }; chats[id].push(msg); result = msg; } else if (action === 'report') result = { success: true }; else { const c = conversations.find(c => c.conversation_id === Number(id)); if (c) c.unread_count = 0; result = { messages: chats[id], otherUser: people.find(p => p.id === c?.other_user_id) || people[0], isBlocked: blocked.some(x => x.id === c?.other_user_id) }; } }
 else if (p === '/notifications') result = { notifications, unreadCount: notifications.filter(n => !n.is_read).length };
 else if (p.startsWith('/notifications/')) { notifications.forEach(n => { n.is_read = true; }); result = { success: true }; }
 else if (p.startsWith('/ratings/user/')) result = { recentRatings: [], ratings: [], user: people.find(x => x.id === Number(p.split('/').pop())) || user, average: 4.9, count: 12 };
 else if (p === '/ratings') { const s = swaps.find(s => s.id === body.swapId); if (s) s.your_rating = body.stars; result = { success: true }; }
 else if (p.startsWith('/badges/') || p === '/reports/mine' || p === '/disputes/me') result = [];
 else if (p === '/disputes') { const s = swaps.find(s => s.id === body.swapId); if (s) s.status = 'disputed'; result = { success: true }; }
 else if (p === '/ambassador/status') result = { status: null };
 else if (p === '/feedback') result = { success: true };
 else if (p.startsWith('/push/') || p.startsWith('/founder/') || p.startsWith('/app-launch/') || p.startsWith('/android-testers/') || p.startsWith('/donations/')) throw new Error('This integration is disabled in preview.');
 else throw new Error(`No fixture for ${method} ${p}. No live request was made.`);
 return clone(result);
}
