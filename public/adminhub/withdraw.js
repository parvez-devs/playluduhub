'use strict';
window.AdminActions={
  idem:()=>crypto.randomUUID(),
  async decision(kind,id,approve){return AdminAPI(`/api/admin/${kind}/${encodeURIComponent(id)}/${approve?'approve':'reject'}`,{method:'POST',headers:{'idempotency-key':crypto.randomUUID()}});},
  money:v=>`৳${(Number(v||0)/100).toFixed(2)}`
};

