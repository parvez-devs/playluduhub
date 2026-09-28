'use strict';
const {db}=require('./db');
const {uid,sha256}=require('./utils');
function audit({actorType='system',actorId=null,action,targetType=null,targetId=null,ip=null,details=null}){
  db.prepare('INSERT INTO audit_log(id,actor_type,actor_id,action,target_type,target_id,ip_hash,details,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(uid('aud'),actorType,actorId,action,targetType,targetId,ip?sha256(ip):null,details?JSON.stringify(details):null,Date.now());
}
module.exports={audit};

