import { effectiveContractPayments } from './contractPayments.js';
const fixed = key => ['fijo_new','fijo_ren'].includes(key);
const digits = value => String(value||'').replace(/\D/g,'');
const amount = value => Math.max(0,Number(value)||0);
const dateKey = value => value instanceof Date ? value.toISOString().slice(0,10) : String(value||'').slice(0,10);
const excluded = value => ['cancelada','cancelado','cancelled','canceled','c','inactivo','inactive','no_renueva','no_renueva_ahora','trabajada','vendida','completada'].includes(String(value||'').trim().toLowerCase());
const todayPR = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const portfolioProduct = s => {
 const kind=String(s.line_kind||'').toLowerCase(),type=String(s.product_type||'').toUpperCase();
 if(kind==='cloud'||type==='K')return 'cloud';
 if(kind==='mpls'||type==='T')return 'mpls';
 if(['claro tv','clarotv','tv'].includes(kind))return 'claro_tv';
 if(kind==='fijo'||['O','V'].includes(type))return 'fijo_ren';
 if(['movil','móvil','mobile'].includes(kind)||type==='G')return 'movil_ren';
 return null;
};
function portfolioLines(opportunity, saved, subscribers, today) {
 const reviews=[],generated=[],seen=new Set();
 const manualAdditional=l=>['nueva','nuevo','new','manual','adicional'].includes(String(l.line_mode||'').toLowerCase());
 const isRelated=(l,s,key)=>!manualAdditional(l)&&l.product_key===key&&(l.subscriber_id===s.id || (digits(s.phone)&&digits(l.phone)===digits(s.phone)));
 const allKeys=new Set(subscribers.map(s=>`${portfolioProduct(s)}:${s.id}`));
 const matchedPhones=new Set(subscribers.map(s=>`${portfolioProduct(s)}:${digits(s.phone)}`).filter(k=>!k.endsWith(':')));
 const manual=saved.filter(l=>manualAdditional(l)||(!allKeys.has(`${l.product_key}:${l.subscriber_id}`)&&!matchedPhones.has(`${l.product_key}:${digits(l.phone)}`)));
 for(const source of subscribers){
  const s=effectiveContractPayments(source,today);
  const key=portfolioProduct(s),identity=`${key}:${digits(s.phone)||s.id}`;
  if(!key||seen.has(identity)||excluded(s.status))continue;
  seen.add(identity);
  const related=saved.filter(l=>isRelated(l,s,key));
  if(related.some(l=>excluded(l.status)))continue;
  const end=dateKey(s.contract_end_date),start=dateKey(s.contract_start_date);
  const payments=s.remaining_payments===null||s.remaining_payments===undefined||String(s.remaining_payments).trim()===''?null:Number(s.remaining_payments);
  const issues=[];
  if(payments===null||!Number.isFinite(payments)||payments<0)issues.push('Pagos pendientes sin dato válido');
  if(!end)issues.push('Sin fecha de contrato');
  if(fixed(key)&&!amount(s.monthly_value))issues.push('Sin mensualidad válida');
  if(start&&end&&Number(s.contract_term)>1){
   const elapsed=(Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7));
   if(Math.abs(elapsed-Number(s.contract_term))>1)issues.push('Fechas y plazo inconsistentes');
  }
  if(Number(s.contract_term)>0&&Number(s.payments_made)>=Number(s.contract_term)&&payments>0)issues.push('Pagos realizados y pendientes inconsistentes');
  if(issues.length)reviews.push({subscriber_id:s.id,phone:s.phone,issues});
  const contractEligible=!end||end<today;
  const eligible=fixed(key)?contractEligible:key==='movil_ren'?payments===0:contractEligible||payments===0;
  if(!eligible)continue;
  const previous=related.find(l=>!excluded(l.status));
  const since=[dateKey(opportunity.created_at),start].filter(Boolean).sort().at(-1);
  generated.push({...previous,id:previous?.id||`subscriber:${s.id}`,subscriber_id:s.id,ban_id:s.ban_id,phone:s.phone,product_key:key,status:'incluida',line_mode:'existente_renovar',created_at:previous?.created_at||since,quantity_value:fixed(key)?null:1,money_value:fixed(key)?amount(s.monthly_value):null,qty:1,amount:fixed(key)?amount(s.monthly_value):0,current_plan:s.plan,target_plan:s.plan,origin:'contrato_pagos',review_required:issues.length>0,eligibility_reason:fixed(key)?end?'Contrato vencido':'Sin contrato registrado':payments===0?'Sin cuotas pendientes':end?'Contrato vencido':'Sin contrato registrado'});
 }
 return {lines:[...manual,...generated],reviews};
}
export function reconcileOpportunity(opportunity, lines, sales, subscribers, today=todayPR()) {
  const portfolio=subscribers?portfolioLines(opportunity,lines,subscribers,today):{lines,reviews:[]};
  const unique=[...new Map(sales.map(s=>[String(s.sale_id),s])).values()];
  const available=unique.map(s=>({...s,used:false}));
  const remaining=[],products={};
  let total_lines=0,total_money=0;
  for(const line of [...portfolio.lines].sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')) || String(a.id).localeCompare(String(b.id)))){
    if(['cancelada','cancelado','no_renueva','trabajada','vendida','completada'].includes(String(line.status||'').toLowerCase()))continue;
    const key=line.product_key,isFixed=fixed(key),phone=digits(line.phone);
    let value=isFixed?amount(line.money_value??line.target_monthly_value??line.amount):amount(line.quantity_value??line.qty??(phone?1:0));
    const original=value;
    const automaticFixed=isFixed&&line.origin==='contrato_pagos';
    if(!value&&!automaticFixed)continue;
    const since=dateKey(line.created_at||opportunity.created_at);
    if(automaticFixed&&phone){
      const confirmed=available.find(s=>!s.used&&s.product_key===key&&dateKey(s.sale_date)>=since&&digits(s.phone)===phone);
      if(confirmed){confirmed.used=true;continue;}
    }
    for(const sale of available){
      if(!value)break;
      if(sale.used||sale.product_key!==key||dateKey(sale.sale_date)<since||(phone&&digits(sale.phone)!==phone)||(line.origin==='contrato_pagos'&&!phone))continue;
      const credit=isFixed?amount(sale.monthly_value):1;
      if(!credit)continue;
      value=Math.max(0,Math.round((value-credit)*100)/100);sale.used=true;
    }
    if(!value&&!automaticFixed)continue;
    const row={...line,quantity_value:isFixed?line.quantity_value:value,money_value:isFixed?value:line.money_value,qty:isFixed?line.qty:value,amount:isFixed?(automaticFixed&&!value?null:value):line.amount,sold_value:original-value};
    remaining.push(row);
    products[key] ||= {quantity_value:0,money_value:0,subscriber_count:0,current_step:null};
    products[key].subscriber_count++;
    if(automaticFixed&&!value)products[key].missing_price_count=(products[key].missing_price_count||0)+1;
    if(isFixed){products[key].money_value+=value;total_money+=value;}
    else{products[key].quantity_value+=value;total_lines+=value;}
  }
  return {lines:remaining,products,total_lines,total_money:Math.round(total_money*100)/100,sold_count:available.filter(s=>s.used).length,review_count:portfolio.reviews.length,reviews:portfolio.reviews};
}

export async function opportunitySalesContext(db, opportunityId) {
  const lines=await db.query(`SELECT * FROM public.opportunity_lines WHERE opportunity_id=$1 ORDER BY created_at,id`,[opportunityId]);
  const sales=await db.query(`
    SELECT DISTINCT vs.tango_venta_id::text AS sale_id,vs.phone,vs.product_key,
           vs.sale_date,vs.monthly_value
      FROM public.sales_opportunities o
      JOIN public.clients anchor ON anchor.id=o.client_id
      JOIN public.clients grouped ON grouped.id=anchor.id OR
        regexp_replace(lower(trim(COALESCE(NULLIF(grouped.name,''),grouped.business_name,''))),'[^a-z0-9]','','g')=
        regexp_replace(lower(trim(COALESCE(NULLIF(anchor.name,''),anchor.business_name,''))),'[^a-z0-9]','','g')
      JOIN public.bans b ON b.client_id=grouped.id
      JOIN ventaspro_nuevo.sales vs ON vs.ban_number::text=b.ban_number::text
      WHERE o.id=$1 AND vs.synced=true
        AND EXISTS(SELECT 1 FROM public.subscriber_reports sr WHERE sr.external_sale_id::text=vs.tango_venta_id::text AND sr.validation_status='confirmed')
      ORDER BY vs.sale_date,vs.tango_venta_id::text`,[opportunityId]);
  const subscribers=await db.query(`
    SELECT s.* FROM public.sales_opportunities o
      JOIN public.clients anchor ON anchor.id=o.client_id
      JOIN public.clients grouped ON grouped.id=anchor.id OR
        regexp_replace(lower(trim(COALESCE(NULLIF(grouped.name,''),grouped.business_name,''))),'[^a-z0-9]','','g')=
        regexp_replace(lower(trim(COALESCE(NULLIF(anchor.name,''),anchor.business_name,''))),'[^a-z0-9]','','g')
      JOIN public.bans b ON b.client_id=grouped.id
      JOIN public.subscribers s ON s.ban_id=b.id
      WHERE o.id=$1
      ORDER BY s.id`,[opportunityId]);
  return {lines:lines.rows,sales:sales.rows,subscribers:subscribers.rows};
}
