'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Workspace } from '@/components/agents/Workspace';
import { formatDueDate } from '@/lib/utils';
import type { Project, ProjectStatus, Task } from '@/types';

const STATUSES: ProjectStatus[] = ['planning', 'production', 'post', 'review', 'delivered', 'archived'];

const STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: 'border-aura-muted/40 text-aura-muted',
  production: 'border-aura-warn/40 text-aura-warn',
  post: 'border-aura-warn/40 text-aura-warn',
  review: 'border-aura-accent/40 text-aura-accent',
  delivered: 'border-aura-accent/60 text-aura-accent',
  archived: 'border-aura-muted/30 text-aura-muted',
};

export function ProductionHubView() {
  return (
    <Workspace
      title="Production Hub"
      agentId="production-ops"
      agentName="Production Ops"
      suggestions={[
        'Nuevo proyecto: 4 reels para Acme, entrega en 3 semanas',
        'Crea el shot list para el rodaje del viernes',
        '¿Qué entregables tengo en revisión esta semana?',
      ]}
    >
      {(refreshKey) => <ProductionData refreshKey={refreshKey} />}
    </Workspace>
  );
}

function ProductionData({ refreshKey }: { refreshKey: number }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('reel');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
  }, [refreshKey]);

  async function toggleExpand(projectId: string) {
    const next = expanded === projectId ? null : projectId;
    setExpanded(next);
    if (next && !tasksByProject[next]) {
      const res = await fetch(`/api/tasks?project_id=${next}`);
      const data = await res.json();
      setTasksByProject((prev) => ({ ...prev, [next]: data.tasks ?? [] }));
    }
  }

  async function addProject(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), kind }),
    });
    const data = await res.json();
    if (res.ok) {
      setProjects((prev) => [data.project, ...prev]);
      setName('');
    } else setError(data.error ?? 'Could not create project');
  }

  async function setStatus(project: Project, status: ProjectStatus) {
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, status } : p)));
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteProject(project: Project) {
    if (!confirm(`Delete project "${project.name}" permanently?`)) return;
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    if (res.ok) setProjects((prev) => prev.filter((p) => p.id !== project.id));
  }

  async function toggleTask(projectId: string, task: Task) {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    setTasksByProject((prev) => ({
      ...prev,
      [projectId]: prev[projectId].map((t) =>
        t.id === task.id ? { ...t, status: nextStatus } : t
      ),
    }));
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  const activeProjects = projects.filter((p) => !['delivered', 'archived'].includes(p.status));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <form onSubmit={addProject} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project…"
          className="flex-1 rounded-xl border border-aura-border bg-aura-surface px-4 py-2.5 text-sm outline-none transition focus:border-aura-accent/60"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-xl border border-aura-border bg-aura-surface px-3 py-2.5 text-sm outline-none"
        >
          <option value="reel">Reel</option>
          <option value="video">Video</option>
          <option value="campaign">Campaign</option>
          <option value="webinar">Webinar</option>
          <option value="automation">Automation</option>
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-xl bg-aura-accent px-4 py-2.5 text-sm font-semibold text-aura-bg transition hover:brightness-110 disabled:opacity-40"
        >
          Add
        </button>
      </form>
      {error && <p className="text-xs text-aura-danger">{error}</p>}

      <p className="text-xs text-aura-muted">
        {activeProjects.length} proyectos activos. El agente genera las tareas por fase ([PRE]
        [PROD] [POST]) y los documentos (shot lists, call sheets) al crear un proyecto.
      </p>

      {projects.length === 0 ? (
        <p className="glass px-4 py-3 text-xs text-aura-muted">
          Sin proyectos. Crea uno aquí o dile al agente: «nuevo proyecto: 4 reels para Acme,
          entrega en 3 semanas».
        </p>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => {
            const due = formatDueDate(project.due_at);
            const open = expanded === project.id;
            const tasks = tasksByProject[project.id] ?? [];
            return (
              <li key={project.id} className="glass overflow-hidden">
                <div className="group flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleExpand(project.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm">{project.name}</p>
                    <p className="text-xs text-aura-muted">
                      {project.kind}
                      {due.label && (
                        <span className={due.overdue ? 'text-aura-danger' : ''}> · {due.label}</span>
                      )}
                    </p>
                  </button>
                  <select
                    value={project.status}
                    onChange={(e) => setStatus(project, e.target.value as ProjectStatus)}
                    className={`shrink-0 rounded-full border bg-transparent px-2 py-0.5 text-[10px] font-medium uppercase outline-none ${STATUS_STYLES[project.status]}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteProject(project)}
                    aria-label="Delete project"
                    className="hidden shrink-0 text-xs text-aura-muted hover:text-aura-danger group-hover:block"
                  >
                    ✕
                  </button>
                  <button
                    onClick={() => toggleExpand(project.id)}
                    className="shrink-0 text-xs text-aura-muted"
                  >
                    {open ? '▾' : '▸'}
                  </button>
                </div>

                {open && (
                  <div className="border-t border-aura-border px-4 py-3">
                    {project.notes && <p className="mb-2 text-xs text-aura-muted">{project.notes}</p>}
                    {tasks.length === 0 ? (
                      <p className="text-xs text-aura-muted">
                        Sin tareas. Pide al agente el desglose de fases.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {tasks.map((task) => (
                          <li key={task.id} className="flex items-center gap-2 text-sm">
                            <button
                              onClick={() => toggleTask(project.id, task)}
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] transition ${
                                task.status === 'completed'
                                  ? 'border-aura-accent bg-aura-accent text-aura-bg'
                                  : 'border-aura-border hover:border-aura-accent'
                              }`}
                            >
                              {task.status === 'completed' && '✓'}
                            </button>
                            <span
                              className={`truncate ${
                                task.status === 'completed' ? 'text-aura-muted line-through' : ''
                              }`}
                            >
                              {task.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
