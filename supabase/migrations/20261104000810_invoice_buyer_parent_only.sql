-- Invoices are billed to the parent/guardian only — never to the child's own email.
create or replace function private.invoice_buyer(p_order public.orders, out name text, out email text, out phone text)
language plpgsql stable security definer set search_path = '' as $$
declare v_p public.profiles;
begin
  select * into v_p from public.profiles where id = p_order.buyer_id;
  name := coalesce(p_order.payer_name, v_p.parent_name, 'Parent/guardian of ' || coalesce(v_p.full_name, 'student'));
  email := coalesce(p_order.payer_email, v_p.parent_email);
  phone := coalesce(p_order.payer_phone, v_p.parent_phone);
end;
$$;
