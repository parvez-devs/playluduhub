'use strict';

const {db,getConfig}=require('./db');
const ledger=require('./ledger');

const cents=v=>Math.round(Number(v||0)*100);
const cleanCode=v=>String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');

function makeCode(username,id){
  const stem=cleanCode(username).slice(0,6)||'PLAYER';
  const tail=cleanCode(id).slice(-6)||String(Date.now()).slice(-6);
  let code=(stem+tail).slice(0,12),n=1;
  while(db.prepare('SELECT 1 FROM users WHERE referral_code=? LIMIT 1').get(code)){
    code=(stem+tail.slice(0,Math.max(1,5-String(n).length))+String(n)).slice(0,12);n++;
  }
  return code;
}

function resolveCode(code){
  const c=cleanCode(code);if(!c)return null;
  return db.prepare("SELECT id,username,referral_code FROM users WHERE referral_code=? AND status!='banned' LIMIT 1").get(c)||null;
}

function attach(referrerId,referredId,code){
  if(!referrerId||!referredId||referrerId===referredId)return;
  db.prepare('INSERT OR IGNORE INTO referrals(referrer_id,referred_id,code,created_at) VALUES(?,?,?,?)')
    .run(referrerId,referredId,cleanCode(code),Date.now());
}

function trackCompletedMatch(userId,matchId){
  const marker=db.prepare('INSERT OR IGNORE INTO referral_games(match_id,user_id,created_at) VALUES(?,?,?)').run(matchId,userId,Date.now());
  if(!marker.changes)return;
  const rel=db.prepare('SELECT * FROM referrals WHERE referred_id=? LIMIT 1').get(userId);
  if(!rel)return;
  db.prepare('UPDATE referrals SET games_completed=games_completed+1 WHERE referred_id=?').run(userId);
  const row=db.prepare('SELECT * FROM referrals WHERE referred_id=? LIMIT 1').get(userId),cfg=getConfig();
  const required=Math.max(1,Number(cfg.referralGamesRequired||2)),reward=cents(cfg.referralBonus||0);
  if(cfg.referralEnabled===false||row.rewarded_at||row.games_completed<required||reward<=0)return;
  db.transaction(()=>{
    const fresh=db.prepare('SELECT rewarded_at FROM referrals WHERE referred_id=?').get(userId);
    if(fresh?.rewarded_at)return;
    ledger.post(row.referrer_id,'bonus',reward,'bonus_credit',`referral:${userId}`,`Referral reward after ${required} completed games`);
    db.prepare('UPDATE referrals SET rewarded_at=?,reward_amount=? WHERE referred_id=?').run(Date.now(),reward,userId);
    ledger.assertWallet(row.referrer_id);
  })();
}

function summary(userId){
  const u=db.prepare('SELECT referral_code FROM users WHERE id=?').get(userId);
  const totals=db.prepare('SELECT COUNT(*) joined,COALESCE(SUM(CASE WHEN rewarded_at IS NOT NULL THEN 1 ELSE 0 END),0) rewarded,COALESCE(SUM(reward_amount),0) reward_amount FROM referrals WHERE referrer_id=?').get(userId);
  const invited=db.prepare('SELECT r.games_completed,r.rewarded_at,r.reward_amount,u.username,u.created_at FROM referrals r JOIN users u ON u.id=r.referred_id WHERE r.referrer_id=? ORDER BY r.created_at DESC LIMIT 50').all(userId);
  const c=getConfig();
  return {
    code:u?.referral_code||'',
    enabled:c.referralEnabled!==false,
    bonus:Number(c.referralBonus||0),
    gamesRequired:Math.max(1,Number(c.referralGamesRequired||2)),
    joined:Number(totals?.joined||0),
    rewarded:Number(totals?.rewarded||0),
    rewardTotal:Number(totals?.reward_amount||0)/100,
    invited:invited.map(x=>({username:x.username,gamesCompleted:x.games_completed,rewarded:!!x.rewarded_at,rewardAmount:Number(x.reward_amount||0)/100,createdAt:x.created_at}))
  };
}

function leaderboard(limit=10){
  const n=Math.max(3,Math.min(50,Number(limit)||10));
  return db.prepare(`
    SELECT u.username,u.display_name,COUNT(*) wins,COALESCE(SUM(m.bet_amount),0) stake_won
    FROM matches m JOIN users u ON u.id=m.winner_id
    WHERE m.status='finished' AND m.winner_id IS NOT NULL
    GROUP BY m.winner_id
    ORDER BY wins DESC,stake_won DESC,MAX(m.ended_at) DESC
    LIMIT ?
  `).all(n).map((x,i)=>({rank:i+1,username:x.username,displayName:x.display_name,wins:Number(x.wins||0),stakeWon:Number(x.stake_won||0)/100}));
}

module.exports={makeCode,resolveCode,attach,trackCompletedMatch,summary,leaderboard};
