-- The "Novo movimento" sheet is now "Nova despesa" (expenses only; income comes from sales).
update public.help_docs
set sections = replace(sections::text, 'abre “Novo movimento”', 'abre “Nova despesa”')::jsonb
where sections::text like '%abre “Novo movimento”%';
