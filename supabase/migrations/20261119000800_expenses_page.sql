-- The "Finanças" page is now "Despesas" (expenses only; income and results live in Relatórios).
update public.help_docs
set title = replace(title, 'Finanças', 'Despesas'),
    blurb = replace(blurb, 'Finanças', 'Despesas'),
    lead = replace(lead, 'Finanças', 'Despesas'),
    facts = replace(facts::text, 'Finanças', 'Despesas')::jsonb,
    sections = replace(sections::text, 'Finanças', 'Despesas')::jsonb,
    example = replace(example::text, 'Finanças', 'Despesas')::jsonb,
    warn = replace(warn::text, 'Finanças', 'Despesas')::jsonb
where concat_ws(' ', title, blurb, lead, facts::text, sections::text, example::text, warn::text) like '%Finanças%';
