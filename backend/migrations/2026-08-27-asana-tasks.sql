BEGIN;

CREATE TABLE IF NOT EXISTS public.asana_tasks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('baja','normal','alta')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','completada','cancelada')),
  assigned_to_username TEXT NOT NULL,
  created_by_username TEXT NOT NULL,
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  opportunity_id UUID NULL REFERENCES public.sales_opportunities(id) ON DELETE SET NULL,
  step_id UUID NULL REFERENCES public.opportunity_steps(id) ON DELETE SET NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asana_tasks_assignee_due
  ON public.asana_tasks (assigned_to_username, status, due_at);

CREATE INDEX IF NOT EXISTS idx_asana_tasks_opportunity
  ON public.asana_tasks (opportunity_id, status)
  WHERE opportunity_id IS NOT NULL;

COMMIT;
