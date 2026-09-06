import crypto from "node:crypto";

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PEPPER = process.env.NUANCE_SYNC_PEPPER || "nuance-v6-lite";

function safeCode(code){
  return typeof code === "string" &&
    /^NUANCE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.trim().toUpperCase());
}

function keyFor(code){
  const digest = crypto.createHash("sha256")
    .update(PEPPER + "|" + code.trim().toUpperCase())
    .digest("hex");
  return `nuance:sync:${digest}`;
}

function itemId(x){
  if(x?.id) return String(x.id);
  const a=String(x?.target||x?.word||"").toLowerCase().trim();
  const b=String(x?.original_context||x?.lookup_text||"").toLowerCase().trim();
  return `${a}|${b}`;
}

function merge(a=[], b=[]){
  const m=new Map();
  for(const x of [...a,...b]){
    if(!x || typeof x!=="object") continue;
    const id=itemId(x);
    if(!id) continue;
    const old=m.get(id);
    if(!old){m.set(id,{...x,id});continue}
    const newer=(x.last_seen_at||x.added_at||0)>=(old.last_seen_at||old.added_at||0)?x:old;
    m.set(id,{
      ...old,...newer,id,
      reviews:Math.max(old.reviews||0,x.reviews||0),
      interval:Math.max(old.interval||1,x.interval||1),
      due:Math.max(old.due||0,x.due||0),
      ease:Math.max(old.ease||2.5,x.ease||2.5)
    });
  }
  return [...m.values()];
}

async function redis(cmd){
  const r=await fetch(URL,{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${TOKEN}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(cmd)
  });
  const data=await r.json();
  if(!r.ok || data.error) throw new Error(data.error||`Redis ${r.status}`);
  return data.result;
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  if(!URL || !TOKEN) return res.status(500).json({error:"Cloud database is not configured yet."});

  const {code,deck}=req.body||{};
  if(!safeCode(code)) return res.status(400).json({error:"Invalid sync code."});
  if(!Array.isArray(deck)) return res.status(400).json({error:"Invalid vocabulary deck."});

  try{
    const key=keyFor(code);
    const raw=await redis(["GET",key]);
    let remote=[];
    if(raw){
      try{remote=JSON.parse(raw)}catch{remote=[]}
    }
    const merged=merge(remote,deck);
    await redis(["SET",key,JSON.stringify(merged)]);
    return res.status(200).json({ok:true,deck:merged,count:merged.length});
  }catch(e){
    console.error(e);
    return res.status(500).json({error:"Cloud sync failed. Please try again."});
  }
}
