export const CARD_STYLES = [
  { id: 'classic', name: 'Classic', background: '#082d58', accent: '#ffcf24' },
  { id: 'gold', name: 'Founder Gold', background: '#211b13', accent: '#f3d58a' },
  { id: 'floodlights', name: 'Floodlights', background: '#042b49', accent: '#78d9ff' },
  { id: 'royal', name: 'Royal Edition', background: '#281c4b', accent: '#dbb6ff' },
];
export async function renderCollectionCard({album,spares,needs,code,name,style='classic',isFounder=false}) {
 const theme=CARD_STYLES.find(t=>t.id===(isFounder?style:'classic'))||CARD_STYLES[0];
 const premium=theme.id!=='classic';
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
 const ctx=canvas.getContext('2d');const gradient=ctx.createLinearGradient(0,0,1200,900);gradient.addColorStop(0,theme.background);gradient.addColorStop(1,'#06152d');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,900);
 if(premium){
  ctx.strokeStyle=theme.accent;ctx.lineWidth=3;ctx.strokeRect(30,30,1140,840);ctx.globalAlpha=.12;
  if(theme.id==='gold'){for(let x=-900;x<1600;x+=65){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+900,900);ctx.stroke();}}
  if(theme.id==='floodlights'){for(const x of [0,1200]){const glow=ctx.createRadialGradient(x,0,20,x,0,750);glow.addColorStop(0,theme.accent);glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,1200,900);}}
  if(theme.id==='royal'){for(let x=80;x<1200;x+=120)for(let y=80;y<900;y+=120){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.strokeRect(-25,-25,50,50);ctx.restore();}}
  ctx.globalAlpha=1;
 }
 const logo=new Image();logo.src='/design/wordmark.png';await logo.decode();const height=160;ctx.drawImage(logo,600-logo.width/logo.height*height/2,60,logo.width/logo.height*height,height);
 ctx.textAlign='center';ctx.fillStyle=theme.accent;ctx.font='bold 22px sans-serif';
 if(premium)ctx.fillText('FOUNDER COLLECTION',600,275);
 ctx.fillStyle='#fff';ctx.font='bold 54px sans-serif';
 ctx.fillText(premium?`${(name||'Collector').trim().split(/\s+/)[0].slice(0,30)}’s swap list`:'Can we help each other',600,345,1040);
 ctx.fillText(premium?'Your next swap starts here.':'finish our collection?',600,415,1040);
 ctx.font='28px sans-serif';ctx.fillText(album.name,600,490,1040);ctx.fillStyle=theme.accent;ctx.font='bold 58px sans-serif';ctx.fillText(`${spares} spares   /   ${needs} needed`,600,600,1040);
 ctx.fillStyle='#fff';ctx.font='27px sans-serif';ctx.fillText('Open my collection link in the post to compare.',600,710,1040);ctx.font='23px sans-serif';ctx.fillText(`Got One Spare? · Invitation ${code}`,600,790,1040);
 return canvas;
}
