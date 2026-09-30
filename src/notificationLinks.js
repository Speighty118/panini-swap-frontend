// Plain text stays plain text: only absolute HTTP(S) URLs become links.
export function splitNotificationLinks(text) {
  return String(text).split(/(https?:\/\/[^\s<>]+)/gi).flatMap(part => {
    if (!/^https?:\/\//i.test(part)) return [{text:part}];
    const url = part.replace(/[.,!?;:)\]}]+$/, '');
    try {
      const parsed = new URL(url);
      if (!parsed.hostname || parsed.username || parsed.password) return [{text:part}];
      return [{text:url,href:parsed.href}, {text:part.slice(url.length)}];
    } catch { return [{text:part}]; }
  });
}
export function surveyIdFromLink(href) {
 try { const u=new URL(href);return u.protocol==='https:' && ['gotonespare.com','www.gotonespare.com'].includes(u.hostname) && u.pathname==='/' && /^\d+$/.test(u.searchParams.get('survey')||'') ? u.searchParams.get('survey') : null; } catch{return null;}
}
