insert into public.settings (key, value, description) values
  ('legal.jurisdiction', '"[City, State] (placeholder)"', 'Courts named in the terms of use')
on conflict (key) do nothing;
