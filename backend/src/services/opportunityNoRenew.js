import {randomUUID} from 'node:crypto';
import {reconcileOpportunity} from './opportunityConfirmedSales.js';
export async function markOpportunityNoRenew({db,opportunity,context,subscriberId,user}){
 const pending=reconcileOpportunity(opportunity,context.lines,context.sales,context.subscribers);
 const line=pending.lines.find(row=>String(row.subscriber_id)===String(subscriberId)&&row.origin==='contrato_pagos');
 if(!line)throw Object.assign(Error('La línea no es una renovación pendiente de este seguimiento.'),{status:409});
 const existing=context.lines.find(row=>row.subscriber_id===line.subscriber_id&&row.product_key===line.product_key&&!['nueva','new','manual','adicional'].includes(String(row.line_mode||'').toLowerCase()));
 if(existing){await db.query(`UPDATE public.opportunity_lines SET status='no_trabajar_ahora',reason='no_renueva',updated_at=now() WHERE id=$1 AND opportunity_id=$2`,[existing.id,opportunity.id]);}
 else await db.query(`INSERT INTO public.opportunity_lines (id,opportunity_id,client_id,ban_id,subscriber_id,product_key,line_mode,status,reason,phone,quantity_value,money_value,current_plan,target_plan,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,'existente_renovar','no_trabajar_ahora','no_renueva',$7,$8,$9,$10,$10,now(),now())`,[randomUUID(),opportunity.id,opportunity.client_id,line.ban_id,line.subscriber_id,line.product_key,line.phone,line.quantity_value,line.money_value,line.current_plan||null]);
 await db.query(`INSERT INTO public.opportunity_notes (id,opportunity_id,product_key,note,created_by_username,created_at) VALUES ($1,$2,$3,$4,$5,now())`,[randomUUID(),opportunity.id,line.product_key,'[NOTA] No renovar: '+String(line.phone||line.subscriber_id),String(user?.nombre||user?.nick||'Usuario')]);
 await db.query(`UPDATE public.sales_opportunities SET updated_at=now() WHERE id=$1`,[opportunity.id]);
 return {ok:true,subscriber_id:line.subscriber_id,state:'no_renueva'};
}
